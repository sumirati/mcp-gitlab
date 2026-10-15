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
  const str = projectId.toString().trim();
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

export async function gitlabRequest(endpoint, options = {}, responseType = "json") {
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
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
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
