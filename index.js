#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { isReadOnly } from "./src/client.js";
import { zodToJsonSchema } from "./src/schemas.js";
import {
  findActions,
  executeAction,
  getEagerTools,
  getAllTools,
  getCatalogSize,
} from "./src/catalog.js";

const FindActionsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Search keywords to find operations (e.g. 'merge request', 'pipeline', 'runner', 'mirror', 'release', 'branch', 'job trace')"
    ),
  domain: z
    .enum([
      "repositories",
      "branches",
      "commits",
      "members",
      "variables",
      "issues",
      "milestones",
      "pipelines",
      "releases",
      "merge-requests",
      "wikis",
      "snippets",
      "user",
      "enterprise",
    ])
    .optional()
    .describe("Optional domain to scope the search"),
  page: z.number().optional().default(1).describe("Page number for paginated action results (default: 1)"),
  per_page: z.number().optional().default(15).describe("Number of actions per page (default: 15)"),
});

const ExecuteActionSchema = z.object({
  action: z
    .string()
    .describe(
      "The exact GitLab action name to execute (e.g. 'create_merge_request', 'list_pipelines', 'trigger_push_mirror_sync')"
    ),
  parameters: z
    .record(z.any())
    .optional()
    .default({})
    .describe("Key-value parameters for the designated action (as discovered from gitlab_find_actions)"),
});

const META_TOOLS = [
  {
    name: "gitlab_find_actions",
    title: "Find GitLab Actions",
    description:
      "Search and discover available GitLab operations on-demand across the entire platform. Returns matching action names, purpose descriptions, and parameter schemas for use with 'gitlab_execute_action'. Keeps prompt context minimal (<500 tokens) while retaining 100% coverage.",
    inputSchema: zodToJsonSchema(FindActionsSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "gitlab_execute_action",
    title: "Execute GitLab Action",
    description:
      "Execute any discovered GitLab platform action with input validation and token-optimized response projection. Dispatches directly to the corresponding API endpoint while enforcing read-only safety restrictions.",
    inputSchema: zodToJsonSchema(ExecuteActionSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];

function shouldExposeAllTools() {
  return (
    process.env.GITLAB_EXPOSE_ALL_TOOLS === "true" ||
    process.env.GITLAB_EXPOSE_LEGACY_TOOLS === "true"
  );
}

function formatResult(result) {
  if (result && Array.isArray(result.content)) {
    return result;
  }
  return {
    content: [
      {
        type: "text",
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
      },
    ],
  };
}

const server = new Server(
  {
    name: "@sumirati/mcp-gitlab",
    version: "3.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (shouldExposeAllTools()) {
    return { tools: getAllTools() };
  }

  // Modern 2026 5-Tool Hybrid Surface: 2 Meta Tools + 3 Eager Daily Drivers
  const eagerTools = getEagerTools();
  return {
    tools: [...META_TOOLS, ...eagerTools],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "gitlab_find_actions") {
      const parsed = FindActionsSchema.parse(args || {});
      const result = findActions(parsed);
      return formatResult(result);
    }

    if (name === "gitlab_execute_action") {
      const parsed = ExecuteActionSchema.parse(args || {});
      const result = await executeAction(parsed.action, parsed.parameters || {});
      return formatResult(result);
    }

    // Direct invocation: handles eager tools AND graceful fallback if any catalog action is called directly
    const result = await executeAction(name, args || {});
    return formatResult(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments for '${name}': ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw error;
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const modeStr = isReadOnly() ? " [READ-ONLY MODE: mutating tools disabled]" : "";
  const legacyStr = shouldExposeAllTools() ? " [LEGACY MODE: all tools exposed]" : " [HYBRID 5-TOOL MODE]";
  console.error(
    `GitLab MCP Server v3.0.1 running on stdio (${getCatalogSize()} actions in catalog)${modeStr}${legacyStr}`
  );
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
