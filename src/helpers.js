import { gitlabRequest, formatProjectId } from "./client.js";

export async function resolveMilestoneId(projectId, milestoneIdentifier) {
  if (typeof milestoneIdentifier === "number") {
    return milestoneIdentifier;
  }
  const pId = formatProjectId(projectId);
  const res = await gitlabRequest(`/projects/${pId}/milestones?include_ancestor_groups=true&search=${encodeURIComponent(milestoneIdentifier)}`);
  const list = res.items || res;
  const match = list.find((m) => m.title.toLowerCase() === milestoneIdentifier.toLowerCase()) || list[0];
  if (!match) {
    throw new Error(`Milestone '${milestoneIdentifier}' not found in project ${projectId}`);
  }
  return match.id;
}

export function summarizeIssue(issue) {
  return {
    iid: issue.iid,
    id: issue.id,
    title: issue.title,
    state: issue.state,
    milestone: issue.milestone ? { id: issue.milestone.id, iid: issue.milestone.iid, title: issue.milestone.title } : null,
    labels: issue.labels || [],
    assignees: (issue.assignees || []).map((a) => a.username),
    author: issue.author ? issue.author.username : null,
    due_date: issue.due_date || null,
    web_url: issue.web_url,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    description: issue.description
      ? issue.description.length > 250
        ? issue.description.slice(0, 250) + "..."
        : issue.description
      : null,
  };
}

export function summarizeMilestone(m) {
  return {
    id: m.id,
    iid: m.iid,
    title: m.title,
    state: m.state,
    due_date: m.due_date || null,
    start_date: m.start_date || null,
    expired: m.expired,
    web_url: m.web_url,
    description: m.description,
  };
}

export function summarizePipeline(p) {
  return {
    id: p.id,
    iid: p.iid,
    status: p.status,
    ref: p.ref,
    sha: p.sha ? p.sha.slice(0, 8) : null,
    source: p.source,
    created_at: p.created_at,
    web_url: p.web_url,
  };
}

export function summarizeJob(j) {
  return {
    id: j.id,
    name: j.name,
    stage: j.stage,
    status: j.status,
    duration: j.duration,
    created_at: j.created_at,
    web_url: j.web_url,
  };
}

export function summarizeMR(mr) {
  return {
    iid: mr.iid,
    id: mr.id,
    title: mr.title,
    state: mr.state,
    draft: mr.draft || mr.work_in_progress || false,
    source_branch: mr.source_branch,
    target_branch: mr.target_branch,
    merge_status: mr.merge_status,
    detailed_merge_status: mr.detailed_merge_status,
    milestone: mr.milestone ? mr.milestone.title : null,
    labels: mr.labels || [],
    author: mr.author ? mr.author.username : null,
    web_url: mr.web_url,
  };
}

export function summarizeCommit(c, options = {}) {
  const fullMessage = options.full_message === true;
  const headline = c.title || (c.message ? c.message.split("\n")[0] : "");
  return {
    id: c.id,
    short_id: c.short_id || (c.id ? c.id.slice(0, 8) : null),
    title: c.title || headline,
    message: fullMessage ? c.message : headline,
    author_name: c.author_name,
    authored_date: c.authored_date,
    committer_name: c.committer_name,
    committed_date: c.committed_date,
    web_url: c.web_url,
  };
}

export function summarizeRelease(r) {
  if (!r) return null;
  return {
    name: r.name,
    tag_name: r.tag_name,
    description: r.description,
    created_at: r.created_at,
    released_at: r.released_at,
    author: r.author ? r.author.username : null,
    commit_sha: r.commit ? (r.commit.short_id || (r.commit.id ? r.commit.id.slice(0, 8) : null)) : null,
    upcoming_release: Boolean(r.upcoming_release),
  };
}

export function summarizeTag(t) {
  if (!t) return null;
  return {
    name: t.name,
    message: t.message,
    target: t.target,
    commit_sha: t.commit ? (t.commit.short_id || (t.commit.id ? t.commit.id.slice(0, 8) : null)) : null,
    protected: Boolean(t.protected),
  };
}

export function summarizeProject(p) {
  return {
    id: p.id,
    name: p.name,
    path_with_namespace: p.path_with_namespace,
    visibility: p.visibility,
    description: p.description,
    default_branch: p.default_branch,
    ssh_url_to_repo: p.ssh_url_to_repo,
    http_url_to_repo: p.http_url_to_repo,
    web_url: p.web_url,
    star_count: p.star_count,
    forks_count: p.forks_count,
    last_activity_at: p.last_activity_at,
  };
}

