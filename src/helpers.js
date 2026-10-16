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

export function summarizeIssue(issue, full = false) {
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
    confidential: Boolean(issue.confidential),
    web_url: issue.web_url,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    ...(issue.closed_at ? { closed_at: issue.closed_at } : {}),
    description: issue.description
      ? !full && issue.description.length > 250
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

export function summarizePipeline(p, full = false) {
  const base = {
    id: p.id,
    iid: p.iid,
    status: p.status,
    ref: p.ref,
    sha: p.sha ? p.sha.slice(0, 8) : null,
    source: p.source,
    created_at: p.created_at,
    web_url: p.web_url,
  };
  if (full) {
    return {
      ...base,
      updated_at: p.updated_at || null,
      started_at: p.started_at || null,
      finished_at: p.finished_at || null,
      duration: p.duration ?? null,
      queued_duration: p.queued_duration ?? null,
      coverage: p.coverage ?? null,
      user: p.user ? p.user.username : null,
      ...(p.detailed_status
        ? {
            detailed_status: {
              text: p.detailed_status.text,
              label: p.detailed_status.label,
              group: p.detailed_status.group,
            },
          }
        : {}),
    };
  }
  return base;
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
  const idStr = c.id !== undefined && c.id !== null ? String(c.id) : null;
  return {
    id: c.id,
    short_id: c.short_id || (idStr ? idStr.slice(0, 8) : null),
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
    ...(Array.isArray(p.topics) && p.topics.length > 0 ? { topics: p.topics } : {}),
    ssh_url_to_repo: p.ssh_url_to_repo,
    http_url_to_repo: p.http_url_to_repo,
    web_url: p.web_url,
    star_count: p.star_count,
    forks_count: p.forks_count,
    last_activity_at: p.last_activity_at,
    ...(p.statistics ? { statistics: p.statistics } : {}),
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

export const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "cargo.lock",
  "poetry.lock",
  "gemfile.lock",
  "composer.lock",
  "go.sum",
  "mix.lock",
  "podfile.lock",
]);

export function isLockfile(filePath) {
  if (!filePath) return false;
  const filename = filePath.split("/").pop().toLowerCase();
  if (LOCKFILES.has(filename)) return true;
  if (filename.endsWith(".min.js") || filename.endsWith(".min.css") || filename.endsWith(".map")) return true;
  return false;
}

export const NOISE_KEYS = new Set([
  "_links",
  "avatar_url",
  "references",
  "time_stats",
  "task_completion_status",
  "commands_changes",
  "user_notes_count",
  "merge_requests_count",
  "upvotes",
  "downvotes",
  "subscribed",
  "has_tasks",
  "service_desk_reply_to",
  "moved_to_id",
  "container_expiration_policy",
  "permissions",
]);

/**
 * Universal token compression filter for GitLab REST API v4 responses.
 * Strips low-signal metadata (_links, avatar_url, references, time_stats, task_completion_status,
 * reaction/note counters, container_expiration_policy, permissions) and null/empty fields.
 * Preserves high-signal functional data (IDs, IIDs, names, diffs, bodies, states, timestamps, web_url, url).
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
    const cleaned = projectOutput(v, depth + 1, maxDepth);
    if (cleaned !== undefined && cleaned !== null && cleaned !== "") {
      result[k] = cleaned;
    }
  }

  return result;
}

/**
 * Renders a high-density Markdown table from an array of items and column definitions.
 * Column def: { header: string, get: (item) => string }
 */
export function renderMarkdownTable(items, columns) {
  if (!items || items.length === 0) {
    return "_No items found._";
  }
  const headers = columns.map((c) => c.header);
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${columns.map(() => ":---").join(" | ")} |`;
  const rows = items.map((item) => {
    const cells = columns.map((c) => {
      const val = c.get(item);
      if (val === null || val === undefined || val === "") return "-";
      return String(val).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    });
    return `| ${cells.join(" | ")} |`;
  });
  return [headerLine, dividerLine, ...rows].join("\n");
}

function formatPaginationPrefix(title, pagination) {
  if (!pagination) return "";
  return `### ${title} (Page ${pagination.page || 1}/${pagination.total_pages || 1}, Total: ${pagination.total ?? "-"})\n\n`;
}

export function formatIssuesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.issues || [];
  const prefix = formatPaginationPrefix("Issues", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "IID", get: (i) => `#${i.iid || i.id}` },
    { header: "Title", get: (i) => i.title },
    { header: "State", get: (i) => i.state },
    { header: "Author", get: (i) => (i.author ? `@${i.author}` : "-") },
    { header: "Assignees", get: (i) => (Array.isArray(i.assignees) && i.assignees.length ? i.assignees.map((a) => `@${a}`).join(", ") : "-") },
    { header: "Milestone", get: (i) => (i.milestone ? (i.milestone.title || i.milestone) : "-") },
    { header: "Labels", get: (i) => (Array.isArray(i.labels) && i.labels.length ? i.labels.join(", ") : "-") },
  ]);
}

