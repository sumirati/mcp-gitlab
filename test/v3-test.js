import assert from "node:assert";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  findActions,
  executeAction,
  getEagerTools,
  getAllTools,
  getCatalogSize,
  getCatalogEntry,
} from "../src/catalog.js";

console.log("--- Starting v3.0.0 Architecture Validation ---");

// 1. Catalog count check
const catalogSize = getCatalogSize();
console.log(`[PASS] Total actions in catalog: ${catalogSize}`);
assert(catalogSize >= 80, `Expected at least 80 actions, found ${catalogSize}`);

// 2. Eager tools check
const eagerTools = getEagerTools();
console.log(`[PASS] Eager tools count: ${eagerTools.length}`);
assert.strictEqual(eagerTools.length, 3, "Expected exactly 3 eager tools");
const eagerNames = eagerTools.map((t) => t.name).sort();
assert.deepStrictEqual(eagerNames, ["get_commit", "get_file_contents", "get_project"]);
console.log("       Eager tools:", eagerNames.join(", "));

// 3. Find actions - runner search
const runnerResults = findActions({ query: "runner", format: "json" });
console.log(`[PASS] findActions('runner', format: 'json') returned ${runnerResults.total_matches} matches`);
assert(runnerResults.total_matches >= 2, "Expected at least 2 runner actions");
const runnerActions = runnerResults.actions.map((a) => a.action);
assert(runnerActions.includes("list_runners"), "Missing list_runners");
assert(runnerActions.includes("get_runner_status"), "Missing get_runner_status");
console.log("       Runner actions found:", runnerActions.join(", "));

// 4. Find actions - mirror search
const mirrorResults = findActions({ query: "mirror", format: "json" });
console.log(`[PASS] findActions('mirror', format: 'json') returned ${mirrorResults.total_matches} matches`);
assert(mirrorResults.total_matches >= 2, "Expected at least 2 mirror actions");
const mirrorActions = mirrorResults.actions.map((a) => a.action);
assert(mirrorActions.includes("list_push_mirrors"), "Missing list_push_mirrors");
assert(mirrorActions.includes("trigger_push_mirror_sync"), "Missing trigger_push_mirror_sync");
console.log("       Mirror actions found:", mirrorActions.join(", "));

// 5. Find actions - domain filtering
const mrDomainResults = findActions({ domain: "mr", format: "json" });
console.log(`[PASS] findActions(domain: 'mr', format: 'json') returned ${mrDomainResults.total_matches} actions`);
assert(mrDomainResults.total_matches > 5, "Expected merge request actions");

// 6. Parameter summary formatting
const triggerSync = mirrorResults.actions.find((a) => a.action === "trigger_push_mirror_sync");
assert(triggerSync, "trigger_push_mirror_sync should be in search results");
console.log("[PASS] Compact parameter schema for trigger_push_mirror_sync:");
console.log(JSON.stringify(triggerSync.parameters, null, 2));
assert(triggerSync.parameters.properties.mirror_id, "mirror_id property should be present");
assert(triggerSync.parameters.properties.project_id, "project_id property should be present");

// 7. Unknown action error handling
let caughtUnknown = false;
try {
  await executeAction("non_existent_action_xyz", {});
} catch (err) {
  caughtUnknown = true;
  assert(err.message.includes("gitlab_find_actions"), "Error should recommend gitlab_find_actions");
}
assert(caughtUnknown, "Should throw on unknown action");
console.log("[PASS] Unknown action error gracefully guides LLM to gitlab_find_actions");

// 8. Protected branches action discovery
const pbResults = findActions({ query: "protect", format: "json" });
console.log(`[PASS] findActions('protect', format: 'json') returned ${pbResults.total_matches} matches`);
const pbActions = pbResults.actions.map((a) => a.action);
assert(pbActions.includes("list_protected_branches"), "Missing list_protected_branches");
assert(pbActions.includes("protect_branch"), "Missing protect_branch");
assert(pbActions.includes("unprotect_branch"), "Missing unprotect_branch");
console.log("       Protected branch actions found:", pbActions.join(", "));

// 9. Enterprise system health check discovery
const healthResults = findActions({ query: "system_health_check", format: "json" });
console.log(`[PASS] findActions('system_health_check', format: 'json') returned ${healthResults.total_matches} matches`);
assert(healthResults.total_matches >= 1, "Missing system_health_check");

// 9b. Group management action discovery
const groupResults = findActions({ query: "create_group", format: "json" });
console.log(`[PASS] findActions('create_group', format: 'json') returned ${groupResults.total_matches} matches`);
assert(groupResults.actions.map((a) => a.action).includes("create_group"), "Missing create_group");
assert.strictEqual(groupResults.actions[0].mutating, true, "create_group must be marked mutating");

// 9c. Multi-file atomic commit action discovery (create_commit & push_files)
const commitActionResults = findActions({ query: "create_commit", format: "json" });
console.log(`[PASS] findActions('create_commit', format: 'json') returned ${commitActionResults.total_matches} matches`);
assert(commitActionResults.actions.map((a) => a.action).includes("create_commit"), "Missing create_commit");
assert.strictEqual(commitActionResults.actions[0].mutating, true, "create_commit must be marked mutating");
const pushActionResults = findActions({ query: "push_files", format: "json" });
assert(pushActionResults.actions.map((a) => a.action).includes("push_files"), "Missing push_files");
assert.strictEqual(pushActionResults.actions[0].mutating, true, "push_files must be marked mutating");
console.log("[PASS] Atomic multi-file commit actions (create_commit & push_files) verified in catalog");

