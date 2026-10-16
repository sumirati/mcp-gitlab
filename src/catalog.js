import { z } from "zod";
import { isReadOnly } from "./client.js";
import { projectOutput, jsonToMarkdown } from "./helpers.js";

import { repositoryTools, repositoryHandlers } from "./tools/repositories.js";
import { branchTools, branchHandlers } from "./tools/branches.js";
import { memberTools, memberHandlers } from "./tools/members.js";
import { variableTools, variableHandlers } from "./tools/variables.js";
import { issueTools, issueHandlers } from "./tools/issues.js";
import { milestoneTools, milestoneHandlers } from "./tools/milestones.js";
import { pipelineTools, pipelineHandlers } from "./tools/pipelines.js";
import { releaseTools, releaseHandlers } from "./tools/releases.js";
import { mergeRequestTools, mergeRequestHandlers } from "./tools/merge-requests.js";
import { wikiTools, wikiHandlers } from "./tools/wikis.js";
import { snippetTools, snippetHandlers } from "./tools/snippets.js";
import { userTools, userHandlers } from "./tools/user.js";
import { commitTools, commitHandlers } from "./tools/commits.js";
import { enterpriseTools, enterpriseHandlers } from "./tools/enterprise.js";

export const DOMAIN_MODULES = {
  repositories: { tools: repositoryTools, handlers: repositoryHandlers },
  branches: { tools: branchTools, handlers: branchHandlers },
  commits: { tools: commitTools, handlers: commitHandlers },
  members: { tools: memberTools, handlers: memberHandlers },
  variables: { tools: variableTools, handlers: variableHandlers },
  issues: { tools: issueTools, handlers: issueHandlers },
  milestones: { tools: milestoneTools, handlers: milestoneHandlers },
  pipelines: { tools: pipelineTools, handlers: pipelineHandlers },
  releases: { tools: releaseTools, handlers: releaseHandlers },
  "merge-requests": { tools: mergeRequestTools, handlers: mergeRequestHandlers },
  wikis: { tools: wikiTools, handlers: wikiHandlers },
  snippets: { tools: snippetTools, handlers: snippetHandlers },
  user: { tools: userTools, handlers: userHandlers },
  enterprise: { tools: enterpriseTools, handlers: enterpriseHandlers },
};

export const DOMAIN_ALIASES = {
  mr: "merge-requests",
  merge_requests: "merge-requests",
  repos: "repositories",
  ci: "pipelines",
  runners: "enterprise",
  mirrors: "enterprise",
  webhooks: "enterprise",
  system: "enterprise",
  health: "enterprise",
  diagnostics: "enterprise",
  protected_branches: "branches",
  groups: "user",
  group: "user",
};

// Build flattened catalog map
export const ACTION_CATALOG = new Map();
const CATALOG = ACTION_CATALOG;

for (const [domain, module] of Object.entries(DOMAIN_MODULES)) {
  for (const tool of module.tools) {
    const handler = module.handlers[tool.name];
    CATALOG.set(tool.name, {
      name: tool.name,
      domain,
      title:
        tool.title ||
        tool.name
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      description: tool.description,
      inputSchema: tool.inputSchema,
      mutating: Boolean(tool.mutating),
      annotations: {
        readOnlyHint: !tool.mutating,
        destructiveHint: tool.name.startsWith("delete_") || tool.name.startsWith("remove_"),
        idempotentHint: !tool.mutating,
        openWorldHint: false,
        ...(tool.annotations || {}),
      },
      handler,
    });
  }
}

// Extract lightweight parameter summary from JSON schema for LLM discovery
function summarizeSchemaParameters(schema) {
  if (!schema || !schema.properties) {
    return { type: "object", properties: {}, required: [] };
  }
  const requiredList = Array.isArray(schema.required) ? schema.required : [];
  const props = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    props[key] = {
      type: prop.type || (prop.enum ? `enum(${prop.enum.join("|")})` : "any"),
      description: prop.description || "",
      required: requiredList.includes(key),
      ...(prop.default !== undefined ? { default: prop.default } : {}),
    };
  }
  return {
    type: "object",
    properties: props,
    required: requiredList,
  };
}

function formatCompactParameters(parameters) {
  const props = parameters?.properties || {};
  const keys = Object.keys(props);
  if (keys.length === 0) return "-";
  const reqSet = new Set(parameters?.required || []);
  const sorted = [
    ...keys.filter((k) => reqSet.has(k)),
    ...keys.filter((k) => !reqSet.has(k)),
  ];
  return sorted.map((k) => (reqSet.has(k) ? `\`${k}*\`` : `\`${k}?\``)).join(", ");
}

function formatActionsAsMarkdown(result) {
  if (result.message) {
    let md = `## GitLab Action Catalog\n\n${result.message}\n\n### Available Domains\n\n`;
    for (const [d, count] of Object.entries(result.available_domains || {})) {
      md += `- **${d}**: ${count} actions\n`;
    }
    return md;
  }

  let md = `### GitLab Actions (${result.total_matches} total matches, page ${result.page}/${Math.ceil(result.total_matches / result.per_page) || 1})\n\n`;
  md += `| Action | Domain | Mutating | Parameters (\`*\` = required) | Description |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const a of result.actions) {
    const mut = a.mutating ? "Yes" : "No";
    const paramsSig = formatCompactParameters(a.parameters);
    const desc = (a.description || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    md += `| \`${a.action}\` | ${a.domain} | ${mut} | ${paramsSig} | ${desc} |\n`;
  }
  return md;
}

/**
 * Search and discover GitLab actions on-demand
 */
