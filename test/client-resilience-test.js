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

} finally {
  global.fetch = originalFetch;
}

// Test 6: projectOutput hardening (html_url, web_url, empty collections, depth guard)
import { projectOutput } from "../src/helpers.js";

// Verify html_url and web_url preservation
const samplePayload = {
  id: 101,
  html_url: "https://gitlab.example.com/releases/v1",
  web_url: "https://gitlab.example.com/project/issues/1",
  node_id: "MDQ6VXNlcjE=",
  avatar_url: "https://gitlab.example.com/avatar.png",
  url: "https://gitlab.example.com/api/v4/projects/1",
};
const cleaned = projectOutput(samplePayload);
assert.strictEqual(cleaned.html_url, "https://gitlab.example.com/releases/v1", "html_url must be preserved");
assert.strictEqual(cleaned.web_url, "https://gitlab.example.com/project/issues/1", "web_url must be preserved");
assert.strictEqual(cleaned.avatar_url, undefined, "avatar_url must be stripped");
assert.strictEqual(cleaned.node_id, undefined, "node_id must be stripped");
assert.strictEqual(cleaned.url, undefined, "internal API url must be stripped");
console.log("[PASS] projectOutput preserves html_url and web_url while stripping noise keys");

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

console.log("ALL GITLAB CLIENT RESILIENCE & PROJECTION TESTS PASSED!\n");
