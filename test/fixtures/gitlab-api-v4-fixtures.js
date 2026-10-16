/**
 * Canonical GitLab REST API v4 Response Fixtures
 * Grounded strictly in official GitLab REST API v4 documentation:
 * - GET /api/v4/projects/:id
 * - GET /api/v4/projects/:id/issues
 * - GET /api/v4/projects/:id/merge_requests
 * - GET /api/v4/projects/:id/pipelines
 * - GET /api/v4/projects/:id/repository/files/:file_path
 * - GET /api/v4/projects/:id/merge_requests/:merge_request_iid/changes
 *
 * Contains zero GitHub API fields.
 */

export const GITLAB_V4_PROJECT = {
  id: 278964,
  description: "GitLab is an open source end-to-end software development platform with built-in version control, issue tracking, code review, CI/CD, and more.",
  name: "GitLab",
  name_with_namespace: "GitLab.org / GitLab",
  path: "gitlab",
  path_with_namespace: "gitlab-org/gitlab",
  created_at: "2015-05-20T10:42:12.615Z",
  default_branch: "master",
  tag_list: ["gitlab", "devops", "ruby", "rails"],
  topics: ["gitlab", "devops", "ruby", "rails"],
  ssh_url_to_repo: "git@gitlab.com:gitlab-org/gitlab.git",
  http_url_to_repo: "https://gitlab.com/gitlab-org/gitlab.git",
  web_url: "https://gitlab.com/gitlab-org/gitlab",
  readme_url: "https://gitlab.com/gitlab-org/gitlab/-/blob/master/README.md",
  forks_count: 14820,
  avatar_url: "https://gitlab.com/uploads/-/system/project/avatar/278964/logo-extra-whitespace.png",
  star_count: 24150,
  last_activity_at: "2026-10-16T15:30:00.000Z",
  namespace: {
    id: 9970,
    name: "GitLab.org",
    path: "gitlab-org",
    kind: "group",
    full_path: "gitlab-org",
    parent_id: null,
    avatar_url: "/uploads/-/system/group/avatar/9970/logo-extra-whitespace.png",
    web_url: "https://gitlab.com/groups/gitlab-org",
  },
  container_registry_image_prefix: "registry.gitlab.com/gitlab-org/gitlab",
  _links: {
    self: "https://gitlab.com/api/v4/projects/278964",
    issues: "https://gitlab.com/api/v4/projects/278964/issues",
    merge_requests: "https://gitlab.com/api/v4/projects/278964/merge_requests",
    repo_branches: "https://gitlab.com/api/v4/projects/278964/repository/branches",
    labels: "https://gitlab.com/api/v4/projects/278964/labels",
    events: "https://gitlab.com/api/v4/projects/278964/events",
    members: "https://gitlab.com/api/v4/projects/278964/members",
    cluster_agents: "https://gitlab.com/api/v4/projects/278964/cluster_agents",
  },
  packages_enabled: true,
  empty_repo: false,
  archived: false,
  visibility: "public",
  resolve_outdated_diff_discussions: false,
  container_expiration_policy: {
    cadence: "7d",
    enabled: true,
    keep_n: 10,
    older_than: "90d",
    name_regex: ".*",
    name_regex_keep: "(?:v.+|master|release.*)",
    next_run_at: "2026-10-18T00:00:00.000Z",
  },
  issues_enabled: true,
  merge_requests_enabled: true,
  wiki_enabled: true,
  jobs_enabled: true,
  snippets_enabled: true,
  container_registry_enabled: true,
  service_desk_enabled: true,
  service_desk_address: "contact-project+gitlab-org-gitlab-278964-issue-@incoming.gitlab.com",
  can_create_merge_request_in: true,
  issues_access_level: "enabled",
  repository_access_level: "enabled",
  merge_requests_access_level: "enabled",
  forking_access_level: "enabled",
  wiki_access_level: "enabled",
  builds_access_level: "enabled",
  snippets_access_level: "enabled",
  pages_access_level: "public",
  analytics_access_level: "enabled",
  container_registry_access_level: "enabled",
  security_and_compliance_access_level: "private",
  releases_access_level: "enabled",
  environments_access_level: "enabled",
  feature_flags_access_level: "enabled",
  infrastructure_access_level: "enabled",
  monitor_access_level: "enabled",
  SharedRunnersEnabled: true,
  lfs_enabled: true,
  creator_id: 1,
  import_status: "none",
  open_issues_count: 54312,
  ci_default_git_depth: 20,
  ci_forward_deployment_enabled: true,
  ci_job_token_scope_enabled: true,
  public_jobs: true,
  build_timeout: 3600,
  auto_cancel_pending_pipelines: "enabled",
  ci_config_path: ".gitlab-ci.yml",
  shared_with_groups: [],
  only_allow_merge_if_pipeline_succeeds: true,
  allow_merge_on_skipped_pipeline: false,
  restrict_user_defined_variables: false,
  request_access_enabled: true,
  only_allow_merge_if_all_discussions_are_resolved: true,
  remove_source_branch_after_merge: true,
  printing_merge_request_link_enabled: true,
  merge_method: "merge",
  squash_option: "default_off",
  suggestion_commit_message: null,
  merge_commit_template: null,
  squash_commit_template: null,
  issue_branch_template: null,
  autoclose_referenced_issues: true,
  permissions: {
    project_access: null,
    group_access: {
      access_level: 30,
      notification_level: 3,
    },
  },
};