export function formatMergeRequestsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.merge_requests || [];
  const prefix = formatPaginationPrefix("Merge Requests", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "!MR", get: (m) => `!${m.iid || m.id}` },
    { header: "Title", get: (m) => (m.draft ? `[Draft] ${m.title}` : m.title) },
    { header: "State", get: (m) => m.state },
    { header: "Branch", get: (m) => `\`${m.source_branch} -> ${m.target_branch}\`` },
    { header: "Author", get: (m) => (m.author ? `@${m.author}` : "-") },
    { header: "Status", get: (m) => m.detailed_merge_status || m.merge_status || "-" },
  ]);
}

export function formatPipelinesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.pipelines || [];
  const prefix = formatPaginationPrefix("Pipelines", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "ID", get: (p) => p.id },
    { header: "Status", get: (p) => p.status },
    { header: "Ref", get: (p) => `\`${p.ref}\`` },
    { header: "SHA", get: (p) => p.sha || "-" },
    { header: "Source", get: (p) => p.source || "-" },
    { header: "Created", get: (p) => (p.created_at ? p.created_at.split("T")[0] : "-") },
  ]);
}

export function formatPipelineJobsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.jobs || [];
  const prefix = formatPaginationPrefix("Pipeline Jobs", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "ID", get: (j) => j.id },
    { header: "Name", get: (j) => j.name },
    { header: "Stage", get: (j) => j.stage },
    { header: "Status", get: (j) => j.status },
    { header: "Duration", get: (j) => (j.duration ? `${Math.round(j.duration)}s` : "-") },
  ]);
}

export function formatCommitsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.commits || [];
  const prefix = formatPaginationPrefix("Commits", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "SHA", get: (c) => c.short_id || (c.id ? c.id.slice(0, 8) : "-") },
    { header: "Author", get: (c) => c.author_name || "-" },
    { header: "Date", get: (c) => (c.committed_date || c.authored_date || "").split("T")[0] || "-" },
    { header: "Title", get: (c) => c.title || (c.message ? c.message.split("\n")[0] : "-") },
  ]);
}

export function formatBranchesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.branches || [];
  const prefix = formatPaginationPrefix("Branches", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "Branch", get: (b) => b.name },
    { header: "Protected", get: (b) => (b.protected ? "Yes" : "No") },
    { header: "Default", get: (b) => (b.default ? "Yes" : "No") },
    { header: "Commit", get: (b) => (b.commit ? (b.commit.short_id || b.commit.id?.slice(0, 8)) : "-") },
  ]);
}

export function formatProtectedBranchesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.protected_branches || [];
  const prefix = formatPaginationPrefix("Protected Branches", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "Branch / Pattern", get: (pb) => pb.name },
    { header: "Push Access", get: (pb) => (Array.isArray(pb.push_access_levels) && pb.push_access_levels.length ? pb.push_access_levels.map((p) => p.description || p.access_level_description || p.access_level).join(", ") : "-") },
    { header: "Merge Access", get: (pb) => (Array.isArray(pb.merge_access_levels) && pb.merge_access_levels.length ? pb.merge_access_levels.map((m) => m.description || m.access_level_description || m.access_level).join(", ") : "-") },
    { header: "Force Push", get: (pb) => (pb.allow_force_push ? "Yes" : "No") },
    { header: "Code Owner Approval", get: (pb) => (pb.code_owner_approval_required ? "Yes" : "No") },
  ]);
}

