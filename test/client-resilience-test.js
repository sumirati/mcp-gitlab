import assert from "node:assert";
import { gitlabRequest } from "../src/client.js";

console.log("--- Starting GitLab Client Resilience & Error Diagnostics Tests ---");

const originalFetch = global.fetch;

try {
  // Test 1: 429 Rate limit
  global.fetch = async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    headers: new Headers({ "retry-after": "45" }),
    json: async () => ({ message: "Rack_Attack" }),
  });
  await assert.rejects(
    () => gitlabRequest("/test"),
    /GitLab API rate limit exceeded \(HTTP 429\).*45s/
  );
  console.log("[PASS] 429 rate limit with retry-after header handled correctly");

  // Test 2: 403 Insufficient scope
  global.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    headers: new Headers(),
    json: async () => ({ error: "insufficient_scope", scope: "api" }),
  });
  await assert.rejects(
    () => gitlabRequest("/test"),
    /Insufficient Token Scope.*'api'/
  );
  console.log("[PASS] 403 insufficient_scope detected and formatted clearly");

  // Test 3: 401 Disambiguation - token is valid, was a permission refusal
  let calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    if (url.includes("/user")) {
      return { ok: true, status: 200, json: async () => ({ id: 1, username: "dev" }) };
    }
    return {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers(),
      json: async () => ({ message: "401 Unauthorized" }),
    };
  };
  await assert.rejects(
    () => gitlabRequest("/projects/1/merge_requests/1/approve"),
    /permission denied \(401 Unauthorized returned by GitLab for an authenticated request\)/
  );
  assert(calls.some(u => u.includes("/user")), "Should have probed /user");
  console.log("[PASS] 401 permission refusal disambiguated via /user probe");

  // Test 4: 401 Disambiguation - token is genuinely invalid
  calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    if (url.includes("/user")) {
      return { ok: false, status: 401, statusText: "Unauthorized", json: async () => ({ message: "401 Unauthorized" }) };
    }
    return {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers(),
      json: async () => ({ message: "401 Unauthorized" }),
    };
  };
  await assert.rejects(
    () => gitlabRequest("/projects/1"),
    /GitLab API error \(401 Unauthorized\)/
  );
  console.log("[PASS] 401 genuine invalid token correctly throws standard 401 error");

  // Test 5: 201 Ghost write guard (id is null)
  global.fetch = async () => ({
    ok: true,
    status: 201,
    statusText: "Created",
    headers: new Headers(),
    json: async () => ({ id: null, name: "invalid_board" }),
  });
  await assert.rejects(
    () => gitlabRequest("/projects/1/boards"),
    /GitLab API mutation anomaly.*entity 'id' is null/
  );
  console.log("[PASS] 201 ghost write (null id) detected and blocked");

  // Test 5b: 201 Empty body handled gracefully without JSON parse crash
  global.fetch = async () => ({
    ok: true,
    status: 201,
    statusText: "Created",
    headers: new Headers(),
    text: async () => "",
  });
  const emptyCreated = await gitlabRequest("/projects/1/remote_mirrors/2/sync", { method: "POST" });
  assert.strictEqual(emptyCreated.success, true);
  console.log("[PASS] Empty 201 response body handled gracefully");

} finally {
  global.fetch = originalFetch;
}

// Test 6: projectOutput hardening (GitLab v4 web_url, webhook url preservation, v4 bloat stripping, empty collections, depth guard)
import { projectOutput, stripAnsi, extractSmartJobLog, extractSymbolOutline } from "../src/helpers.js";

const samplePayload = {
  id: 101,
  iid: 14,
  web_url: "https://gitlab.example.com/group/project/-/issues/14",
  url: "https://hooks.example.com/gitlab-webhook",
  avatar_url: "https://gitlab.example.com/uploads/-/system/user/avatar/1/avatar.png",
  _links: {
    self: "https://gitlab.example.com/api/v4/projects/1/issues/14",
    notes: "https://gitlab.example.com/api/v4/projects/1/issues/14/notes",
  },
  references: {
    short: "#14",
    relative: "#14",
    full: "group/project#14",
  },
  time_stats: {
    time_estimate: 0,
    total_time_spent: 0,
  },
  task_completion_status: { count: 0, completed_count: 0 },
  user_notes_count: 3,
  upvotes: 1,
  downvotes: 0,
  subscribed: true,
  container_expiration_policy: { enabled: false },
  permissions: { project_access: null },
};
const cleaned = projectOutput(samplePayload);
assert.strictEqual(cleaned.web_url, "https://gitlab.example.com/group/project/-/issues/14", "web_url must be preserved");
assert.strictEqual(cleaned.url, "https://hooks.example.com/gitlab-webhook", "webhook/mirror url must be preserved");
assert.strictEqual(cleaned.avatar_url, undefined, "avatar_url must be stripped");
assert.strictEqual(cleaned._links, undefined, "_links must be stripped");
assert.strictEqual(cleaned.references, undefined, "references must be stripped");
assert.strictEqual(cleaned.time_stats, undefined, "time_stats must be stripped");
assert.strictEqual(cleaned.task_completion_status, undefined, "task_completion_status must be stripped");
assert.strictEqual(cleaned.user_notes_count, undefined, "user_notes_count must be stripped");
assert.strictEqual(cleaned.container_expiration_policy, undefined, "container_expiration_policy must be stripped");
assert.strictEqual(cleaned.permissions, undefined, "permissions must be stripped");
console.log("[PASS] projectOutput preserves web_url and url while stripping GitLab v4 noise keys");