export function findActions({ query, domain, page = 1, per_page = 15, format = "markdown" }) {
  let entries = Array.from(CATALOG.values());

  // Filter by read-only mode if active
  if (isReadOnly()) {
    entries = entries.filter((e) => !e.mutating);
  }

  // Filter by domain
  if (domain && domain.trim() !== "") {
    const normDomain = domain.trim().toLowerCase();
    const resolvedDomain = DOMAIN_ALIASES[normDomain] || normDomain;
    entries = entries.filter((e) => e.domain === resolvedDomain);
  }

  // If no filters were provided, return catalog domain breakdown
  if (!query && !domain) {
    const domainCounts = {};
    for (const a of entries) {
      domainCounts[a.domain] = (domainCounts[a.domain] || 0) + 1;
    }
    const overview = {
      message: `GitLab Action Catalog contains ${entries.length} actions across ${Object.keys(domainCounts).length} domains. Query by domain or search keyword to retrieve parameter schemas.`,
      available_domains: domainCounts,
      daily_driver_eager_tools: [
        "get_file_contents (project_id, file_path, [ref])",
        "get_project (project_id, [statistics])",
        "get_commit (project_id, sha, [file_path], [max_diff_lines])",
      ],
      usage_hint: "Call gitlab_find_actions(query: 'merge request') or gitlab_find_actions(domain: 'pipelines') to inspect parameter signatures.",
    };
    return format === "markdown" ? formatActionsAsMarkdown(overview) : overview;
  }

  // Filter / rank by query
  if (query && query.trim() !== "") {
    const q = query.trim().toLowerCase();
    const scored = entries
      .map((entry) => {
        let score = 0;
        const name = entry.name.toLowerCase();
        const title = entry.title.toLowerCase();
        const desc = entry.description.toLowerCase();

        if (name === q) score += 100;
        else if (name.startsWith(q)) score += 50;
        else if (name.includes(q)) score += 30;

        if (title.includes(q)) score += 20;
        if (desc.includes(q)) score += 10;
        if (entry.domain.includes(q)) score += 15;

        // Check parameter names
        if (entry.inputSchema && entry.inputSchema.properties) {
          for (const propName of Object.keys(entry.inputSchema.properties)) {
            if (propName.toLowerCase().includes(q)) {
              score += 5;
            }
          }
        }

        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.entry);

    entries = scored;
  }

  const total = entries.length;
  const startIndex = (page - 1) * per_page;
  const paginated = entries.slice(startIndex, startIndex + per_page);

  const result = {
    total_matches: total,
    page,
    per_page,
    has_more: startIndex + per_page < total,
    available_domains: Object.keys(DOMAIN_MODULES),
    actions: paginated.map((e) => ({
      action: e.name,
      domain: e.domain,
      title: e.title,
      description: e.description,
      mutating: e.mutating,
      parameters: summarizeSchemaParameters(e.inputSchema),
    })),
  };

  return format === "markdown" ? formatActionsAsMarkdown(result) : result;
}

/**
 * Execute an action from the catalog with input validation and projection
 */
export async function executeAction(actionName, params = {}, options = {}) {
  const entry = CATALOG.get(actionName);
  if (!entry) {
    const available = Array.from(CATALOG.keys())
      .filter((k) => k.includes(actionName) || actionName.includes(k.split("_")[0]))
      .slice(0, 5);
    const suggestion = available.length > 0 ? ` Did you mean: ${available.join(", ")}?` : "";
    throw new Error(
      `Unknown GitLab action '${actionName}'.${suggestion} Call 'gitlab_find_actions' with a search query to discover available operations.`
    );
  }

  if (isReadOnly() && entry.mutating) {
    throw new Error(
      `GitLab MCP server is running in read-only mode (GITLAB_READ_ONLY=true). Action '${actionName}' is a mutating operation and cannot be executed.`
    );
  }

  if (!entry.handler) {
    throw new Error(`Handler not implemented for action '${actionName}'`);
  }

  try {
    const rawResult = await entry.handler(params || {});
    const projected = projectOutput(rawResult);
    const finalResult = projected !== undefined ? projected : rawResult;
    const defaultFormat = process.env.MCP_OUTPUT_FORMAT === "json" ? "json" : "markdown";
    const requestedFormat = options.format || (params && params.format) || defaultFormat;
    if (requestedFormat === "markdown") {
      return jsonToMarkdown(finalResult, actionName);
    }
    return finalResult;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      throw new Error(
        `Invalid parameters for '${actionName}': ${issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw error;
  }
}

/**
 * Returns the 3 designated Eager Daily Driver tools
 */
export function getEagerTools() {
  const eagerNames = ["get_file_contents", "get_project", "get_commit"];
  return eagerNames
    .map((name) => CATALOG.get(name))
    .filter(Boolean)
    .map((entry) => ({
      name: entry.name,
      title: entry.title,
      description: entry.description,
      inputSchema: entry.inputSchema,
      annotations: entry.annotations,
      mutating: entry.mutating,
    }));
}

/**
 * Returns all tools across all domains (for full dump / legacy mode)
 */
export function getAllTools() {
  const available = isReadOnly()
    ? Array.from(CATALOG.values()).filter((t) => !t.mutating)
    : Array.from(CATALOG.values());

  return available.map((entry) => ({
    name: entry.name,
    title: entry.title,
    description: entry.description,
    inputSchema: entry.inputSchema,
    annotations: entry.annotations,
    mutating: entry.mutating,
  }));
}

export function getCatalogEntry(name) {
  return CATALOG.get(name);
}

export function getCatalogSize() {
  return CATALOG.size;
}