export function formatMembersMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.members || [];
  const prefix = formatPaginationPrefix("Project Members", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "Username", get: (m) => `@${m.username}` },
    { header: "Name", get: (m) => m.name },
    { header: "Role", get: (m) => m.role || "-" },
    { header: "State", get: (m) => m.state || "-" },
  ]);
}

export function formatVariablesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.variables || [];
  const prefix = formatPaginationPrefix("Variables", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "Key", get: (v) => v.key },
    { header: "Type", get: (v) => v.variable_type || "env_var" },
    { header: "Scope", get: (v) => v.environment_scope || "*" },
    { header: "Protected", get: (v) => (v.protected ? "Yes" : "No") },
    { header: "Masked", get: (v) => (v.masked ? "Yes" : "No") },
  ]);
}

export function formatMilestonesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.milestones || [];
  const prefix = formatPaginationPrefix("Milestones", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "IID", get: (m) => `#${m.iid || m.id}` },
    { header: "Title", get: (m) => m.title },
    { header: "State", get: (m) => m.state },
    { header: "Due Date", get: (m) => m.due_date || "-" },
    { header: "Expired", get: (m) => (m.expired ? "Yes" : "No") },
  ]);
}

export function formatReleasesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.releases || [];
  const prefix = formatPaginationPrefix("Releases", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "Tag", get: (r) => r.tag_name || r.name },
    { header: "Name", get: (r) => r.name || "-" },
    { header: "Author", get: (r) => (r.author ? `@${r.author}` : "-") },
    { header: "Released", get: (r) => (r.released_at || r.created_at || "").split("T")[0] || "-" },
    { header: "Upcoming", get: (r) => (r.upcoming_release ? "Yes" : "No") },
  ]);
}

export function formatProjectsListMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.projects || [];
  const prefix = formatPaginationPrefix("Projects", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "ID", get: (p) => p.id },
    { header: "Project", get: (p) => p.path_with_namespace || p.name },
    { header: "Visibility", get: (p) => p.visibility || "-" },
    { header: "Default Branch", get: (p) => `\`${p.default_branch || "main"}\`` },
    { header: "Stars", get: (p) => p.star_count ?? 0 },
    { header: "Description", get: (p) => (p.description ? (p.description.length > 80 ? p.description.slice(0, 80) + "..." : p.description) : "-") },
  ]);
}

export function formatGroupsListMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.groups || [];
  const prefix = formatPaginationPrefix("Groups", data?.pagination);
  return prefix + renderMarkdownTable(items, [
    { header: "ID", get: (g) => g.id },
    { header: "Group", get: (g) => g.full_path || g.path || g.name },
    { header: "Name", get: (g) => g.name || "-" },
    { header: "Visibility", get: (g) => g.visibility || "-" },
    { header: "Description", get: (g) => (g.description ? (g.description.length > 80 ? g.description.slice(0, 80) + "..." : g.description) : "-") },
  ]);
}

export function formatFileContentsMarkdown(f) {
  if (!f) return "_No file data._";
  if (f.type === "directory" && Array.isArray(f.entries)) {
    const header = `## Directory: \`${f.path || "/"}\` (ref: \`${f.ref || "HEAD"}\`)\n\n`;
    return header + renderMarkdownTable(f.entries, [
      { header: "Name", get: (item) => item.name },
      { header: "Type", get: (item) => item.type },
      { header: "Path", get: (item) => item.path },
      { header: "Mode", get: (item) => item.mode || "-" },
    ]);
  }
  let md = `## File: \`${f.file_path || f.file_name || "-"}\`\n\n`;
  const meta = [];
  if (f.size !== undefined) meta.push(`**Size**: ${f.size} bytes`);
  if (f.ref) meta.push(`**Ref**: \`${f.ref}\``);
  if (f.last_commit_id) meta.push(`**Commit**: \`${f.last_commit_id.slice(0, 8)}\``);
  if (f.sliced_lines) meta.push(`**Lines**: ${f.sliced_lines}`);
  if (meta.length > 0) md += meta.join(" | ") + "\n\n";
  if (f.outline) {
    md += `\`\`\`text\n${f.outline}\n\`\`\`\n`;
  } else if (f.decoded_content !== undefined) {
    md += `\`\`\`\n${f.decoded_content}\n\`\`\`\n`;
  }
  return md;
}

