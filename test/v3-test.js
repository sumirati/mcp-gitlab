import assert from "node:assert";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  ACTION_CATALOG,
  findActions,
  executeAction,
  getEagerTools,
  getAllTools,
  getCatalogSize,
} from "../src/catalog.js";
import {
  jsonToMarkdown,
  isLockfile,
  ACTION_FORMATTERS,
} from "../src/helpers.js";
import { ListCommitsSchema } from "../src/tools/commits.js";
import { ListMergeRequestsSchema } from "../src/tools/merge-requests.js";
import { syncReadme } from "../scripts/gen-docs.js";

console.log("--- Starting @sumirati/mcp-gitlab v3.2.0 Architecture Validation ---");

// 1. Catalog count check (exact: 90 actions across 14 domains)
const catalogSize = getCatalogSize();
console.log(`[PASS] Total actions in catalog: ${catalogSize}`);
assert.strictEqual(catalogSize, 90, `Expected exactly 90 actions, found ${catalogSize}`);

const emptyOverview = findActions({ format: "json" });
assert.strictEqual(Object.keys(emptyOverview.available_domains).length, 14, "Expected exactly 14 domains");

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
assert.strictEqual(mrDomainResults.total_matches, 12, "Expected 12 merge request actions");

// 5b. Pipeline actions including cancel_pipeline and retry_pipeline
const pipeDomainResults = findActions({ domain: "pipelines", format: "json" });
assert.strictEqual(pipeDomainResults.total_matches, 10, "Expected 10 pipeline actions");
const pipeActionNames = pipeDomainResults.actions.map((a) => a.action);
assert(pipeActionNames.includes("cancel_pipeline"), "Missing cancel_pipeline");
assert(pipeActionNames.includes("retry_pipeline"), "Missing retry_pipeline");

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

// 10. Smart format: default markdown output support with 5-column Parameters signature
const mdResults = findActions({ query: "runner" }); // default is markdown
assert(typeof mdResults === "string", "Expected default markdown output string");
assert(mdResults.includes("| Action | Domain | Mutating | Parameters (`*` = required) | Description |"), "Expected 5-column markdown table header with Parameters");
assert(mdResults.includes("`list_runners`"), "Expected list_runners in markdown table");
assert(mdResults.includes("`runner_id*`"), "Expected required parameter signature in markdown table");
console.log("[PASS] findActions default format: 'markdown' rendered valid 5-column Markdown table with parameter signatures");

// 10b. High-density Markdown domain formatters validation
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

// 10c. Smart Diff & Lockfile Truncation + Conservative Pagination
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

