import { gitlabRequest, formatProjectId } from "./client.js";

export async function resolveMilestoneId(projectId, milestoneIdentifier) {
  if (typeof milestoneIdentifier === "number") {
    return milestoneIdentifier;
  }
  const pId = formatProjectId(projectId);
  const res = await gitlabRequest(`/projects/${pId}/milestones?search=${encodeURIComponent(milestoneIdentifier)}`);
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

export function summarizeCommit(c) {
  return {
    id: c.id,
    short_id: c.short_id || (c.id ? c.id.slice(0, 8) : null),
    title: c.title,
    message: c.message,
    author_name: c.author_name,
    authored_date: c.authored_date,
    committer_name: c.committer_name,
    committed_date: c.committed_date,
    web_url: c.web_url,
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
  guest: 10,
  reporter: 20,
  developer: 30,
  maintainer: 40,
  owner: 50,
};

export function resolveAccessLevel(level) {
  if (typeof level === "number") return level;
  const key = level.toString().toLowerCase().trim();
  if (ACCESS_LEVELS[key]) return ACCESS_LEVELS[key];
  const parsed = parseInt(level, 10);
  if (!isNaN(parsed)) return parsed;
  throw new Error(`Invalid access_level '${level}'. Expected: guest (10), reporter (20), developer (30), maintainer (40), or owner (50).`);
}

export function formatAccessLevel(level) {
  const map = {
    10: "Guest",
    20: "Reporter",
    30: "Developer",
    40: "Maintainer",
    50: "Owner",
  };
  return map[level] ? `${map[level]} (${level})` : `Level ${level}`;
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