export function formatProjectMarkdown(p) {
  if (!p) return "_No project data._";
  let md = `## Project: ${p.path_with_namespace || p.name} (ID: ${p.id})\n\n`;
  if (p.description) md += `${p.description}\n\n`;
  md += `- **Visibility**: ${p.visibility || "internal"}\n`;
  md += `- **Default Branch**: \`${p.default_branch || "main"}\`\n`;
  if (Array.isArray(p.topics) && p.topics.length > 0) {
    md += `- **Topics**: ${p.topics.join(", ")}\n`;
  }
  md += `- **Web URL**: ${p.web_url || "-"}\n`;
  if (p.ssh_url_to_repo) md += `- **SSH Clone**: \`${p.ssh_url_to_repo}\`\n`;
  if (p.http_url_to_repo) md += `- **HTTP Clone**: \`${p.http_url_to_repo}\`\n`;
  if (p.star_count !== undefined) {
    md += `- **Stars**: ${p.star_count} | **Forks**: ${p.forks_count || 0}\n`;
  }
  return md;
}

export function formatCommitDetailsMarkdown(c) {
  if (!c) return "_No commit data._";
  let md = `## Commit \`${c.short_id || c.id?.slice(0, 8)}\`: ${c.title || ""}\n\n`;
  md += `- **Author**: ${c.author_name || "-"} (${c.author_email || "-"}) on ${c.authored_date || "-"}\n`;
  if (c.committer_name && c.committer_name !== c.author_name) {
    md += `- **Committer**: ${c.committer_name} on ${c.committed_date || "-"}\n`;
  }
  if (c.web_url) md += `- **Web URL**: ${c.web_url}\n`;
  if (c.message && c.message !== c.title) {
    md += `\n### Message\n\n${c.message}\n`;
  }
  if (Array.isArray(c.files_changed) && c.files_changed.length > 0) {
    md += `\n### Files Changed (${c.files_changed.length})\n\n`;
    md += renderMarkdownTable(c.files_changed, [
      { header: "File", get: (f) => f.path },
      { header: "Status", get: (f) => f.status },
    ]);
  }
  if (Array.isArray(c.diffs) && c.diffs.length > 0) {
    md += `\n### Diffs\n\n`;
    for (const d of c.diffs) {
      md += `#### ${d.new_path}\n\`\`\`diff\n${d.diff}\n\`\`\`\n\n`;
    }
  }
  return md;
}

export const ACTION_FORMATTERS = {
  list_issues: formatIssuesMarkdown,
  list_merge_requests: formatMergeRequestsMarkdown,
  list_pipelines: formatPipelinesMarkdown,
  list_pipeline_jobs: formatPipelineJobsMarkdown,
  list_commits: formatCommitsMarkdown,
  list_branches: formatBranchesMarkdown,
  list_protected_branches: formatProtectedBranchesMarkdown,
  list_project_members: formatMembersMarkdown,
  list_project_variables: formatVariablesMarkdown,
  list_milestones: formatMilestonesMarkdown,
  list_releases: formatReleasesMarkdown,
  search_repositories: formatProjectsListMarkdown,
  list_group_projects: formatProjectsListMarkdown,
  list_my_projects: formatProjectsListMarkdown,
  list_my_groups: formatGroupsListMarkdown,
  get_file_contents: formatFileContentsMarkdown,
  get_project: formatProjectMarkdown,
  get_commit: formatCommitDetailsMarkdown,
};

/**
 * Converts structured JSON/object responses into clean, compact, token-saving Markdown
 */