// 12. End-to-End executeAction() Runtime Verification (cancel_pipeline, retry_pipeline, get_file_contents dir & file, push_files delete/move, update_project topics, get_merge_request_changes diff_refs, get_group with_projects)
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    const method = (options.method || "GET").toUpperCase();

    if (u.endsWith("/projects/31/pipelines/555/cancel") && method === "POST") {
      return new Response(JSON.stringify({ id: 555, iid: 12, status: "canceled", ref: "main", sha: "abcdef123456", web_url: "https://gitlab.example.com/p/-/pipelines/555" }), { status: 200 });
    }
    if (u.endsWith("/projects/31/pipelines/555/retry") && method === "POST") {
      return new Response(JSON.stringify({ id: 555, iid: 12, status: "running", ref: "main", sha: "abcdef123456", web_url: "https://gitlab.example.com/p/-/pipelines/555" }), { status: 200 });
    }
    if (u.includes("/projects/31/repository/files/src") && method === "GET") {
      return new Response(JSON.stringify({ message: "404 File Not Found" }), { status: 404, statusText: "Not Found" });
    }
    if (u.includes("/projects/31/repository/tree") && method === "GET") {
      return new Response(
        JSON.stringify([
          { id: "111", name: "index.js", type: "blob", path: "src/index.js", mode: "100644" },
          { id: "222", name: "tools", type: "tree", path: "src/tools", mode: "040000" },
        ]),
        { status: 200 }
      );
    }
    if (u.endsWith("/projects/31/repository/commits") && method === "POST") {
      const body = JSON.parse(options.body);
      assert.strictEqual(body.actions[0].action, "delete");
      assert.strictEqual(body.actions[1].action, "move");
      assert.strictEqual(body.actions[1].previous_path, "old/location.js");
      return new Response(
        JSON.stringify({
          id: "998877665544332211",
          short_id: "99887766",
          title: body.commit_message,
          author_name: "Developer",
          authored_date: "2026-10-16T00:00:00Z",
          web_url: "https://gitlab.example.com/p/-/commit/99887766",
        }),
        { status: 201 }
      );
    }
    if (u.endsWith("/projects/31") && method === "PUT") {
      const body = JSON.parse(options.body);
      assert(Array.isArray(body.topics), "update_project must send topics as JSON array of strings, not comma-joined string");
      return new Response(
        JSON.stringify({
          id: 31,
          name: "demo",
          path_with_namespace: "group/demo",
          topics: body.topics,
          default_branch: "main",
          visibility: "internal",
        }),
        { status: 200 }
      );
    }
    if (u.endsWith("/projects/31/merge_requests/7/changes") && method === "GET") {
      return new Response(
        JSON.stringify({
          iid: 7,
          title: "Refactor auth",
          source_branch: "feat/auth",
          target_branch: "main",
          diff_refs: { base_sha: "aaa", start_sha: "bbb", head_sha: "ccc" },
          changes_count: "1",
          changes: [{ old_path: "src/a.js", new_path: "src/a.js", new_file: false, renamed_file: false, deleted_file: false, diff: "@@ -1 +1 @@\n-a\n+b" }],
        }),
        { status: 200 }
      );
    }
    if (u.includes("/groups/buggycode?with_projects=false") && method === "GET") {
      return new Response(JSON.stringify({ id: 3, name: "Buggycode", path: "buggycode", full_path: "buggycode", visibility: "internal" }), { status: 200 });
    }
    if (u.includes("/groups/buggycode?with_projects=true") && method === "GET") {
      return new Response(
        JSON.stringify({
          id: 3,
          name: "Buggycode",
          path: "buggycode",
          full_path: "buggycode",
          visibility: "internal",
          projects: [{ id: 42, name: "proj1", path_with_namespace: "buggycode/proj1", default_branch: "main", visibility: "internal" }],
        }),
        { status: 200 }
      );
    }
    if (u.includes("/projects/31/protected_branches") && method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: 1,
            name: "main",
            push_access_levels: [{ access_level: 40, access_level_description: "Maintainers" }],
            merge_access_levels: [{ access_level: 30, access_level_description: "Developers + Maintainers" }],
            allow_force_push: false,
            code_owner_approval_required: true,
          },
        ]),
        { status: 200 }
      );
    }
    if (u.includes("/projects/31/issues/14") && method === "GET") {
      return new Response(
        JSON.stringify({
          id: 1014,
          iid: 14,
          project_id: 31,
          title: "Implement auth token rotation",
          description: "Full description of auth token rotation requirements.",
          state: "opened",
          created_at: "2026-10-15T10:00:00Z",
          updated_at: "2026-10-15T11:00:00Z",
          labels: ["security", "backend"],
          assignees: [{ id: 7, username: "dev1", name: "Developer 1" }],
          author: { id: 1, username: "admin", name: "Admin User" },
          web_url: "https://gitlab.example.com/group/demo/-/issues/14",
          time_stats: { time_estimate: 3600, total_time_spent: 1800 },
          task_completion_status: { count: 3, completed_count: 1 },
          references: { short: "#14", relative: "#14", full: "group/demo#14" },
          user_notes_count: 5,
          _links: { self: "https://gitlab.example.com/api/v4/projects/31/issues/14" },
        }),
        { status: 200 }
      );
    }
    if (u.includes("/projects/31/pipelines/777") && method === "GET") {
      return new Response(
        JSON.stringify({
          id: 777,
          iid: 42,
          project_id: 31,
          status: "success",
          ref: "main",
          sha: "1122334455667788",
          source: "push",
          created_at: "2026-10-15T12:00:00Z",
          updated_at: "2026-10-15T12:05:00Z",
          duration: 300,
          queued_duration: 15,
          user: { id: 1, username: "admin" },
          web_url: "https://gitlab.example.com/group/demo/-/pipelines/777",
          before_sha: "0000000000000000",
          yaml_errors: null,
          _links: { self: "https://gitlab.example.com/api/v4/projects/31/pipelines/777" },
        }),
        { status: 200 }
      );
    }
    throw new Error(`Unexpected fetch in v3-test: ${method} ${u}`);
  };

  const canceled = await executeAction("cancel_pipeline", { project_id: 31, pipeline_id: 555 }, { format: "json" });
  assert.strictEqual(canceled.status, "canceled");

  const retried = await executeAction("retry_pipeline", { project_id: 31, pipeline_id: 555 }, { format: "json" });
  assert.strictEqual(retried.status, "running");

  const dirTree = await executeAction("get_file_contents", { project_id: 31, file_path: "src" }, { format: "json" });
  assert.strictEqual(dirTree.type, "directory");
  assert.strictEqual(dirTree.entries.length, 2);

  const commitRes = await executeAction(
    "push_files",
    {
      project_id: 31,
      branch: "main",
      commit_message: "Delete and move files",
      files: [
        { file_path: "obsolete.js", action: "delete" },
        { file_path: "new/location.js", previous_path: "old/location.js", action: "move" },
      ],
    },
    { format: "json" }
  );
  assert.strictEqual(commitRes.short_id, "99887766");

  const updatedProj = await executeAction("update_project", { project_id: 31, topics: ["gitlab", "mcp"] }, { format: "json" });
  assert.deepStrictEqual(updatedProj.topics, ["gitlab", "mcp"]);

  const mrChanges = await executeAction("get_merge_request_changes", { project_id: 31, merge_request_iid: 7 }, { format: "json" });
  assert.deepStrictEqual(mrChanges.diff_refs, { base_sha: "aaa", start_sha: "bbb", head_sha: "ccc" });

  const grp = await executeAction("get_group", { group_id: "buggycode" }, { format: "json" });
  assert.strictEqual(grp.full_path, "buggycode");
  assert.strictEqual(grp.projects, undefined);

  const grpWithProjects = await executeAction("get_group", { group_id: "buggycode", with_projects: true }, { format: "json" });
  assert.strictEqual(grpWithProjects.full_path, "buggycode");
  assert.strictEqual(grpWithProjects.projects.length, 1);
  assert.strictEqual(grpWithProjects.projects[0].path_with_namespace, "buggycode/proj1");

  const pbMarkdown = await executeAction("list_protected_branches", { project_id: 31 }, { format: "markdown" });
  assert(pbMarkdown && typeof pbMarkdown === "string", "list_protected_branches markdown must return a string");
  assert(pbMarkdown.includes("Branch / Pattern"), "list_protected_branches markdown missing header 'Branch / Pattern'");
  assert(pbMarkdown.includes("Push Access"), "list_protected_branches markdown missing header 'Push Access'");
  assert(pbMarkdown.includes("Merge Access"), "list_protected_branches markdown missing header 'Merge Access'");
  assert(pbMarkdown.includes("main"), "list_protected_branches markdown missing branch name 'main'");
  assert(pbMarkdown.includes("Maintainers"), "list_protected_branches markdown missing push access description 'Maintainers'");
  assert(pbMarkdown.includes("Developers + Maintainers"), "list_protected_branches markdown missing merge access description 'Developers + Maintainers'");

  const issue = await executeAction("get_issue", { project_id: 31, issue_iid: 14 }, { format: "json" });
  assert.strictEqual(issue.title, "Implement auth token rotation");
  assert.strictEqual(issue.description, "Full description of auth token rotation requirements.");
  assert.deepStrictEqual(issue.assignees, ["dev1"]);
  assert.strictEqual(issue.time_stats, undefined, "get_issue must strip time_stats bloat");
  assert.strictEqual(issue.task_completion_status, undefined, "get_issue must strip task_completion_status bloat");
  assert.strictEqual(issue.references, undefined, "get_issue must strip references bloat");
  assert.strictEqual(issue.user_notes_count, undefined, "get_issue must strip user_notes_count bloat");
  assert.strictEqual(issue._links, undefined, "get_issue must strip _links bloat");

  const pipeline = await executeAction("get_pipeline", { project_id: 31, pipeline_id: 777 }, { format: "json" });
  assert.strictEqual(pipeline.status, "success");
  assert.strictEqual(pipeline.ref, "main");
  assert.strictEqual(pipeline.sha, "11223344");
  assert.strictEqual(pipeline.user, "admin");
  assert.strictEqual(pipeline.before_sha, undefined, "get_pipeline must strip before_sha bloat");
  assert.strictEqual(pipeline.yaml_errors, undefined, "get_pipeline must strip yaml_errors bloat");
  assert.strictEqual(pipeline._links, undefined, "get_pipeline must strip _links bloat");

  console.log("[PASS] End-to-end executeAction() runtime checks passed (cancel/retry pipeline, directory tree fallback, delete/move commit, topics array, diff_refs, get_group, list_protected_branches, get_issue, get_pipeline)");
} finally {
  globalThis.fetch = originalFetch;
}

