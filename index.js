#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { isReadOnly } from "./src/client.js";
import { repositoryTools, repositoryHandlers } from "./src/tools/repositories.js";
import { branchTools, branchHandlers } from "./src/tools/branches.js";
import { memberTools, memberHandlers } from "./src/tools/members.js";
import { variableTools, variableHandlers } from "./src/tools/variables.js";
import { issueTools, issueHandlers } from "./src/tools/issues.js";
import { milestoneTools, milestoneHandlers } from "./src/tools/milestones.js";
import { pipelineTools, pipelineHandlers } from "./src/tools/pipelines.js";
import { releaseTools, releaseHandlers } from "./src/tools/releases.js";
import { mergeRequestTools, mergeRequestHandlers } from "./src/tools/merge-requests.js";
import { wikiTools, wikiHandlers } from "./src/tools/wikis.js";
import { snippetTools, snippetHandlers } from "./src/tools/snippets.js";
import { userTools, userHandlers } from "./src/tools/user.js";
import { commitTools, commitHandlers } from "./src/tools/commits.js";

const DOMAIN_MODULES = {
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
};

const DOMAIN_ALIASES = {
  mr: "merge-requests",
  merge_requests: "merge-requests",
  repos: "repositories",
  ci: "pipelines",
};

export function getActiveDomains() {
  const envDomains = process.env.GITLAB_TOOL_DOMAINS;
  if (!envDomains || envDomains.trim() === "" || envDomains.trim() === "*") {
    return Object.keys(DOMAIN_MODULES);
  }
  const requested = envDomains
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .map((d) => DOMAIN_ALIASES[d] || d);
  const active = requested.filter((d) => Boolean(DOMAIN_MODULES[d]));
  return active.length > 0 ? active : Object.keys(DOMAIN_MODULES);
}

const activeDomains = getActiveDomains();
const TOOLS = activeDomains.flatMap((d) => DOMAIN_MODULES[d].tools);
const HANDLERS = Object.assign(
  {},
  ...activeDomains.map((d) => DOMAIN_MODULES[d].handlers)
);

const server = new Server(
  {
    name: "@sumirati/mcp-gitlab",
    version: "2.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const availableTools = isReadOnly() ? TOOLS.filter((t) => !t.mutating) : TOOLS;
  return {
    tools: availableTools.map(({ mutating, ...tool }) => ({
      ...tool,
      title:
        tool.title ||
        tool.name
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      annotations: {
        readOnlyHint: !mutating,
        destructiveHint: tool.name.startsWith("delete_") || tool.name.startsWith("remove_"),
        idempotentHint: !mutating,
        openWorldHint: false,
        ...(tool.annotations || {}),
      },
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolDef = TOOLS.find((t) => t.name === name);
  if (!toolDef) {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (isReadOnly() && toolDef.mutating) {
    throw new Error(
      `GitLab MCP server is running in read-only mode (GITLAB_READ_ONLY=true). Tool '${name}' is a mutating operation and cannot be executed.`
    );
  }

  const handler = HANDLERS[name];
  if (!handler) {
    throw new Error(`Unknown tool handler: ${name}`);
  }

  try {
    return await handler(args || {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw error;
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const modeStr = isReadOnly() ? " [READ-ONLY MODE: mutating tools disabled]" : "";
  const domainFilterStr = process.env.GITLAB_TOOL_DOMAINS
    ? ` [DOMAINS: ${activeDomains.join(",")}]`
    : "";
  console.error(`GitLab MCP Server v2.1.0 running on stdio (${TOOLS.length} tools registered)${modeStr}${domainFilterStr}`);
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
