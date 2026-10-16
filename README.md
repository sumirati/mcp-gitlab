# GitLab MCP Server (`@sumirati/mcp-gitlab`)

A modern, 2026 AI-native Model Context Protocol (MCP) server for GitLab API v4, engineered for self-hosted GitLab Community Edition (CE), Enterprise Edition (EE), and GitLab.com.

[![npm version](https://img.shields.io/npm/v/@sumirati/mcp-gitlab.svg)](https://www.npmjs.com/package/@sumirati/mcp-gitlab)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-sumirati%2Fmcp--gitlab-181717?logo=github)](https://github.com/sumirati/mcp-gitlab)
[![GitLab](https://img.shields.io/badge/GitLab-sumirati%2Fmcp--gitlab-FC6D26?logo=gitlab)](https://gitlab.com/sumirati/mcp-gitlab)

---

## What makes v3.0.0 Unique: The 2026 5-Tool Hybrid Standard

In early MCP servers, dumping 50–100 tools into the client's tool list consumed **10,000+ prompt context tokens on every turn** ("System Prompt Tax") and resulted in poor Coherence ratings on the **[Glama TDQS](https://github.com/glama-ai/tool-definition-quality-score)** rubric.

`@sumirati/mcp-gitlab` v3 solves this with a **5-Tool Hybrid Surface**:
- **Glama TDQS Coherence Tier A (5/5)**: By exposing exactly 5 tools to the client, the server sits in the ideal 3–15 tool coherence sweet spot.
- **Ultra-Lean System Prompt Tax**: Drops schema overhead from 27,681 tokens to **1,292 tokens** (95.3% reduction), preserving context windows and maximizing LLM prompt-cache hits.
- **Zero-Hop Hourly Drivers**: The 3 operations developers and agents actually use constantly during pair-programming (`get_file_contents`, `get_project`, `get_commit`) remain eager tools for instant zero-hop execution.
- **100% Platform Access on Demand**: The entire platform surface of **90 actions across 14 domains** is accessible on-demand via dynamic action discovery (`gitlab_find_actions` $\rightarrow$ `gitlab_execute_action`), delivering **75%–96% token savings** with default high-density Markdown tables and summaries (`format: "markdown" | "json"`).
- **Resilient Fallback**: If an agent directly invokes any catalog action name (e.g. `list_pipelines`), the server dynamically executes it with full input validation and projection.

```text
LLM Prompt Context (1,292 tokens total):
├── 1. gitlab_find_actions(query, [domain], [format])     [Meta Discovery]
├── 2. gitlab_execute_action(action, params, [format])   [Meta Dynamic Execution]
├── 3. get_file_contents(project_id, file_path, [ref])    [Eager Daily Driver #1]
├── 4. get_project(project_id, [statistics])              [Eager Daily Driver #2]
└── 5. get_commit(project_id, sha)                        [Eager Daily Driver #3]

Under the hood (Dynamic Registry):
└── 90 Curated Actions across 14 Domains (with 75%–99% token reduction projections)
```

---

## Core Capabilities Across 14 Domains

1. **Enterprise Observability & Self-Hosted Operations**:
   - **System Health Diagnostics**: End-to-end connectivity, token identity verification, and API latency testing (`system_health_check`).
   - **Push Mirrors**: Verify upstream replication to remote Git hosts (`list_push_mirrors`) and force immediate sync (`trigger_push_mirror_sync`).
   - **CI Runners**: Audit runner health, online/paused status, and tags (`list_runners`, `get_runner_status`).
   - **Webhooks**: Inspect registered automation hooks (`list_project_hooks`).
2. **Repository & Branch Governance**: Project CRUD, group hierarchy resolution (`buggycode/project-name`), branch lifecycle, branch protection management (`list_protected_branches`, `protect_branch`, `unprotect_branch`), file/directory reading (`get_file_contents`), and atomic multi-file commits (`push_files`, `create_commit`).
3. **CI/CD Observability**: Query pipelines by status, trigger/cancel/retry pipelines (`create_pipeline`, `cancel_pipeline`, `retry_pipeline`), tail failed job logs (`get_job_trace`) without token blowout, read build artifacts (`get_job_artifact_file`), and inspect JUnit test reports (`get_pipeline_test_report`).
4. **Merge Request Reviews & Diff Discussions**: Two-stage diff inspection (`get_merge_request_changes`), automated lockfile pruning (`package-lock.json`), and inline diff discussions with SHA coordinate resolution (`create_diff_discussion`).
5. **Issues & Task Planning**: CRUD issues, track blockers/dependencies (`list_issue_links`, `create_issue_link`), and add progress notes (`list_issue_notes`, `create_issue_note`).
6. **Milestones & Labels**: Human-readable milestone resolution, label creation, and scoped milestone inspection.
7. **Wikis & Snippets**: Documentation outline slicing (`toc_only: true`), chapter extraction, and snippet management.
8. **User & Identity Context**: Authenticated identity lookup, group enumeration and creation (`create_group`), and owned project discovery.

---

## Quickstart & Installation

### Option 1: Run with `npx` (No installation needed)

```bash
npx -y @sumirati/mcp-gitlab
```

### Option 2: Install Globally

```bash
npm install -g @sumirati/mcp-gitlab
mcp-gitlab
```

### Option 3: Local Clone

```bash
git clone https://github.com/sumirati/mcp-gitlab.git
cd mcp-gitlab
npm install
npm test
npm start
```

---

## Environment Configuration

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `GITLAB_PERSONAL_ACCESS_TOKEN` | **Yes** | — | Personal access token with `api` scope. |
| `GITLAB_API_URL` | No | `https://gitlab.com/api/v4` | Base API URL of your GitLab CE/EE or cloud instance. |
| `GITLAB_READ_ONLY` | No | `false` | Enable Read-Only safety mode (`true`, `1`, `yes`). Filters out mutating tools and strictly blocks write/modify HTTP requests across all 90 actions. |
| `GITLAB_EXPOSE_ALL_TOOLS` | No | `false` | Set to `true` (or `GITLAB_EXPOSE_LEGACY_TOOLS=true`) to disable the 5-tool hybrid surface and expose all 90 tools directly on `ListTools` for legacy clients. |
| `MCP_OUTPUT_FORMAT` | No | `markdown` | Default output format (`markdown` for compact tables/summaries, or `json` for structured objects). |

---

## Client Configuration

### Google Antigravity / Claude Desktop / Cursor

Add to your MCP configuration file (`mcp_config.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@sumirati/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "<your-gitlab-token>",
        "GITLAB_API_URL": "https://gitlab.example.com/api/v4"
      }
    }
  }
}
```

---

## Complete Action Catalog Reference (90 Actions across 14 Domains)

All 90 actions feature strict input validation and field-mask projections:

### 1. The 5 Client-Exposed Tools (Hybrid Mode)
| Tool | Type | Description |
| :--- | :---: | :--- |
| `gitlab_find_actions` | Meta | Search and discover available GitLab operations across all 14 domains with compact parameter signatures |
| `gitlab_execute_action` | Meta | Execute any discovered GitLab platform action with input validation and token-optimized projection |
| `get_file_contents` | Eager | Read decoded file contents, symbol outlines, or directory listings from any branch or commit ref without cloning |
| `get_project` | Eager | Retrieve project metadata, project ID, visibility, clone URLs, topics, and default branch |
| `get_commit` | Eager | Inspect Git commit details, author info, and token-capped file diffs |

<!-- START_CATALOG_REFERENCE -->

### 2. Enterprise & Self-Hosted Operations (`enterprise` — 6 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `system_health_check` | Perform end-to-end connectivity, latency, and permission diagnostics against the GitLab instance. Verifies API availability, authentication identity, server version/edition (when permitted), and active read-only policy. | No |
| `list_push_mirrors` | List remote push mirrors configured for a project, including synchronization status, target URLs, and last error diagnostics. Essential for verifying repository synchronization between local self-hosted instances and upstream GitLab instances or remote Git hosts. | No |
| `trigger_push_mirror_sync` | Force an immediate push mirror synchronization for a designated project remote mirror. Use when code has been committed locally and immediate upstream replication is required without waiting for the scheduled background sync interval. | **Yes** |
| `list_runners` | List available GitLab CI/CD runners (instance, group, or project-level), detailing their online status, active/paused state, and executor types. Use to diagnose CI pipeline execution delays, runner connectivity, or missing executor tags. | No |
| `get_runner_status` | Retrieve comprehensive details and health status for a specific CI/CD runner, including IP address, architecture, runner version, tags, and last contacted timestamp. Use to troubleshoot stuck jobs or unresponsive self-hosted runners. | No |
| `list_project_hooks` | List configured project webhooks and their subscribed triggers (push, merge requests, issues, pipeline events). Use to audit integration webhooks and verify CI/CD automation hook registrations. | No |

### 3. Repository & Project Management (`repositories` — 10 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `search_repositories` | Search for GitLab projects and repositories across the instance or scoped to a specific group namespace (recommended to reduce instance load). Capped at 100 per page. If project_id or path_with_namespace is already known, look up directly via 'get_project'. | No |
| `get_project` | Retrieve comprehensive metadata for a specific GitLab project, including default branch, repository statistics, visibility, and topic tags. Use to inspect repository settings or verify project access. Do NOT use to inspect directory trees or source code; use 'get_file_contents' instead. | No |
| `create_repository` | Create a new GitLab project/repository under your personal namespace or a designated group. Use when provisioning new codebases or initializing repositories. Side effect: creates a new GitLab project immediately. Do NOT use to duplicate existing projects; use 'fork_repository' instead. | **Yes** |
| `update_project` | Update mutable project settings including display name, description, default branch, visibility level, and topics. Use to modify repository configurations or administrative details. Side effect: alters project settings immediately. Do NOT use to commit code changes; use 'create_or_update_file' or 'push_files'. | **Yes** |
| `delete_project` | Permanently delete a GitLab project and all its repository files, issues, merge requests, and CI/CD pipelines. Use solely for project decommissioning. Side effect: DESTRUCTIVE and irreversible. Requires explicit safety confirmation via confirm_project_name. | **Yes** |
| `get_file_contents` | Read the raw content of a specific file or directory tree from a repository at a designated branch, tag, or commit ref. Use when inspecting current repository source code or configs. Do NOT use for reviewing diffs between branches (use 'get_merge_request_changes') or viewing commit diffs (use 'get_commit'). | No |
| `create_or_update_file` | Create a new file or update the content of an existing file in a repository with a Git commit. Use for single-file changes or documentation updates. Side effect: creates an immediate Git commit on the remote branch. Do NOT use when updating multiple files together; use 'push_files' instead for atomic multi-file commits. | **Yes** |
| `push_files` | Atomically commit multiple file additions, modifications, or deletions to a target branch in a single Git commit. Use for multi-file refactors, features, or project scaffolding. Side effect: creates an atomic multi-action Git commit on the remote branch. Use instead of calling 'create_or_update_file' in a loop. | **Yes** |
| `create_commit` | Atomically commit multiple file additions, modifications, or updates to a target branch in a single Git commit using GitLab Commits API. Use for multi-file refactors, features, or project scaffolding without local git cloning. Side effect: creates an atomic multi-action Git commit on the remote branch. | **Yes** |
| `fork_repository` | Fork an existing GitLab project into a designated user namespace or group. Use when contributing to upstream projects or establishing an independent fork. Side effect: provisions a new repository linked to the upstream source. Do NOT use to create fresh empty projects; use 'create_repository' instead. | **Yes** |

### 4. Branch Governance (`branches` — 7 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_branches` | List repository branches with latest commit summaries, default branch indicators, and protected status. Use to discover active development branches or check branch existence. Do NOT use to inspect commit diffs (use 'get_commit') or list tags (use 'list_tags'). | No |
| `get_branch` | Retrieve comprehensive details for a specific Git branch, including latest commit SHA, author info, and branch protection rules. Use to verify commit alignment before creating merge requests. Do NOT use to inspect file contents directly; use 'get_file_contents' instead. | No |
| `create_branch` | Create a new Git branch starting from an existing branch, tag, or commit SHA. Use to initialize feature branches, bugfixes, or release branches. Side effect: creates a new branch pointer on the remote repository. Do NOT use to create new repositories; use 'create_repository' instead. | **Yes** |
| `delete_branch` | Delete an existing Git branch from a project repository. Use to clean up merged or obsolete feature branches. Side effect: DESTRUCTIVE. Accidental deletion of the project's default branch is actively blocked for safety. Do NOT use to delete tags; use Git tag management instead. | **Yes** |
| `list_protected_branches` | List protected branch rules configured in a GitLab project, showing push/merge access levels, force-push permission, and code owner approval requirements. Use to audit branch governance and merge restrictions. | No |
| `protect_branch` | Configure branch protection rules for a branch or wildcard pattern (e.g. 'main', 'release/*'). Controls push access levels, merge access levels, force push permission, and code owner approval. | **Yes** |
| `unprotect_branch` | Remove branch protection rules from a specified branch or wildcard pattern. Side effect: DESTRUCTIVE. Removes push and merge access restrictions from the target branch. | **Yes** |

### 5. Git Commits & History (`commits` — 2 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_commits` | List chronological commit history for a project, branch, or specific file path with author metadata and commit messages. Filter upstream by ref_name, author, path, and date range. To inspect exact code changes of a specific commit SHA, use 'get_commit' instead. | No |
| `get_commit` | Retrieve comprehensive details for a specific Git commit SHA, including author info, statistics, modified files, and selective unified file diffs. Use to inspect exact code changes made in a commit. Supports file_path filtering and line limits to prevent context exhaustion on large commits. | No |

### 6. Pipelines & CI/CD Observability (`pipelines` — 10 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_pipelines` | List CI/CD pipelines filtered by branch, tag, status ('running', 'success', 'failed', 'canceled'), or commit SHA with token-efficient status summaries. Use to check deployment status, monitor test suite health, or verify build triggers. Do NOT use to inspect specific job logs; use 'get_job_trace' instead. | No |
| `get_pipeline` | Retrieve comprehensive details for a specific CI/CD pipeline by numeric ID, including execution status, duration, queued duration, and associated commit info. Use to evaluate pipeline health or check if all stages completed. Do NOT use to inspect individual job failures; use 'list_pipeline_jobs' or 'get_job_trace' instead. | No |
| `create_pipeline` | Manually trigger and run a new CI/CD pipeline execution for a specific branch or tag with optional custom pipeline variables. Use to kick off tests, builds, or deployments on demand. Side effect: initiates immediate job execution on GitLab runners. Do NOT use to inspect running jobs; use 'list_pipeline_jobs' instead. | **Yes** |
| `cancel_pipeline` | Cancel all running and pending jobs in an active CI/CD pipeline run by numeric pipeline_id. Side effect: terminates active runner jobs for this pipeline immediately. | **Yes** |
| `retry_pipeline` | Retry all failed or canceled jobs in an existing CI/CD pipeline run by numeric pipeline_id. Side effect: re-queues failed/canceled jobs on GitLab runners immediately. | **Yes** |
| `list_pipeline_jobs` | List all execution jobs (build, test, lint, deploy) and their current status within a specific pipeline. Use to identify which specific stage or job failed in a pipeline run. Do NOT use to download job output logs; use 'get_job_trace' instead once the failed job ID is known. | No |
| `get_job` | Retrieve comprehensive details about a specific CI/CD job, including duration, runner tags, failure reasons, and available artifact archives. Use when diagnosing why a runner job stalled or failed. Do NOT use to stream terminal logs; use 'get_job_trace' instead. | No |
| `get_job_trace` | Retrieve the raw terminal console output log for a specific CI/CD job with configurable tailing (tail_lines). Use to inspect compilation errors, stack traces, and test assertion failures without overflowing context. Do NOT use to inspect structured JUnit test suites; use 'get_pipeline_test_report' instead. | No |
| `get_job_artifact_file` | Download and read the text content of a specific file from a completed job's build artifacts zip archive (e.g. coverage reports, build manifests, test outputs). Use to inspect generated artifacts without downloading the full archive. Do NOT use for repository files; use 'get_file_contents' instead. | No |
| `get_pipeline_test_report` | Retrieve the structured JUnit test summary report for a pipeline run, including total test counts, passed/failed test cases, execution duration, and failure stack traces. Use to diagnose automated test failures across test suites. Do NOT use for raw console output; use 'get_job_trace' instead. | No |

### 7. Merge Requests & Code Reviews (`merge-requests` — 12 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_merge_requests` | List merge requests filtered by state ('opened', 'closed', 'merged', 'all'), source/target branches, milestone, labels, author, assignee, reviewer, or search text pushed directly upstream to GitLab's indexed database. Architectural Best Practice: For known MRs, always prefer 'get_merge_request' with exact merge_request_iid rather than broad listing. | No |
| `get_merge_request` | Retrieve comprehensive details for a specific merge request by IID (!<iid>), including status, mergeability, approval state, branch names, diff head SHA, and description. Use to evaluate review state or prepare for merging. Do NOT use to inspect file diffs; use 'get_merge_request_changes' instead. | No |
| `create_merge_request` | Create a new merge request proposing changes from a source branch into a target branch. Supports setting title, markdown description, assignees, reviewers, milestone, and target branch removal options. Side effect: creates a new GitLab MR immediately. Do NOT use to post review comments; use 'create_diff_discussion' instead. | **Yes** |
| `update_merge_request` | Update an existing merge request's title, description, target branch, milestone, labels, assignees, or state ('close' or 'reopen'). Use to update MR details or close obsolete requests. Side effect: alters MR configuration immediately. Do NOT use to merge the MR; use 'accept_merge_request' instead. | **Yes** |
| `get_merge_request_changes` | Inspect unified code diffs and modified files for an MR. Features token-saving summaries (summary_only), file path filtering, lockfile pruning, and automatic diff refs (base_sha, start_sha, head_sha) needed for inline comments. Use for AI code review analysis. | No |
| `list_merge_request_discussions` | List inline code review discussions, comment threads, and resolution statuses on a merge request. Supports filtering for unresolved review comments (unresolved_only: true). Use when reviewing outstanding code comments or verifying review feedback. Do NOT use for general project issue comments; use 'list_issue_notes' instead. | No |
| `create_diff_discussion` | Start a new inline code review discussion thread anchored to a specific file and line number in an MR diff. Automatically resolves the required base_sha, start_sha, and head_sha from the MR if omitted. Use during code reviews to leave actionable inline feedback. Side effect: posts a public review thread immediately. | **Yes** |
| `reply_merge_request_discussion` | Post a reply comment into an existing code review discussion thread on a merge request. Use to answer review feedback or confirm code fixes. Side effect: appends a reply note to the discussion thread immediately. Do NOT use to resolve the discussion; use 'resolve_merge_request_discussion' instead. | **Yes** |
| `update_merge_request_discussion_note` | Edit or update the text of an existing review comment in an MR discussion thread. Use when correcting review remarks or updating code suggestions. Side effect: modifies the comment text immediately. Do NOT use to post new comments; use 'reply_merge_request_discussion' or 'create_diff_discussion' instead. | **Yes** |
| `resolve_merge_request_discussion` | Resolve or unresolve an entire code review discussion thread on a merge request. Use when verification has confirmed that review feedback has been addressed. Side effect: updates the review thread resolution status immediately. | **Yes** |
| `accept_merge_request` | Merge an approved merge request into its target branch. Supports squash commits, custom merge commit messages, and deleting the source branch upon merge. Side effect: merges branches and triggers downstream CI/CD deployment pipelines immediately. Do NOT use if tests are failing or approvals are pending. | **Yes** |
| `create_merge_request_note` | Post a top-level general comment or review summary note on a merge request. Use for overall review summaries, LGTMs, or test execution reports. Side effect: posts a general note to the MR immediately. Do NOT use for line-specific diff review feedback; use 'create_diff_discussion' instead. | **Yes** |

### 8. Issues & Roadmaps (`issues` — 8 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_issues` | List and filter project issues by state ('opened', 'closed', 'all'), milestone, labels, author, assignee, or keyword search pushed directly upstream to GitLab's indexed database. Architectural Best Practice: For known issues, always prefer 'get_issue' with exact issue_iid rather than broad listing. | No |
| `get_issue` | Retrieve comprehensive details for a specific issue by its project-scoped IID (#<iid>), including description, assignees, labels, milestone, and issue status. Use to review issue requirements or track resolution. Do NOT use to list comments on the issue; use 'list_issue_notes' instead. | No |
| `create_issue` | Create a new issue with a title, markdown description, milestone (by title or ID), labels, assignees, and optional due date. Use to report bugs, track user stories, or plan tasks. Side effect: creates a new GitLab issue immediately. Do NOT use to comment on existing issues; use 'create_issue_note' instead. | **Yes** |
| `update_issue` | Update an existing issue's title, description, state ('close' or 'reopen'), milestone, labels, or assignees. Use to transition issue lifecycle or update task status. Side effect: alters issue state immediately. Do NOT use to post progress comments; use 'create_issue_note' instead. | **Yes** |
| `list_issue_notes` | List the chronological discussion notes, user comments, and activity audit log for a specific issue by IID. Use to review problem discussion, past comments, or implementation progress. Do NOT use for merge request discussions; use 'list_merge_request_discussions' instead. | No |
| `create_issue_note` | Post a new markdown comment, progress update, or verification note to an existing issue. Use to communicate findings, document test results, or ask questions on a task. Side effect: posts a public comment to the issue thread immediately. | **Yes** |
| `list_issue_links` | List issue dependency links ('relates_to', 'blocks', 'is_blocked_by') associated with a specific issue. Use when analyzing task dependencies or release blockers. Do NOT use to inspect issue discussion notes; use 'list_issue_notes' instead. | No |
| `create_issue_link` | Create a dependency or relationship link between two issues ('relates_to', 'blocks', 'is_blocked_by'), across the same project or across different projects. Use to track blocker relationships or connected bug reports. Side effect: creates a bi-directional issue relationship immediately. | **Yes** |

### 9. Milestones & Labels (`milestones` — 6 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_milestones` | List project and ancestor group milestones filtered by state ('active', 'closed', 'all') with start dates, due dates, and progress. Use to track sprint goals, release targets, or project roadmaps. Do NOT use to inspect individual issue lists inside a milestone; use 'list_issues' with a milestone filter instead. | No |
| `get_milestone` | Retrieve comprehensive details for a specific project milestone by numeric ID, including description, dates, and state. Use when validating target milestone dates or checking milestone progress. Do NOT use to list project milestones; use 'list_milestones' instead. | No |
| `create_milestone` | Create a new project milestone with a title, description, start date, and due date. Use to plan a release version, sprint, or delivery roadmap. Side effect: creates a new project milestone immediately. Do NOT use to create releases; use 'create_release' instead. | **Yes** |
| `update_milestone` | Update an existing milestone's title, description, due date, start date, or lifecycle state ('activate' or 'close'). Use to adjust release schedules or complete sprints. Side effect: alters milestone metadata immediately. | **Yes** |
| `list_labels` | List labels available within a project (including inherited ancestor group labels) with colors and descriptions. Use to discover valid taxonomy labels before categorizing issues or merge requests. Do NOT use to create new labels; use 'create_label' instead. | No |
| `create_label` | Create a new label with a name, hexadecimal color code, and description in a project. Use when establishing project workflow tags, priority markers, or component categories. Side effect: creates a new project label immediately. | **Yes** |

### 10. Releases & Tags (`releases` — 5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_releases` | List published GitLab releases, version tags, changelog descriptions, and linked assets. Use when checking released versions or reviewing release history. Do NOT use to inspect raw git tags without release notes; use 'list_tags' instead. | No |
| `get_release` | Retrieve comprehensive details for a published release by tag name, including markdown release notes, author, and downloadable asset links. Use to view full release notes or changelogs. Do NOT use to inspect milestone goals; use 'get_milestone' instead. | No |
| `create_release` | Publish a formal GitLab release associated with a git tag, including title, markdown changelog notes, and linked milestone titles. If the tag does not exist, ref is required to create it. Side effect: creates a formal public release entry. Do NOT use to create bare tags; use 'create_tag' instead. | **Yes** |
| `list_tags` | List Git tags in the repository with commit target SHAs, release links, and annotation messages. Use to check if a specific release tag already exists before tagging. Do NOT use to view release notes; use 'list_releases' instead. | No |
| `create_tag` | Create an annotated or lightweight Git tag pointing to a specific branch or commit SHA. Use to mark release points or version milestones in Git history. Side effect: creates a new Git tag on the remote repository immediately. Do NOT use to publish full release notes; use 'create_release' instead. | **Yes** |

### 11. Project Collaborators & Roles (`members` — 5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_project_members` | List project members and collaborators with their assigned access levels, roles, and membership expiration dates. Supports filtering and including inherited group members. Use to audit project permissions or check collaborator access before assigning tasks. Do NOT use to inspect global user profiles; use 'get_current_user' instead. | No |
| `get_project_member` | Retrieve membership details, access level, and permissions for a specific user in a project by numeric ID or username. Use to verify whether a collaborator has Developer or Maintainer rights before triggering protected actions. Do NOT use to search all members; use 'list_project_members' instead. | No |
| `add_project_member` | Grant project access to a user with a specific role ('guest', 'reporter', 'developer', 'maintainer', 'owner') and optional expiration date. Resolves usernames automatically. Side effect: grants repository permissions immediately. Do NOT use to update existing memberships; use 'update_project_member' instead. | **Yes** |
| `update_project_member` | Change an existing collaborator's access level role or expiration date within a project. Resolves usernames automatically. Side effect: alters project access control immediately. Do NOT use to add new members; use 'add_project_member' instead. | **Yes** |
| `remove_project_member` | Revoke a collaborator's access to a project repository and its associated resources. Side effect: DESTRUCTIVE for user access; immediately removes repository permissions. Do NOT use to adjust access levels; use 'update_project_member' instead. | **Yes** |

### 12. CI/CD Environment Variables (`variables` — 5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_project_variables` | List all CI/CD pipeline variables configured for a project, including keys, variable types ('env_var' or 'file'), protected/masked flags, and environment scopes. Use to verify secret and configuration presence before running build/deploy pipelines. Do NOT use to fetch secret values; use 'get_project_variable' instead. | No |
| `get_project_variable` | Retrieve comprehensive details and current value of a specific CI/CD variable by key name. Use when debugging pipeline environment failures or checking secret values. Do NOT use to list all configured variables; use 'list_project_variables' instead. | No |
| `create_project_variable` | Create a new CI/CD pipeline variable ('env_var' or 'file') with protected, masked, and environment scope settings. Use when configuring build secrets, tokens, or environment configs. Side effect: exposes the variable to CI/CD pipeline jobs immediately. Do NOT use to update existing variables; use 'update_project_variable' instead. | **Yes** |
| `update_project_variable` | Update the value, masking status, protection status, or environment scope of an existing CI/CD variable. Use when rotating secrets or updating configuration values. Side effect: alters the pipeline execution environment immediately. Do NOT use to create new variables; use 'create_project_variable' instead. | **Yes** |
| `delete_project_variable` | Permanently delete a CI/CD pipeline variable from a project by key. Use when revoking expired credentials or cleaning up obsolete configuration. Side effect: DESTRUCTIVE; subsequent pipeline runs will no longer have access to this variable. | **Yes** |

### 13. Wikis & Documentation (`wikis` — 4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_wikis` | List all wiki documentation pages in a project with page slugs, titles, and formatting types. Use to discover available project documentation or guides. Do NOT use to read complete page contents; use 'get_wiki' instead. | No |
| `get_wiki` | Retrieve wiki documentation content by page slug, with token-saving options including structured Table of Contents (toc_only: true) or targeting a specific chapter/heading section (section: 'Heading'). Use to consult project architectural guides without context blowout. Do NOT use for repository files; use 'get_file_contents' instead. | No |
| `create_wiki` | Create a new wiki documentation page in a project with markdown content and formatting options. Use to document setup procedures, architecture, or design runbooks. Side effect: creates a new project wiki page immediately. Do NOT use to update existing pages; use 'update_wiki' instead. | **Yes** |
| `update_wiki` | Update the markdown content or title of an existing project wiki page by slug. Use to update living project documentation, runbooks, or specifications. Side effect: alters the wiki page content immediately. Do NOT use to create new wiki pages; use 'create_wiki' instead. | **Yes** |

### 14. Snippets & Code Pastes (`snippets` — 4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_snippets` | List code snippets published in a GitLab project with author details, file names, and visibility levels ('private', 'internal', 'public'). Use to discover utility scripts, SQL queries, or configuration templates stored in project snippets. Do NOT use to inspect raw snippet code; use 'get_snippet' instead. | No |
| `get_snippet` | Retrieve comprehensive details and raw text content for a specific code snippet by numeric ID. Use to inspect code scripts, patches, or configuration snippets. Do NOT use for repository files; use 'get_file_contents' instead. | No |
| `create_snippet` | Create a new code or text snippet in a project with a title, file name, markdown description, and visibility setting. Use to share debug scripts, one-off patches, or configuration snippets. Side effect: creates a new GitLab snippet immediately. Do NOT use to commit files to git repositories; use 'create_or_update_file' instead. | **Yes** |
| `update_snippet` | Update the code content, file name, title, description, or visibility of an existing project snippet by numeric ID. Use to maintain snippet code or adjust access. Side effect: alters the snippet immediately. Do NOT use to create new snippets; use 'create_snippet' instead. | **Yes** |

### 15. User & Group Context (`user` — 6 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `get_current_user` | Retrieve identity and profile details of the authenticated GitLab account (username, numeric ID, name, email, admin flag). Use to verify token validity, check active permissions, or discover your own username for assignment. Do NOT use to query other users' profiles; use 'list_project_members' instead. | No |
| `list_my_groups` | List GitLab groups and parent organizations where the authenticated user is an active member or owner with access roles. Use to discover namespace paths available for project creation or access audits. Do NOT use to inspect project lists directly; use 'list_group_projects' instead. | No |
| `create_group` | Create a new GitLab group or nested subgroup (using parent_id). Use to organize projects, manage team namespaces, and establish shared permissions. Side effect: creates a new group on GitLab immediately. | **Yes** |
| `get_group` | Retrieve comprehensive details for a specific GitLab group or namespace by its numeric ID or full path (e.g. 'buggycode'). Use when checking group-level visibility, description, or parent group hierarchy. Do NOT use to list projects in the group; use 'list_group_projects' instead. | No |
| `list_group_projects` | List all repositories and projects belonging to a specific GitLab group or organization with pagination and search. Supports include_subgroups (default: true). Use to discover projects within a team or enterprise namespace. Do NOT use for cross-instance project search; use 'search_repositories' instead. | No |
| `list_my_projects` | List GitLab projects where the authenticated user is a direct member, owner, or starred contributor with role summaries. Use to discover personal repositories or starred codebases. Do NOT use for generic text searches across public projects; use 'search_repositories' instead. | No |

<!-- END_CATALOG_REFERENCE -->

---

## Benchmarks: Token Economy in Action

Reproducible deterministic benchmark (`node test/benchmark-test.js` & `node test/catalog-execution-test.js`) measured against canonical **GitLab REST API v4** payloads (`test/fixtures/gitlab-api-v4-fixtures.js`, token count = `Math.ceil(utf8Bytes / 4)`):

| Operation | Raw GitLab API v4 | `@sumirati/mcp-gitlab` (JSON) | `@sumirati/mcp-gitlab` (Markdown) | Token Reduction (MD) |
| :--- | :---: | :---: | :---: | :---: |
| **System Prompt Tax (5 tools vs 90 actions)** | 27,681 tokens | — | **1,292 tokens** | **95.3% savings** |
| `get_project` (Single project inspect) | 971 tokens | 144 tokens | **124 tokens** | **87.2% savings** |
| `list_issues` (10 issues with v4 metadata) | 6,595 tokens | 1,906 tokens | **460 tokens** | **93.0% savings** |
| `list_merge_requests` (10 MRs with v4 metadata) | 6,377 tokens | 1,058 tokens | **423 tokens** | **93.4% savings** |
| `list_pipelines` (10 runs) | 880 tokens | 543 tokens | **212 tokens** | **75.9% savings** |
| `get_file_contents` (Source file, Base64 stripped) | 279 tokens | 201 tokens | **160 tokens** | **42.7% savings** |
| `get_merge_request_changes` (Code + lockfile diff) | 3,612 tokens | 156 tokens | **141 tokens** | **96.1% savings** |

### Complete 90-Action Catalog Benchmark (Across All 14 Domains)

Measured across all 90 handlers via `node test/catalog-execution-test.js`:

| Domain | Actions | Raw GitLab v4 Tokens | Projected JSON | Rendered Markdown | Token Savings (MD) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **repositories** | 10 | 8,966 tokens | 1,361 tokens | **728 tokens** | **91.9%** |
| **branches** | 7 | 6,797 tokens | 326 tokens | **245 tokens** | **96.4%** |
| **commits** | 2 | 1,942 tokens | 179 tokens | **125 tokens** | **93.6%** |
| **members** | 5 | 4,855 tokens | 197 tokens | **174 tokens** | **96.4%** |
| **variables** | 5 | 4,855 tokens | 200 tokens | **191 tokens** | **96.1%** |
| **issues** | 8 | 52,760 tokens | 6,454 tokens | **1,419 tokens** | **97.3%** |
| **milestones** | 6 | 39,570 tokens | 387 tokens | **217 tokens** | **99.5%** |
| **pipelines** | 10 | 65,950 tokens | 1,304 tokens | **726 tokens** | **98.9%** |
| **releases** | 5 | 32,975 tokens | 185 tokens | **193 tokens** | **99.4%** |
| **merge-requests** | 12 | 79,140 tokens | 1,498 tokens | **867 tokens** | **98.9%** |
| **wikis** | 4 | 26,380 tokens | 65 tokens | **69 tokens** | **99.7%** |
| **snippets** | 4 | 26,380 tokens | 465 tokens | **453 tokens** | **98.3%** |
| **user** | 6 | 39,570 tokens | 249 tokens | **251 tokens** | **99.4%** |
| **enterprise** | 6 | 39,570 tokens | 245 tokens | **302 tokens** | **99.2%** |
| **TOTAL (All 90 Actions)** | **90** | **429,710 tokens** | **13,115 tokens** | **5,960 tokens** | **98.6%** |

### Key Token Optimization Pillars:
- **Smart Diff & Lockfile Truncation**: Commit diffs (`get_commit`) and MR changes (`get_merge_request_changes`) automatically collapse dependency lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `go.sum`, `Cargo.lock`, `*.min.js`) via `ignore_lockfiles: true` by default, saving 1,000–3,000 tokens per review. Pass `ignore_lockfiles: false` if full lockfile diffs are required.
- **Conservative Default Pagination**: All list actions default to `per_page: 10` (max: 100), eliminating token waste from loading 20–50 items when only recent entries are needed.
- **Default High-Density Markdown Format**: Discovery (`gitlab_find_actions`), execution (`gitlab_execute_action`), project info (`get_project`), file inspection (`get_file_contents`), and commit inspection (`get_commit`) default to `format: "markdown"`, yielding 75%–96% token reductions for structured metadata.
- **Recursive Output Projection Filter (`projectOutput`)**: Strips GitLab REST API v4 noise metadata keys (`_links`, `avatar_url`, `references`, `time_stats`, `task_completion_status`, `commands_changes`, `user_notes_count`, `merge_requests_count`, `upvotes`, `downvotes`, `subscribed`, `has_tasks`, `service_desk_reply_to`, `moved_to_id`, `container_expiration_policy`, `permissions`, and null/empty fields) before payloads reach LLM context.

---

## Roadmap

### Upcoming (v3.2)
- [x] Upstream indexed filtering & strict pagination caps (`state`, `labels`, `milestone`, `author_id`, `assignee_id`)
- [x] Client error resilience (401 probe disambiguation, 403 insufficient scope, 429 rate limit backoff, 201 ghost write guard)
- [x] Hardened output projection with recursion depth guard (`maxDepth = 32`) and empty collection preservation
- [x] Nested subgroup hierarchy management (`create_group` with `parent_id`)
- [x] Smart CI/CD failure log extraction & ANSI sequence stripping in `get_job_trace` (`strip_ansi`, `smart_failure`)
- [x] Outline-first code symbol extraction & line range slicing in `get_file_contents` (`outline_only`, `start_line`, `end_line`)
- [ ] Pre-flight mergeability & conflict verification (`get_mergeability`)
- [ ] Token scope self-auditing & permission pre-flight

### Future Horizons (v3.x)
- [ ] Standardized collection `_summary` headers to facilitate multi-turn history pruning in LiteLLM / Eigent agent orchestration
- [ ] Remote Transports: Streamable SSE and HTTP remote server modes
- [ ] Scoped GraphQL query engine for relational deep inspections
- [ ] DevSecOps vulnerability & secret scanning alert queries
- [ ] Scoped & rate-guarded code search within project repositories

---

## Acknowledgements & Lineage

This project incorporates architectural concepts, schemas, and patterns from:
- **[`@modelcontextprotocol/server-gitlab`](https://github.com/modelcontextprotocol/servers-archived)** (MIT License) — Copyright (c) 2024 Anthropic, PBC / GitLab, PBC. Baseline repository and file schema patterns.
- **[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)** (MIT License) — Copyright (c) Anthropic, PBC.
- **[`zod`](https://github.com/colinhacks/zod)** (MIT License) — Colin McDonnell.
- **GitLab REST API v4** — GitLab, PBC.
- **[`jmrplens/gitlab-mcp-server`](https://github.com/jmrplens/gitlab-mcp-server)** — Dynamic action discovery and meta-dispatcher pattern concepts.
- Architectural patterns evaluated from `Vijay-Duke/mcp-gitlab` and `zereight/gitlab-mcp`.

See [`NOTICE`](./NOTICE) for complete third-party attribution details.

---

## License

This project is licensed under the [MIT License](./LICENSE) — Copyright (c) 2026 sumirati@buggycode.net.