export function jsonToMarkdown(data, actionName) {
  if (data === null || data === undefined) return "";
  if (typeof data !== "object") return String(data);

  // 1. Dispatch directly by actionName if registered
  if (actionName && ACTION_FORMATTERS[actionName]) {
    return ACTION_FORMATTERS[actionName](data);
  }

  // 2. Shape-based automatic heuristics for common payloads
  if (data.issues && Array.isArray(data.issues)) {
    return formatIssuesMarkdown(data);
  }
  if (data.merge_requests && Array.isArray(data.merge_requests)) {
    return formatMergeRequestsMarkdown(data);
  }
  if (data.pipelines && Array.isArray(data.pipelines)) {
    return formatPipelinesMarkdown(data);
  }
  if (data.commits && Array.isArray(data.commits)) {
    return formatCommitsMarkdown(data);
  }
  if (data.branches && Array.isArray(data.branches)) {
    return formatBranchesMarkdown(data);
  }
  if (data.protected_branches && Array.isArray(data.protected_branches)) {
    return formatProtectedBranchesMarkdown(data);
  }
  if (data.members && Array.isArray(data.members)) {
    return formatMembersMarkdown(data);
  }
  if (data.variables && Array.isArray(data.variables)) {
    return formatVariablesMarkdown(data);
  }
  if (data.milestones && Array.isArray(data.milestones)) {
    return formatMilestonesMarkdown(data);
  }
  if (data.releases && Array.isArray(data.releases)) {
    return formatReleasesMarkdown(data);
  }
  if (data.projects && Array.isArray(data.projects)) {
    return formatProjectsListMarkdown(data);
  }
  if (data.groups && Array.isArray(data.groups)) {
    return formatGroupsListMarkdown(data);
  }
  if (data.decoded_content !== undefined || data.outline !== undefined || (data.type === "directory" && Array.isArray(data.entries))) {
    return formatFileContentsMarkdown(data);
  }
  if (data.path_with_namespace && data.id && data.default_branch) {
    return formatProjectMarkdown(data);
  }
  if (data.short_id && data.authored_date && (Array.isArray(data.files_changed) || Array.isArray(data.diffs))) {
    return formatCommitDetailsMarkdown(data);
  }

  // 3. Array of objects
  if (Array.isArray(data)) {
    if (data.length === 0) return "_No items returned._";
    const first = data[0];
    if (typeof first === "object" && first !== null) {
      // Heuristic detection on first item
      if (first.iid && first.title && !first.source_branch) {
        return formatIssuesMarkdown(data);
      }
      if (first.source_branch && first.target_branch) {
        return formatMergeRequestsMarkdown(data);
      }
      if (first.status && first.ref && first.sha) {
        return formatPipelinesMarkdown(data);
      }
      if (first.short_id && first.title) {
        return formatCommitsMarkdown(data);
      }
      if (first.name && Array.isArray(first.push_access_levels)) {
        return formatProtectedBranchesMarkdown(data);
      }
      if (first.name && first.protected !== undefined) {
        return formatBranchesMarkdown(data);
      }
      if (first.username && first.role) {
        return formatMembersMarkdown(data);
      }
      if (first.path_with_namespace && first.default_branch) {
        return formatProjectsListMarkdown(data);
      }

      // General table formatting with prioritized column selection
      const allKeys = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
      const priorityKeys = ["id", "iid", "name", "title", "key", "state", "status", "type", "ref", "role", "author", "created_at", "value"];
      const sortedKeys = [
        ...priorityKeys.filter((k) => allKeys.includes(k)),
        ...allKeys.filter((k) => !priorityKeys.includes(k)),
      ];
      // Pick top 6 columns that are not large objects or bodies
      const selectedKeys = sortedKeys.filter((k) => !["description", "body", "diff", "content", "decoded_content"].includes(k)).slice(0, 6);

      if (selectedKeys.length > 0) {
        return renderMarkdownTable(
          data,
          selectedKeys.map((k) => ({
            header: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
            get: (item) => {
              const val = item[k];
              if (val === null || val === undefined) return "-";
              if (typeof val === "object") return Array.isArray(val) ? val.join(", ") : JSON.stringify(val);
              return String(val);
            },
          }))
        );
      }
    }
    return data
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const label = item.name || item.title || item.key || item.id || "Item";
          const desc = item.status || item.state || item.description || "";
          return `- **${label}**${desc ? `: ${desc}` : ""}`;
        }
        return `- ${item}`;
      })
      .join("\n");
  }

  // 4. Single structured object
  const lines = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`### ${k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ")}\n\n` + jsonToMarkdown(v));
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