export function summarizeGroup(g) {
  return {
    id: g.id,
    name: g.name,
    path: g.path,
    full_path: g.full_path,
    description: g.description,
    visibility: g.visibility,
    web_url: g.web_url,
  };
}

export function summarizeSnippet(s) {
  return {
    id: s.id,
    title: s.title,
    file_name: s.file_name,
    description: s.description,
    visibility: s.visibility,
    author: s.author ? s.author.username : null,
    updated_at: s.updated_at,
    created_at: s.created_at,
    web_url: s.web_url,
    raw_url: s.raw_url,
  };
}

export function summarizeWiki(w) {
  if (!w) return null;
  return {
    slug: w.slug,
    title: w.title,
    format: w.format,
    ...(w.content ? { content: w.content.length > 300 ? w.content.slice(0, 300) + "..." : w.content } : {}),
  };
}

export function summarizeBranch(b) {
  return {
    name: b.name,
    default: b.default || false,
    protected: b.protected || false,
    merged: b.merged || false,
    can_push: b.can_push,
    commit: b.commit
      ? {
          id: b.commit.id,
          short_id: b.commit.short_id,
          title: b.commit.title,
          authored_date: b.commit.authored_date,
          author_name: b.commit.author_name,
        }
      : null,
    web_url: b.web_url,
  };
}

export const ACCESS_LEVELS = {
  no_one: 0,
  guest: 10,
  reporter: 20,
  developer: 30,
  maintainer: 40,
  owner: 50,
  admin: 60,
};

export function resolveAccessLevel(level) {
  if (typeof level === "number") return level;
  const key = level.toString().toLowerCase().trim();
  if (ACCESS_LEVELS[key] !== undefined) return ACCESS_LEVELS[key];
  const parsed = parseInt(level, 10);
  if (!isNaN(parsed)) return parsed;
  throw new Error(`Invalid access_level '${level}'. Expected: no_one (0), guest (10), reporter (20), developer (30), maintainer (40), owner (50), or admin (60).`);
}

export function formatAccessLevel(level) {
  const map = {
    0: "No one",
    10: "Guest",
    20: "Reporter",
    30: "Developer",
    40: "Maintainer",
    50: "Owner",
    60: "Admin",
  };
  return map[level] ? `${map[level]} (${level})` : `Level ${level}`;
}

export function summarizeProtectedBranch(pb) {
  if (!pb) return null;
  return {
    id: pb.id,
    name: pb.name,
    push_access_levels: pb.push_access_levels?.map((p) => ({
      access_level: p.access_level,
      description: p.access_level_description || formatAccessLevel(p.access_level),
    })) || [],
    merge_access_levels: pb.merge_access_levels?.map((m) => ({
      access_level: m.access_level,
      description: m.access_level_description || formatAccessLevel(m.access_level),
    })) || [],
    allow_force_push: Boolean(pb.allow_force_push),
    code_owner_approval_required: Boolean(pb.code_owner_approval_required),
  };
}

export function summarizeMember(m) {
  return {
    id: m.id,
    username: m.username,
    name: m.name,
    state: m.state,
    access_level: m.access_level,
    role: formatAccessLevel(m.access_level),
    expires_at: m.expires_at || null,
    web_url: m.web_url,
  };
}

export function summarizeVariable(v) {
  return {
    key: v.key,
    value: v.masked ? "[MASKED]" : v.value,
    variable_type: v.variable_type || "env_var",
    protected: v.protected || false,
    masked: v.masked || false,
    raw: v.raw || false,
    environment_scope: v.environment_scope || "*",
    description: v.description || null,
  };
}

export async function resolveNamespaceId(namespace) {
  if (typeof namespace === "number") return namespace;
  const parsed = parseInt(namespace, 10);
  if (!isNaN(parsed) && parsed.toString() === namespace.toString().trim()) {
    return parsed;
  }
  const clean = namespace.trim();
  // 1. Direct group lookup by path
  try {
    const group = await gitlabRequest(`/groups/${encodeURIComponent(clean)}`);
    if (group && group.id) return group.id;
  } catch {
    // Fall back to search
  }
  // 2. Search group by query
  try {
    const groups = await gitlabRequest(`/groups?search=${encodeURIComponent(clean)}`);
    const list = groups.items || groups;
    const match = list.find((g) => g.full_path === clean || g.path === clean || g.name === clean);
    if (match) return match.id;
    if (list.length > 0) return list[0].id;
  } catch {
    // Ignore and proceed
  }
  throw new Error(`GitLab namespace/group '${namespace}' not found`);
}

