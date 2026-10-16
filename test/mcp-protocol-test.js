import assert from "node:assert";
import http from "node:http";
import { spawn } from "node:child_process";
import { repositoryHandlers } from "../src/tools/repositories.js";

console.log("--- Testing MCP Protocol JSON-RPC ListTools & CallTool ---");

// Spin up local mock GitLab server for eager tool testing
const mockServer = http.createServer((req, res) => {
  if (req.url === "/api/v4/projects/123" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: 123,
        name: "test-repo",
        path_with_namespace: "group/test-repo",
        default_branch: "main",
        visibility: "internal",
        description: "Mock repository for eager tool testing",
        topics: ["mcp", "gitlab"],
        web_url: "https://gitlab.example.com/group/test-repo",
      })
    );
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "404 Not Found" }));
});

await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
const mockPort = mockServer.address().port;

const proc = spawn(process.execPath, ["index.js"], {
  env: {
    ...process.env,
    GITLAB_PERSONAL_ACCESS_TOKEN: "dummy-token",
    GITLAB_API_URL: `http://127.0.0.1:${mockPort}/api/v4`,
  },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";

function send(req) {
  proc.stdin.write(JSON.stringify(req) + "\n");
}

proc.stdout.on("data", async (data) => {
  buffer += data.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep last unfinished line

  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);

    if (msg.id === 1) {
      // Response to initialize
      console.log("[PASS] Received initialize response");
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    } else if (msg.id === 2) {
      // Response to tools/list
      console.log(`[PASS] Received tools/list response with ${msg.result.tools.length} tools`);
      assert.strictEqual(msg.result.tools.length, 5, `Expected exactly 5 tools, got ${msg.result.tools.length}`);

      const names = msg.result.tools.map((t) => t.name);
      console.log("       Exposed tools:", names.join(", "));
      assert(names.includes("gitlab_find_actions"), "Missing gitlab_find_actions");
      assert(names.includes("gitlab_execute_action"), "Missing gitlab_execute_action");
      assert(names.includes("get_file_contents"), "Missing get_file_contents");
      assert(names.includes("get_project"), "Missing get_project");
      assert(names.includes("get_commit"), "Missing get_commit");

      // Now test calling gitlab_find_actions (default format: markdown)
      send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "gitlab_find_actions",
          arguments: { query: "mirror" },
        },
      });
    } else if (msg.id === 3) {
      console.log("[PASS] Received tools/call response for gitlab_find_actions (default format: markdown)");
      const text = msg.result.content[0].text;
      assert(typeof text === "string", "Expected string markdown output");
      assert(text.includes("| Action | Domain | Mutating | Parameters (`*` = required) | Description |"), "Expected 5-column markdown table header with Parameters");
      assert(text.includes("`list_push_mirrors`"), "Expected list_push_mirrors in markdown table");
      assert(text.includes("`project_id*`"), "Expected required parameter project_id* in parameter signature");
      console.log("       Verified default markdown response format with 5 columns and parameter signatures");

      // Now test explicit format: 'json'
      send({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "gitlab_find_actions",
          arguments: { query: "mirror", format: "json" },
        },
      });
    } else if (msg.id === 4) {
      console.log("[PASS] Received tools/call response for gitlab_find_actions (format: json)");
      const content = JSON.parse(msg.result.content[0].text);
      console.log(`       Found ${content.total_matches} mirror actions`);
      assert(content.total_matches >= 2, "Expected mirror actions");

      // Test eager tool direct invocation over MCP stdio
      send({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "get_project",
          arguments: { project_id: 123 },
        },
      });
    } else if (msg.id === 5) {
      console.log("[PASS] Received tools/call response for eager tool get_project (default format: markdown)");
      const projectText = msg.result.content[0].text;
      assert(typeof projectText === "string", "Expected string markdown output for get_project");
      assert(projectText.startsWith("## Project: group/test-repo (ID: 123)"), "get_project must start cleanly with '## Project:'");
      assert(projectText.includes("- **Default Branch**: `main`"), "Must contain default branch");
      assert(projectText.includes("- **Topics**: mcp, gitlab"), "Must contain topics");
      assert(!projectText.includes("\\n"), "Must not contain double-escaped newlines");
      assert(!projectText.includes("content\":"), "Must not contain JSON-encoded content string");
      console.log("       Verified eager tool get_project cleanly formatted without double Markdown wrapping");

      // Test get_file_contents eliminates Base64 content inflation
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () =>
          new Response(
            JSON.stringify({
              file_name: "test.js",
              file_path: "src/test.js",
              size: 20,
              encoding: "base64",
              content_sha256: "sha256-hash-to-prune",
              blob_id: "blob-id-to-prune",
              execute_filemode: false,
              content: Buffer.from("console.log('hello');").toString("base64"),
            }),
            { status: 200 }
          );

        const fileRes = await repositoryHandlers.get_file_contents({
          project_id: 123,
          file_path: "src/test.js",
        });

        assert.strictEqual(fileRes.decoded_content, "console.log('hello');");
        assert.strictEqual(fileRes.content, undefined, "Base64 content property must be deleted to prevent 2.33x token inflation");
        assert.strictEqual(fileRes.content_sha256, undefined, "content_sha256 must be pruned");
        assert.strictEqual(fileRes.blob_id, undefined, "blob_id must be pruned");
        assert.strictEqual(fileRes.execute_filemode, undefined, "execute_filemode must be pruned");
        console.log("[PASS] get_file_contents verified: Base64 content and metadata stripped, decoded_content preserved");
      } finally {
        globalThis.fetch = originalFetch;
      }

      console.log("\nALL PROTOCOL CHECKS PASSED PERFECTLY!");
      mockServer.close();
      proc.kill();
      process.exit(0);
    }
  }
});

proc.on("error", (err) => {
  console.error("Process error:", err);
  process.exit(1);
});

// Start initialization
send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  },
});
