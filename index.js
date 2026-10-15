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

const TOOLS = [
  ...repositoryTools,
  ...branchTools,
  ...memberTools,
  ...variableTools,
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
  ...branchHandlers,
  ...memberHandlers,
  ...variableHandlers,
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
  const availableTools = isReadOnly() ? TOOLS.filter((t) => !t.mutating) : TOOLS;
  return {
    tools: availableTools.map(({ mutating, ...tool }) => tool),
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
  if (isReadOnly()) {
    console.error("GitLab MCP Server running on stdio [READ-ONLY MODE: mutating tools disabled]");
  } else {
    console.error("GitLab MCP Server running on stdio");
  }
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
