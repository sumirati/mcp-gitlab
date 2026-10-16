import assert from "node:assert";
import {
  executeAction,
  getEagerTools,
  getAllTools,
} from "../src/catalog.js";
import { zodToJsonSchema } from "../src/schemas.js";
import { z } from "zod";
import {
  GITLAB_V4_PROJECT,
  GITLAB_V4_ISSUES_LIST,
  GITLAB_V4_MERGE_REQUESTS_LIST,
  GITLAB_V4_PIPELINES_LIST,
  GITLAB_V4_FILE_CONTENTS,
  GITLAB_V4_MR_CHANGES,
} from "./fixtures/gitlab-api-v4-fixtures.js";

function estimateTokens(payload) {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  return Math.ceil(Buffer.byteLength(str, "utf8") / 4);
}

console.log("--- Starting @sumirati/mcp-gitlab Reproducible Token Economy Benchmark ---");

// 0. Verify fixtures contain zero GitHub API artifacts
const fixtureDump = JSON.stringify({
  GITLAB_V4_PROJECT,
  GITLAB_V4_ISSUES_LIST,
  GITLAB_V4_MERGE_REQUESTS_LIST,
  GITLAB_V4_PIPELINES_LIST,
  GITLAB_V4_FILE_CONTENTS,
  GITLAB_V4_MR_CHANGES,
});
for (const forbidden of ["node_id", "gravatar_id", "site_admin", "html_url", "api.github.com", "followers_url", "repos_url"]) {
  assert(
    !fixtureDump.includes(forbidden),
    `Fixture contamination error: GitHub field '${forbidden}' found in GitLab v4 fixtures`
  );
}

// 1. System Prompt Tax Benchmark (5-Tool Hybrid Surface vs All 90 Tools)
const allTools = getAllTools();
const eagerTools = getEagerTools();
const metaSchemas = [
  {
    name: "gitlab_find_actions",
    description: "Search and discover available GitLab operations on-demand across the entire platform.",
    inputSchema: zodToJsonSchema(
      z.object({
        query: z.string().optional(),
        domain: z.string().optional(),
        page: z.number().optional(),
        per_page: z.number().optional(),
        format: z.enum(["json", "markdown"]).optional(),
      })
    ),
  },
  {
    name: "gitlab_execute_action",
    description: "Execute any discovered GitLab platform action with input validation and token-optimized response projection.",
    inputSchema: zodToJsonSchema(
      z.object({
        action: z.string(),
        parameters: z.record(z.any()).optional(),
        format: z.enum(["json", "markdown"]).optional(),
      })
    ),
  },
];
const hybridSurface = [...metaSchemas, ...eagerTools];

const legacyTokens = estimateTokens(allTools);
const hybridTokens = estimateTokens(hybridSurface);
const promptSavingsPct = (((legacyTokens - hybridTokens) / legacyTokens) * 100).toFixed(1);

// 2. Runtime Payload Benchmarks via executeAction() with mocked fetch
const originalFetch = globalThis.fetch;
const rows = [];