export const GITLAB_V4_ISSUES_LIST = Array.from({ length: 10 }, (_, idx) => {
  const iid = 410 + idx;
  return {
    id: 12890123 + idx,
    iid,
    project_id: 278964,
    title: `Harden CI/CD pipeline variable masking and token projection (#${iid})`,
    description: `### Problem Statement\nWhen inspecting large GitLab issues via REST API v4, each issue payload includes nested \`_links\`, \`references\`, \`time_stats\`, \`task_completion_status\`, and reaction counters.\n\n### Acceptance Criteria\n- Strip v4 metadata bloat\n- Preserve high-signal fields for issue #${iid}`,
    state: idx % 3 === 0 ? "closed" : "opened",
    created_at: `2026-10-${String(idx + 1).padStart(2, "0")}T09:15:00.000Z`,
    updated_at: `2026-10-${String(idx + 5).padStart(2, "0")}T14:22:10.000Z`,
    closed_at: idx % 3 === 0 ? `2026-10-${String(idx + 6).padStart(2, "0")}T11:00:00.000Z` : null,
    closed_by: null,
    labels: ["devops::verify", "type::maintenance", "backend"],
    milestone: {
      id: 9012,
      iid: 17,
      project_id: 278964,
      title: "17.5",
      description: "Milestone 17.5 release targets",
      state: "active",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-10-01T00:00:00.000Z",
      due_date: "2026-11-17",
      start_date: "2026-10-18",
      expired: false,
      web_url: "https://gitlab.com/gitlab-org/gitlab/-/milestones/17",
    },
    assignees: [
      {
        id: 4012,
        username: "sumirati",
        name: "Sumirati Engineer",
        state: "active",
        locked: false,
        avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/4012/avatar.png",
        web_url: "https://gitlab.com/sumirati",
      },
    ],
    author: {
      id: 3011,
      username: "maintainer_bot",
      name: "Maintainer Bot",
      state: "active",
      locked: false,
      avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/3011/avatar.png",
      web_url: "https://gitlab.com/maintainer_bot",
    },
    type: "ISSUE",
    assignee: {
      id: 4012,
      username: "sumirati",
      name: "Sumirati Engineer",
      state: "active",
      locked: false,
      avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/4012/avatar.png",
      web_url: "https://gitlab.com/sumirati",
    },
    user_notes_count: 14,
    merge_requests_count: 2,
    upvotes: 5,
    downvotes: 0,
    due_date: "2026-11-15",
    confidential: false,
    discussion_locked: null,
    issue_type: "issue",
    web_url: `https://gitlab.com/gitlab-org/gitlab/-/issues/${iid}`,
    time_stats: {
      time_estimate: 14400,
      total_time_spent: 7200,
      human_time_estimate: "4h",
      human_total_time_spent: "2h",
    },
    task_completion_status: {
      count: 4,
      completed_count: 3,
    },
    blocking_issues_count: 0,
    has_tasks: true,
    task_status: "3 of 4 checklist items completed",
    _links: {
      self: `https://gitlab.com/api/v4/projects/278964/issues/${iid}`,
      notes: `https://gitlab.com/api/v4/projects/278964/issues/${iid}/notes`,
      award_emoji: `https://gitlab.com/api/v4/projects/278964/issues/${iid}/award_emoji`,
      project: "https://gitlab.com/api/v4/projects/278964",
      closed_as_duplicate_of: null,
    },
    references: {
      short: `#${iid}`,
      relative: `#${iid}`,
      full: `gitlab-org/gitlab#${iid}`,
    },
    severity: "UNKNOWN",
    subscribed: true,
    moved_to_id: null,
    service_desk_reply_to: null,
  };
});