/**
 * Strips ANSI terminal color and control escape sequences.
 */
export function stripAnsi(text) {
  if (!text) return "";
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

/**
 * Intelligent CI log extractor: strips ANSI, scans for failure blocks,
 * and extracts the root cause rather than only blind tail lines.
 */
export function extractSmartJobLog(rawLog, { tail_lines = 100, strip_ansi = true, smart_failure = true } = {}) {
  if (!rawLog) return "";
  let text = strip_ansi ? stripAnsi(rawLog) : rawLog;
  if (tail_lines <= 0) {
    return text;
  }
  const lines = text.split(/\r?\n/);
  if (lines.length <= tail_lines) {
    return lines.join("\n");
  }

  if (smart_failure) {
    const failureRegex = /(error:|fatal:|panic:|FAIL:|AssertionError|FAILED|Process completed with exit code [1-9]|exit status [1-9]|npm ERR!|BUILD FAILED|Traceback \(most recent call last\):)/i;
    let matchIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (failureRegex.test(lines[i])) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      const start = Math.max(0, matchIdx - 15);
      const end = Math.min(lines.length, matchIdx + 60);
      const failureBlock = lines.slice(start, end).join("\n");
      const tailStart = Math.max(end, lines.length - 25);
      const tailBlock = lines.slice(tailStart).join("\n");

      let result = `[... Truncated first ${start} lines ...]\n=== DETECTED FAILURE BLOCK (around line ${matchIdx + 1}) ===\n${failureBlock}`;
      if (tailStart > end) {
        result += `\n\n[... Truncated ${tailStart - end} intermediate lines ...]\n=== JOB TEARDOWN TAIL ===\n${tailBlock}`;
      }
      return result;
    }
  }

  return `[... Truncated first ${lines.length - tail_lines} lines ...]\n` + lines.slice(-tail_lines).join("\n");
}

/**
 * Universal Regex Symbol Extractor for code files (JS/TS, Python, Go, Rust, Ruby, Java, C#).
 * Returns symbol signatures with 1-based line numbers to allow outline-first file inspection.
 */
export function extractSymbolOutline(content, filename = "") {
  if (!content) return "";
  const lines = content.split(/\r?\n/);
  const symbols = [];

  const patterns = [
    /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*([a-zA-Z0-9_$]+)/,
    /^\s*(?:export\s+(?:default\s+)?)?class\s+([a-zA-Z0-9_$]+)/,
    /^\s*(?:export\s+)?(?:interface|type|enum)\s+([a-zA-Z0-9_$]+)/,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/,
    /^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/,
    /^\s*class\s+([a-zA-Z0-9_]+)(?:\s*\(|\s*:)/,
    /^\s*func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/,
    /^\s*type\s+([a-zA-Z0-9_]+)\s+(?:struct|interface)/,
    /^\s*(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait|type)\s+([a-zA-Z0-9_]+)/,
    /^\s*impl(?:\s+<[^>]+>)?\s+([a-zA-Z0-9_]+)/,
    /^\s*(?:def|class|module)\s+([a-zA-Z0-9_:]+)/,
  ];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    for (const pat of patterns) {
      if (pat.test(line)) {
        const indentLevel = line.search(/\S/);
        const indentStr = " ".repeat(Math.min(indentLevel, 8));
        symbols.push(`L${idx + 1}:${indentStr} ${trimmed.replace(/\{$/, "").trim()}`);
        break;
      }
    }
  }

  if (symbols.length === 0) {
    return `[No top-level function, class, or type declarations detected in ${filename || "file"}. Total lines: ${lines.length}]`;
  }

  return `=== SYMBOL OUTLINE (${symbols.length} declarations across ${lines.length} lines) ===\n` + symbols.join("\n");
}