export function summarizeMirror(m) {
  return {
    id: m.id,
    url: m.url ? m.url.replace(/:[^@:]*@/, ":***@") : null,
    enabled: m.enabled,
    update_status: m.update_status,
    last_error: m.last_error || null,
    last_update_at: m.last_update_at || null,
    last_successful_update_at: m.last_successful_update_at || null,
  };
}

export function summarizeRunner(r) {
  return {
    id: r.id,
    description: r.description,
    ip_address: r.ip_address,
    active: r.active,
    paused: r.paused,
    is_shared: r.is_shared,
    runner_type: r.runner_type,
    status: r.status,
    online: r.online,
    contacted_at: r.contacted_at,
  };
}

export function summarizeHook(h) {
  return {
    id: h.id,
    url: h.url,
    push_events: h.push_events,
    tag_push_events: h.tag_push_events,
    merge_requests_events: h.merge_requests_events,
    issues_events: h.issues_events,
    pipeline_events: h.pipeline_events,
    enable_ssl_verification: h.enable_ssl_verification,
    created_at: h.created_at,
  };
}

const NOISE_KEYS = new Set([
  "_links",
  "avatar_url",
  "gravatar_id",
  "node_id",
  "site_admin",
  "starred_url",
  "subscriptions_url",
  "organizations_url",
  "repos_url",
  "events_url",
  "received_events_url",
  "gists_url",
  "following_url",
  "followers_url",
]);

/**
 * Universal token compression filter that strips redundant metadata:
 * avatar URLs, Gravatar IDs, internal API links, and null/empty fields.
 * Preserves high-signal functional data (IDs, names, diffs, bodies, states, timestamps, html_url, web_url).
 * Hardened with maxDepth recursion guard (32) and preserves empty root collections.
 */
export function projectOutput(val, depth = 0, maxDepth = 32) {
  if (val === null || val === undefined) return undefined;
  if (typeof val !== "object") return val;
  if (depth >= maxDepth) return val;

  if (Array.isArray(val)) {
    return val.map((item) => projectOutput(item, depth + 1, maxDepth)).filter((item) => item !== undefined);
  }

  const result = {};
  for (const [k, v] of Object.entries(val)) {
    if (NOISE_KEYS.has(k)) continue;
    if (k === "url" && typeof v === "string" && (v.includes("/api/v4") || v.includes("api.github.com"))) continue;
    const cleaned = projectOutput(v, depth + 1, maxDepth);
    if (cleaned !== undefined && cleaned !== null && cleaned !== "") {
      result[k] = cleaned;
    }
  }

  return result;
}

/**
 * Converts structured JSON/object responses into clean, compact Markdown
 */
export function jsonToMarkdown(data) {
  if (data === null || data === undefined) return "";
  if (typeof data !== "object") return String(data);

  if (Array.isArray(data)) {
    if (data.length === 0) return "_No items returned._";
    if (typeof data[0] === "object" && data[0] !== null) {
      const keys = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
      if (keys.length <= 8) {
        const header = `| ${keys.join(" | ")} |`;
        const divider = `| ${keys.map(() => ":---").join(" | ")} |`;
        const rows = data.map((item) =>
          `| ${keys
            .map((k) => {
              const v = item[k];
              if (v === null || v === undefined) return "";
              if (typeof v === "object") return "`" + JSON.stringify(v) + "`";
              return String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
            })
            .join(" | ")} |`
        );
        return [header, divider, ...rows].join("\n");
      }
    }
    return data
      .map((item) => `- ${typeof item === "object" ? JSON.stringify(item) : item}`)
      .join("\n");
  }

  const lines = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`### ${k}\n\n` + jsonToMarkdown(v));
    } else if (typeof v === "object") {
      lines.push(`**${k}**:`);
      for (const [subK, subV] of Object.entries(v)) {
        lines.push(`  - **${subK}**: ${typeof subV === "object" ? JSON.stringify(subV) : subV}`);
      }
    } else {
      lines.push(`- **${k}**: ${v}`);
    }
  }
  return lines.join("\n");
}