try {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/repository/files/")) {
      return new Response(JSON.stringify(structuredClone(GITLAB_V4_FILE_CONTENTS)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.includes("/merge_requests/180/changes")) {
      return new Response(JSON.stringify(structuredClone(GITLAB_V4_MR_CHANGES)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.includes("/merge_requests")) {
      return new Response(JSON.stringify(structuredClone(GITLAB_V4_MERGE_REQUESTS_LIST)), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "X-Total": "10",
          "X-Total-Pages": "1",
          "X-Page": "1",
          "X-Per-Page": "10",
        },
      });
    }
    if (u.includes("/issues")) {
      return new Response(JSON.stringify(structuredClone(GITLAB_V4_ISSUES_LIST)), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "X-Total": "10",
          "X-Total-Pages": "1",
          "X-Page": "1",
          "X-Per-Page": "10",
        },
      });
    }
    if (u.includes("/pipelines")) {
      return new Response(JSON.stringify(structuredClone(GITLAB_V4_PIPELINES_LIST)), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "X-Total": "10",
          "X-Total-Pages": "1",
          "X-Page": "1",
          "X-Per-Page": "10",
        },
      });
    }
    if (u.includes("/projects/278964")) {
      return new Response(JSON.stringify(structuredClone(GITLAB_V4_PROJECT)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected benchmark URL: ${u}`);
  };

  const scenarios = [
    {
      label: "get_project (Single project inspect)",
      action: "get_project",
      params: { project_id: 278964 },
      raw: GITLAB_V4_PROJECT,
    },
    {
      label: "list_issues (10 issues with v4 metadata)",
      action: "list_issues",
      params: { project_id: 278964, per_page: 10 },
      raw: GITLAB_V4_ISSUES_LIST,
    },
    {
      label: "list_merge_requests (10 MRs with v4 metadata)",
      action: "list_merge_requests",
      params: { project_id: 278964, per_page: 10 },
      raw: GITLAB_V4_MERGE_REQUESTS_LIST,
    },
    {
      label: "list_pipelines (10 runs)",
      action: "list_pipelines",
      params: { project_id: 278964, per_page: 10 },
      raw: GITLAB_V4_PIPELINES_LIST,
    },
    {
      label: "get_file_contents (Source file, Base64 stripped)",
      action: "get_file_contents",
      params: { project_id: 278964, file_path: "src/repository-service.js" },
      raw: GITLAB_V4_FILE_CONTENTS,
    },
    {
      label: "get_merge_request_changes (Code + lockfile diff)",
      action: "get_merge_request_changes",
      params: { project_id: 278964, merge_request_iid: 180 },
      raw: GITLAB_V4_MR_CHANGES,
    },
  ];

  rows.push({
    operation: `System Prompt Tax (5 tools vs ${allTools.length} actions)`,
    rawTokens: legacyTokens,
    jsonTokens: "-",
    mdTokens: hybridTokens,
    savingsPct: `${promptSavingsPct}%`,
  });

  for (const s of scenarios) {
    const rawTokens = estimateTokens(s.raw);
    const jsonOut = await executeAction(s.action, s.params, { format: "json" });
    const mdOut = await executeAction(s.action, s.params, { format: "markdown" });

    // Verify get_file_contents never leaks raw base64 content alongside decoded_content
    if (s.action === "get_file_contents") {
      assert.strictEqual(jsonOut.content, undefined, "Raw base64 content must be deleted after decoding");
      assert(typeof jsonOut.decoded_content === "string" && jsonOut.decoded_content.length > 0, "decoded_content must be present");
    }

    const jsonTokens = estimateTokens(jsonOut);
    const mdTokens = estimateTokens(mdOut);
    const savingsPct = (((rawTokens - mdTokens) / rawTokens) * 100).toFixed(1);

    assert(
      jsonTokens < rawTokens,
      `Expected JSON projection (${jsonTokens}) < raw (${rawTokens}) for ${s.action}`
    );
    assert(
      mdTokens < rawTokens,
      `Expected Markdown output (${mdTokens}) < raw (${rawTokens}) for ${s.action}`
    );

    rows.push({
      operation: s.label,
      rawTokens,
      jsonTokens,
      mdTokens,
      savingsPct: `${savingsPct}%`,
    });
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("\n| Operation | Raw GitLab API v4 | @sumirati/mcp-gitlab (JSON) | @sumirati/mcp-gitlab (Markdown) | Token Reduction (MD) |");
console.log("| :--- | :---: | :---: | :---: | :---: |");
for (const r of rows) {
  console.log(
    `| ${r.operation} | ${r.rawTokens} tokens | ${r.jsonTokens === "-" ? "—" : `${r.jsonTokens} tokens`} | **${r.mdTokens} tokens** | **${r.savingsPct} savings** |`
  );
}
console.log("\n[PASS] All GitLab REST API v4 token economy benchmarks verified deterministically!");