// 13. ACTION_FORMATTERS & README.md Catalog Parity Check
for (const formatterAction of Object.keys(ACTION_FORMATTERS)) {
  assert(
    ACTION_CATALOG.has(formatterAction),
    `ACTION_FORMATTERS contains dead key '${formatterAction}' that does not exist in ACTION_CATALOG`
  );
}

syncReadme(true);

const readmeText = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
for (const actionName of ACTION_CATALOG.keys()) {
  assert(
    readmeText.includes(`| \`${actionName}\` |`),
    `Action '${actionName}' is in ACTION_CATALOG but missing its catalog table row in README.md`
  );
}
console.log(`[PASS] ACTION_FORMATTERS (${Object.keys(ACTION_FORMATTERS).length} formatters) and README.md (all 90 actions) 100% aligned with ACTION_CATALOG`);

// 14. Zero GitHub API Cross-Contamination Invariant
const FORBIDDEN_GITHUB_PATTERNS = [
  /\bnode_id\b/,
  /\bgravatar_id\b/,
  /\bsite_admin\b/,
  /\bstarred_url\b/,
  /\bsubscriptions_url\b/,
  /\borganizations_url\b/,
  /\brepos_url\b/,
  /\bevents_url\b/,
  /\breceived_events_url\b/,
  /\bgists_url\b/,
  /\bfollowing_url\b/,
  /\bfollowers_url\b/,
  /\bhtml_url\b/,
  /api\.github\.com/,
  /\bmcp-github\b/,
];
const filesToScan = [
  "../index.js",
  "../README.md",
  "../instructions.md",
  "../server.json",
  "../src/client.js",
  "../src/catalog.js",
  "../src/helpers.js",
  "../src/schemas.js",
  ...fs.readdirSync(new URL("../src/tools", import.meta.url)).map((f) => `../src/tools/${f}`),
];
for (const relPath of filesToScan) {
  const content = fs.readFileSync(new URL(relPath, import.meta.url), "utf8");
  for (const pattern of FORBIDDEN_GITHUB_PATTERNS) {
    assert(
      !pattern.test(content),
      `Cross-contamination violation: forbidden GitHub pattern ${pattern} found in ${relPath}`
    );
  }
}
console.log(`[PASS] Zero GitHub API cross-contamination verified across ${filesToScan.length} source and documentation files`);

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

console.log("\nALL @sumirati/mcp-gitlab v3.2.0 CHECKS PASSED SUCCESSFULLY!");
