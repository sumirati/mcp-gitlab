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

console.log("ALL GITLAB CLIENT RESILIENCE TESTS PASSED!\n");