export const GITLAB_V4_MERGE_REQUESTS_LIST = Array.from({ length: 10 }, (_, idx) => {
  const iid = 180 + idx;
  return {
    id: 9920100 + idx,
    iid,
    project_id: 278964,
    title: `feat(api): optimize merge request diff projection and pagination (!${iid})`,
    description: `Implements deterministic output projection and preserves \`diff_refs\` on MR changes endpoints for MR !${iid}.`,
    state: idx === 0 ? "merged" : "opened",
    created_at: `2026-10-${String(idx + 2).padStart(2, "0")}T10:00:00.000Z`,
    updated_at: `2026-10-${String(idx + 6).padStart(2, "0")}T16:45:00.000Z`,
    merged_by: null,
    merge_user: null,
    merged_at: idx === 0 ? "2026-10-08T12:00:00.000Z" : null,
    closed_by: null,
    closed_at: null,
    target_branch: "master",
    source_branch: `feat/mr-projection-${iid}`,
    user_notes_count: 8,
    upvotes: 3,
    downvotes: 0,
    author: {
      id: 4012,
      username: "sumirati",
      name: "Sumirati Engineer",
      state: "active",
      locked: false,
      avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/4012/avatar.png",
      web_url: "https://gitlab.com/sumirati",
    },
    assignees: [
      {
        id: 4012,
        username: "sumirati",
        name: "Sumirati Engineer",
        state: "active",
        locked: false,
        avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/4012/avatar.png",
        web_url: "https://gitlab.com/sumirati",
      },
    ],
    assignee: {
      id: 4012,
      username: "sumirati",
      name: "Sumirati Engineer",
      state: "active",
      locked: false,
      avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/4012/avatar.png",
      web_url: "https://gitlab.com/sumirati",
    },
    reviewers: [
      {
        id: 5001,
        username: "reviewer_one",
        name: "Lead Reviewer",
        state: "active",
        locked: false,
        avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/5001/avatar.png",
        web_url: "https://gitlab.com/reviewer_one",
      },
    ],
    source_project_id: 278964,
    target_project_id: 278964,
    labels: ["backend", "performance"],
    draft: idx % 4 === 0,
    work_in_progress: idx % 4 === 0,
    milestone: {
      id: 9012,
      iid: 17,
      project_id: 278964,
      title: "17.5",
      description: "Milestone 17.5 release targets",
      state: "active",
      due_date: "2026-11-17",
      start_date: "2026-10-18",
      web_url: "https://gitlab.com/gitlab-org/gitlab/-/milestones/17",
    },
    merge_when_pipeline_succeeds: false,
    merge_status: "can_be_merged",
    detailed_merge_status: "mergeable",
    sha: `8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7${idx}`,
    merge_commit_sha: null,
    squash_commit_sha: null,
    discussion_locked: null,
    should_remove_source_branch: true,
    force_remove_source_branch: true,
    reference: `!${iid}`,
    references: {
      short: `!${iid}`,
      relative: `!${iid}`,
      full: `gitlab-org/gitlab!${iid}`,
    },
    web_url: `https://gitlab.com/gitlab-org/gitlab/-/merge_requests/${iid}`,
    time_stats: {
      time_estimate: 7200,
      total_time_spent: 3600,
      human_time_estimate: "2h",
      human_total_time_spent: "1h",
    },
    squash: true,
    task_completion_status: {
      count: 5,
      completed_count: 5,
    },
    has_conflicts: false,
    blocking_discussions_resolved: true,
    subscribed: true,
  };
});