// 10. Smart format: default markdown output support
const mdResults = findActions({ query: "runner" }); // default is markdown
assert(typeof mdResults === "string", "Expected default markdown output string");
assert(mdResults.includes("| Action | Domain | Mutating | Description |"), "Expected markdown table header");
assert(mdResults.includes("`list_runners`"), "Expected list_runners in markdown table");
console.log("[PASS] findActions default format: 'markdown' rendered valid Markdown table");

// 10b. High-density Markdown domain formatters validation (85-90% token reduction)
import {
  jsonToMarkdown,
  formatIssuesMarkdown,
  formatMergeRequestsMarkdown,
  formatPipelinesMarkdown,
} from "../src/helpers.js";

const sampleIssues = [
  {
    iid: 14,
    title: "Implement OAuth2 provider",
    state: "opened",
    author: "dev1",
    assignees: ["dev2"],
    milestone: { title: "v3.2" },
    labels: ["security", "backend"],
  },
];
const issueMd = jsonToMarkdown(sampleIssues, "list_issues");
assert(issueMd.includes("| IID | Title | State | Author | Assignees | Milestone | Labels |"), "Expected issue table header");
assert(issueMd.includes("#14"), "Expected #14 in issue markdown");
assert(issueMd.includes("@dev1"), "Expected @dev1 author");
assert(issueMd.includes("security, backend"), "Expected combined labels");
console.log("[PASS] High-density formatIssuesMarkdown rendered clean 7-column table");

const sampleMRs = [
  {
    iid: 42,
    title: "Add token economy formatters",
    draft: true,
    state: "opened",
    source_branch: "feat/token-economy",
    target_branch: "main",
    author: "sumirati",
    detailed_merge_status: "mergeable",
  },
];
const mrMd = jsonToMarkdown(sampleMRs, "list_merge_requests");
assert(mrMd.includes("| !MR | Title | State | Branch | Author | Status |"), "Expected MR table header");
assert(mrMd.includes("!42"), "Expected !42 in MR markdown");
assert(mrMd.includes("[Draft] Add token economy formatters"), "Expected [Draft] prefix");
assert(mrMd.includes("feat/token-economy -> main"), "Expected branch routing");
console.log("[PASS] High-density formatMergeRequestsMarkdown rendered clean 6-column table");

const samplePipelines = [
  {
    id: 991,
    status: "success",
    ref: "main",
    sha: "a1b2c3d4",
    source: "push",
    created_at: "2026-10-16T12:00:00Z",
  },
];
const pipeMd = jsonToMarkdown(samplePipelines, "list_pipelines");
assert(pipeMd.includes("| ID | Status | Ref | SHA | Source | Created |"), "Expected pipeline table header");
assert(pipeMd.includes("991"), "Expected pipeline 991 in table");
assert(pipeMd.includes("2026-10-16"), "Expected formatted date");
console.log("[PASS] High-density formatPipelinesMarkdown rendered clean 6-column table");

// 10c. Smart Diff & Lockfile Truncation + Conservative Pagination (Proposals A & B)
import { isLockfile } from "../src/helpers.js";
import { ListCommitsSchema } from "../src/tools/commits.js";
import { ListMergeRequestsSchema } from "../src/tools/merge-requests.js";

assert.strictEqual(isLockfile("package-lock.json"), true);
assert.strictEqual(isLockfile("subdir/yarn.lock"), true);
assert.strictEqual(isLockfile("go.sum"), true);
assert.strictEqual(isLockfile("bundle.min.js"), true);
assert.strictEqual(isLockfile("src/main.js"), false);

const commitParsed = ListCommitsSchema.parse({ project_id: "test" });
assert.strictEqual(commitParsed.per_page, 10, "Default per_page must be 10 for commits");
const mrParsed = ListMergeRequestsSchema.parse({ project_id: "test" });
assert.strictEqual(mrParsed.per_page, 10, "Default per_page must be 10 for merge requests");
console.log("[PASS] Smart diff lockfile recognition and default per_page: 10 verified");

// 11. Registry metadata & server.json validation
const serverJson = JSON.parse(fs.readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const pkgJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.strictEqual(serverJson.version, pkgJson.version, `server.json version (${serverJson.version}) must match package.json (${pkgJson.version})`);
assert.strictEqual(serverJson.packages?.[0]?.version, pkgJson.version, `server.json package version must match package.json (${pkgJson.version})`);
assert.ok(serverJson.description.length <= 100, `server.json description length (${serverJson.description.length} chars) must be <= 100 chars`);
console.log(`[PASS] server.json schema & version parity verified (v${serverJson.version}, desc: ${serverJson.description.length} chars)`);

const hasPublisher = spawnSync("which", ["mcp-publisher"]).status === 0 || fs.existsSync(`${process.env.HOME}/bin/mcp-publisher`);
if (hasPublisher) {
  const pubCmd = spawnSync("which", ["mcp-publisher"]).status === 0 ? "mcp-publisher" : `${process.env.HOME}/bin/mcp-publisher`;
  const pubCheck = spawnSync(pubCmd, ["validate"], { stdio: "pipe", encoding: "utf8" });
  if (pubCheck.status === 0) {
    console.log("[PASS] mcp-publisher validate passed against official MCP registry");
  } else {
    throw new Error(`mcp-publisher validate failed:\n${pubCheck.stderr || pubCheck.stdout}`);
  }
} else {
  console.log("[SKIP] mcp-publisher not found in PATH, skipping live remote registry check");
}

console.log("\nALL v3.1.0 CHECKS PASSED SUCCESSFULLY!");
