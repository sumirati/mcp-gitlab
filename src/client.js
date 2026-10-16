export const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
export const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";

if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}

export function formatProjectId(projectId) {
  if (typeof projectId === "number") {
    return projectId.toString();
  }
  let str = projectId.toString().trim();
  str = str.replace(/\.git$/, "");
  return str.includes("/") ? encodeURIComponent(str) : str;
}

export function formatLabels(labels) {
  if (!labels) return undefined;
  if (Array.isArray(labels)) {
    return labels.map((l) => l.trim()).filter(Boolean).join(",");
  }
  return labels
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(",");
}

export function isReadOnly() {
  const val = process.env.GITLAB_READ_ONLY;
  return val === "true" || val === "1" || val === "yes";
}

export async function gitlabRequest(endpoint, options = {}, responseType = "json") {
  if (isReadOnly()) {
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      throw new Error(
        `GitLab MCP server is running in read-only mode (GITLAB_READ_ONLY=true). HTTP ${method} requests are blocked.`
      );
    }
  }

  const url = endpoint.startsWith("http") ? endpoint : `${GITLAB_API_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    ...(options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errJson = null;
    let errorDetail = "";
    try {
      errJson = await response.json();
      errorDetail = typeof errJson === "object" ? JSON.stringify(errJson) : String(errJson);
    } catch {
      errorDetail = await response.text();
    }

    // 1. Rate Limiting (Rack Attack / Reverse Proxy 429)
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") || "60";
      throw new Error(
        `GitLab API rate limit exceeded (HTTP 429). Please back off and wait ${retryAfter}s before retrying. Detail: ${errorDetail}`
      );
    }

    // 2. Insufficient Scope detection on 403 (GitLab sends error in JSON body, omitting WWW-Authenticate header)
    if (
      response.status === 403 &&
      errJson &&
      typeof errJson === "object" &&
      (errJson.error === "insufficient_scope" || errJson.scope)
    ) {
      const requiredScope = errJson.scope || "required scope";
      throw new Error(
        `GitLab API permission error (403 Forbidden - Insufficient Token Scope): The token lacks the '${requiredScope}' scope required for this endpoint. Detail: ${errorDetail}`
      );
    }

    // 3. 401 Disambiguation (Token validity probe vs Permission refusal)
    // As documented by Jose (gitlab-org/gitlab!260774), GitLab answers 401 on ~30 endpoints
    // when an authenticated user lacks permission (e.g. MR approval rules, access tokens).
    if (response.status === 401 && !endpoint.includes("/user") && !errorDetail.includes("invalid_token")) {
      try {
        const probeRes = await fetch(`${GITLAB_API_URL}/user`, {
          headers: { Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}` },
        });
        if (probeRes.status === 200 || probeRes.status === 403) {
          // Token is valid! 401 from GitLab was a permission refusal bug/quirk.
          throw new Error(
            `GitLab API permission denied (401 Unauthorized returned by GitLab for an authenticated request). Your token is valid, but lacks the necessary role or permission for this operation (e.g., project membership, approval rules, or branch protection). Detail: ${errorDetail}`
          );
        }
      } catch (probeErr) {
        if (probeErr.message.includes("permission denied")) {
          throw probeErr;
        }
        // If probe failed for network or other reasons, fall through to default error
      }
    }

    throw new Error(`GitLab API error (${response.status} ${response.statusText}): ${errorDetail}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  if (responseType === "text") {
    return await response.text();
  }

  const data = await response.json();

  // 4. Guard against ghost writes where server returns 201 Created with id: null
  if (response.status === 201 && data && typeof data === "object" && !Array.isArray(data) && data.id === null) {
    throw new Error(
      `GitLab API mutation anomaly: Server responded with 201 Created but entity 'id' is null (write was not persisted).`
    );
  }
  const total = response.headers.get("X-Total");
  const totalPages = response.headers.get("X-Total-Pages");
  const page = response.headers.get("X-Page");
  const perPage = response.headers.get("X-Per-Page");

  if (Array.isArray(data) && total !== null) {
    return {
      pagination: {
        total: parseInt(total, 10),
        total_pages: parseInt(totalPages || "1", 10),
        page: parseInt(page || "1", 10),
        per_page: parseInt(perPage || "20", 10),
      },
      items: data,
    };
  }

  return data;
}