export const GITLAB_V4_PIPELINES_LIST = Array.from({ length: 10 }, (_, idx) => {
  const id = 1490200 + idx;
  return {
    id,
    iid: 850 + idx,
    project_id: 278964,
    sha: `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b${idx}`,
    ref: idx % 2 === 0 ? "master" : `feat/mr-projection-${180 + idx}`,
    status: idx === 2 ? "failed" : "success",
    source: "push",
    created_at: `2026-10-16T1${idx}:00:00.000Z`,
    updated_at: `2026-10-16T1${idx}:12:45.000Z`,
    web_url: `https://gitlab.com/gitlab-org/gitlab/-/pipelines/${id}`,
    name: "Ruby 3.3 / RSpec Unit & Integration Suite",
  };
});

const SAMPLE_FILE_UTF8 = `import { gitlabRequest, formatProjectId } from "./client.js";

export class RepositoryService {
  constructor(projectId) {
    this.projectId = formatProjectId(projectId);
  }

  async fetchFile(filePath, ref = "HEAD") {
    const encoded = encodeURIComponent(filePath);
    return await gitlabRequest(\`/projects/\${this.projectId}/repository/files/\${encoded}?ref=\${ref}\`);
  }

  async listBranches(perPage = 10) {
    return await gitlabRequest(\`/projects/\${this.projectId}/repository/branches?per_page=\${perPage}\`);
  }
}
`;

export const GITLAB_V4_FILE_CONTENTS = {
  file_name: "repository-service.js",
  file_path: "src/repository-service.js",
  size: Buffer.byteLength(SAMPLE_FILE_UTF8, "utf8"),
  encoding: "base64",
  content_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  ref: "master",
  blob_id: "79f7bbd25901e8334750839545a9bd021f0e4c83",
  commit_id: "d5c3b2a1908f7e6d5c4b3a291807f6e5d4c3b2a1",
  last_commit_id: "8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e70",
  execute_filemode: false,
  content: Buffer.from(SAMPLE_FILE_UTF8, "utf8").toString("base64"),
};

const LOCKFILE_DIFF_BODY = Array.from(
  { length: 120 },
  (_, i) => `+    "node_modules/pkg-${i}": { "version": "1.0.${i}", "Integrity": "sha512-xyz${i}abcdef1234567890" },`
).join("\n");

export const GITLAB_V4_MR_CHANGES = {
  id: 9920100,
  iid: 180,
  project_id: 278964,
  title: "feat(api): optimize merge request diff projection and pagination (!180)",
  description: "Implements deterministic output projection and preserves diff_refs.",
  state: "opened",
  created_at: "2026-10-02T10:00:00.000Z",
  updated_at: "2026-10-06T16:45:00.000Z",
  target_branch: "master",
  source_branch: "feat/mr-projection-180",
  author: {
    id: 4012,
    username: "sumirati",
    name: "Sumirati Engineer",
    state: "active",
    avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/4012/avatar.png",
    web_url: "https://gitlab.com/sumirati",
  },
  web_url: "https://gitlab.com/gitlab-org/gitlab/-/merge_requests/180",
  diff_refs: {
    base_sha: "1111111111111111111111111111111111111111",
    head_sha: "2222222222222222222222222222222222222222",
    start_sha: "1111111111111111111111111111111111111111",
  },
  changes_count: "2",
  changes: [
    {
      old_path: "src/helpers.js",
      new_path: "src/helpers.js",
      a_mode: "100644",
      b_mode: "100644",
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: "@@ -10,4 +10,5 @@\n export function summarizeMR(mr) {\n   return {\n     iid: mr.iid,\n+    diff_refs: mr.diff_refs,\n   };\n }",
    },
    {
      old_path: "package-lock.json",
      new_path: "package-lock.json",
      a_mode: "100644",
      b_mode: "100644",
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1,120 +1,120 @@\n${LOCKFILE_DIFF_BODY}`,
    },
  ],
};
