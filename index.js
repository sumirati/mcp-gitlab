#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { repositoryTools, repositoryHandlers } from "./src/tools/repositories.js";
import { issueTools, issueHandlers } from "./src/tools/issues.js";
import { milestoneTools, milestoneHandlers } from "./src/tools/milestones.js";
import { pipelineTools, pipelineHandlers } from "./src/tools/pipelines.js";
import { releaseTools, releaseHandlers } from "./src/tools/releases.js";
import { mergeRequestTools, mergeRequestHandlers } from "./src/tools/merge-requests.js";
import { wikiTools, wikiHandlers } from "./src/tools/wikis.js";
import { snippetTools, snippetHandlers } from "./src/tools/snippets.js";
import { userTools, userHandlers } from "./src/tools/user.js";
import { commitTools, commitHandlers } from "./src/tools/commits.js";

const TOOLS = [
  ...repositoryTools,
  ...issueTools,
  ...milestoneTools,
  ...pipelineTools,
  ...releaseTools,
  ...mergeRequestTools,
  ...wikiTools,
  ...snippetTools,
  ...userTools,
  ...commitTools,
];

const HANDLERS = {
  ...repositoryHandlers,
  ...issueHandlers,
  ...milestoneHandlers,
  ...pipelineHandlers,
  ...releaseHandlers,
  ...mergeRequestHandlers,
  ...wikiHandlers,
  ...snippetHandlers,
  ...userHandlers,
  ...commitHandlers,
};

const server = new Server(
  {
    name: "@sumirati/mcp-gitlab",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = HANDLERS[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
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
  console.error("GitLab MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