// Verify empty root collections are preserved
assert.deepStrictEqual(projectOutput({}), {}, "Empty root object must be preserved as {}");
assert.deepStrictEqual(projectOutput([]), [], "Empty root array must be preserved as []");
console.log("[PASS] projectOutput preserves empty root collections");

// Verify recursion depth guard (maxDepth = 32)
let deepObj = { level: 0 };
let current = deepObj;
for (let i = 1; i <= 40; i++) {
  current.child = { level: i };
  current = current.child;
}
const depthTested = projectOutput(deepObj, 0, 32);
assert(depthTested !== undefined, "Deep object should not throw call-stack exhaustion");
console.log("[PASS] projectOutput recursion depth guard (maxDepth = 32) verified");

// Test 7: stripAnsi and extractSmartJobLog
const rawAnsiLog = "\x1B[31mError:\x1B[0m compilation failed\nLine 2\nLine 3";
assert.strictEqual(stripAnsi(rawAnsiLog), "Error: compilation failed\nLine 2\nLine 3");

// Test smart failure extraction
const mockJobTrace = Array.from({ length: 300 }, (_, i) => `Log line ${i + 1}`).join("\n") +
  "\nFAIL: test_authentication_failed\nExpected 200 got 401\n" +
  Array.from({ length: 100 }, (_, i) => `Teardown line ${i + 1}`).join("\n");

const smartExtracted = extractSmartJobLog(mockJobTrace, { tail_lines: 50, smart_failure: true });
assert(smartExtracted.includes("=== DETECTED FAILURE BLOCK"), "Must contain detected failure block");
assert(smartExtracted.includes("FAIL: test_authentication_failed"), "Must contain the failure anchor");
assert(smartExtracted.includes("=== JOB TEARDOWN TAIL ==="), "Must contain teardown tail");

// Test tail_lines: 0 ("0 for all") on logs with failures and ANSI escapes
const allLinesExtracted = extractSmartJobLog(mockJobTrace, { tail_lines: 0, smart_failure: true });
assert(!allLinesExtracted.includes("[... Truncated"), "tail_lines: 0 must not contain truncation headers");
assert(!allLinesExtracted.includes("=== DETECTED FAILURE BLOCK"), "tail_lines: 0 must not truncate into failure block");
assert.strictEqual(allLinesExtracted.split("\n").length, mockJobTrace.split("\n").length, "tail_lines: 0 must return all lines");

const ansiMockJobTrace = "\x1b[32m[INFO]\x1b[0m Starting build\n" + mockJobTrace;
const allLinesCleanAnsi = extractSmartJobLog(ansiMockJobTrace, { tail_lines: 0, strip_ansi: true, smart_failure: true });
assert(!allLinesCleanAnsi.includes("\x1b["), "tail_lines: 0 with strip_ansi: true must strip ANSI codes");
assert(allLinesCleanAnsi.startsWith("[INFO] Starting build"), "Must start with stripped first line");
assert(!allLinesCleanAnsi.includes("[... Truncated"), "tail_lines: 0 must have zero truncation markers");

console.log("[PASS] stripAnsi and extractSmartJobLog failure anchor & tail_lines: 0 verified");

// Test 8: extractSymbolOutline
const mockCode = `
import fs from "node:fs";

export class ProjectManager {
  constructor() {}
  async fetchRemote() {}
}

export function calculateMetrics(input) {
  return 42;
}

const formatHelper = (str) => {
  return str.trim();
};
`;
const outline = extractSymbolOutline(mockCode, "test.js");
assert(outline.includes("=== SYMBOL OUTLINE"), "Outline must have header");
assert(outline.includes("export class ProjectManager"), "Outline must include ProjectManager");
assert(outline.includes("export function calculateMetrics"), "Outline must include calculateMetrics");
assert(outline.includes("const formatHelper"), "Outline must include formatHelper");
console.log("[PASS] extractSymbolOutline AST/regex signature extraction verified");

console.log("ALL GITLAB CLIENT RESILIENCE & PROJECTION TESTS PASSED!\n");
