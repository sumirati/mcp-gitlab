import assert from "node:assert";
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
const runnerResults = findActions({ query: "runner" });
console.log(`[PASS] findActions('runner') returned ${runnerResults.total_matches} matches`);
assert(runnerResults.total_matches >= 2, "Expected at least 2 runner actions");
const runnerActions = runnerResults.actions.map((a) => a.action);
assert(runnerActions.includes("list_runners"), "Missing list_runners");
assert(runnerActions.includes("get_runner_status"), "Missing get_runner_status");
console.log("       Runner actions found:", runnerActions.join(", "));

// 4. Find actions - mirror search
const mirrorResults = findActions({ query: "mirror" });
console.log(`[PASS] findActions('mirror') returned ${mirrorResults.total_matches} matches`);
assert(mirrorResults.total_matches >= 2, "Expected at least 2 mirror actions");
const mirrorActions = mirrorResults.actions.map((a) => a.action);
assert(mirrorActions.includes("list_push_mirrors"), "Missing list_push_mirrors");
assert(mirrorActions.includes("trigger_push_mirror_sync"), "Missing trigger_push_mirror_sync");
console.log("       Mirror actions found:", mirrorActions.join(", "));

// 5. Find actions - domain filtering
const mrDomainResults = findActions({ domain: "mr" });
console.log(`[PASS] findActions(domain: 'mr') returned ${mrDomainResults.total_matches} actions`);
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

console.log("\nALL v3.0.0 CHECKS PASSED SUCCESSFULLY!");
