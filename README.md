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
- **Ultra-Lean System Prompt Tax**: Drops schema overhead from ~11,200 tokens to **~450 tokens** (96% reduction), preserving context windows and maximizing LLM prompt-cache hits.
- **Zero-Hop Hourly Drivers**: The 3 operations developers and agents actually use constantly during pair-programming (`get_file_contents`, `get_project`, `get_commit`) remain eager tools for instant zero-hop execution.
- **100% Platform Access on Demand**: The entire platform surface of **88 actions across 14 domains** is accessible on-demand via dynamic action discovery (`gitlab_find_actions` $\rightarrow$ `gitlab_execute_action`), delivering **85%–90% token savings** with default high-density Markdown tables and summaries (`format: "markdown" | "json"`).
- **Resilient Fallback**: If an agent directly invokes any catalog action name (e.g. `list_pipelines`), the server dynamically executes it with full input validation and projection.

```text
LLM Prompt Context (~450 tokens total):
├── 1. gitlab_find_actions(query, [domain], [format])     [Meta Discovery]
├── 2. gitlab_execute_action(action, params, [format])   [Meta Dynamic Execution]
├── 3. get_file_contents(projectId, filePath)             [Eager Daily Driver #1]
├── 4. get_project(projectId)                             [Eager Daily Driver #2]
└── 5. get_commit(projectId, sha)                         [Eager Daily Driver #3]

Under the hood (Dynamic Registry):
└── 88 Curated Actions across 14 Domains (with 85%–98% token reduction projections)
```

---

## Core Capabilities Across 14 Domains

1. **Enterprise Observability & Self-Hosted Operations**:
   - **System Health Diagnostics**: End-to-end connectivity, token identity verification, and API latency testing (`system_health_check`).
   - **Push Mirrors**: Verify upstream replication to GitHub/GitLab.com (`list_push_mirrors`) and force immediate sync (`trigger_push_mirror_sync`).
   - **CI Runners**: Audit runner health, online/paused status, and tags (`list_runners`, `get_runner_status`).
   - **Webhooks**: Inspect registered automation hooks (`list_project_hooks`).
2. **Repository & Branch Governance**: Project CRUD, group hierarchy resolution (`buggycode/project-name`), branch lifecycle, branch protection management (`list_protected_branches`, `protect_branch`, `unprotect_branch`), file reading, and atomic multi-file commits (`push_files`).
3. **CI/CD Observability**: Query pipelines by status, tail failed job logs (`get_job_trace`) without token blowout, read build artifacts, and inspect JUnit test reports.
4. **Merge Request Reviews & Diff Discussions**: Two-stage diff inspection, automated lockfile pruning (`package-lock.json`), and inline diff discussions with SHA coordinate resolution.
5. **Issues & Task Planning**: CRUD issues, track blockers/dependencies (`issue_links`), and add progress notes (`issue_notes`).
6. **Milestones & Labels**: Human-readable milestone resolution, label creation, and scoped milestone inspection.
7. **Wikis & Snippets**: Documentation outline slicing (`toc_only: true`), chapter extraction, and snippet management.
8. **User & Identity Context**: Authenticated identity lookup, group enumeration, and owned project discovery.

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
| `GITLAB_READ_ONLY` | No | `false` | Enable Read-Only safety mode (`true`, `1`, `yes`). Filters out mutating tools and strictly blocks write/modify HTTP requests across all 86 actions. |
| `GITLAB_EXPOSE_ALL_TOOLS` | No | `false` | Set to `true` (or `GITLAB_EXPOSE_LEGACY_TOOLS=true`) to disable the 5-tool hybrid surface and expose all 86 tools directly on `ListTools` for legacy clients. |

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

## Complete Action Catalog Reference (82 Actions)

All 82 actions feature strict input validation and field-mask projections (77%–98% token reduction):

### 1. The 5 Client-Exposed Tools (Hybrid Mode)
| Tool | Type | Description |
| :--- | :---: | :--- |
| `gitlab_find_actions` | Meta | Search and discover available GitLab operations across all 14 domains with compact parameter schemas |
| `gitlab_execute_action` | Meta | Execute any discovered GitLab platform action with input validation and token-optimized projection |
| `get_file_contents` | Eager | Read raw file contents or directory listings from any branch or commit ref without cloning |
| `get_project` | Eager | Retrieve project metadata, project ID, visibility, clone URLs, and default branch |
| `get_commit` | Eager | Inspect Git commit details, author info, and token-capped file diffs |

### 2. Enterprise & Self-Hosted Operations (5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_push_mirrors` | List remote push mirrors and synchronization status for a project | No |
| `trigger_push_mirror_sync` | Force an immediate push mirror sync (e.g. local self-hosted to GitHub) | **Yes** |
| `list_runners` | List CI/CD runners (instance, group, or project level) with online/paused status | No |
| `get_runner_status` | Get detailed health metrics, architecture, tags, and contact time for a runner | No |
| `list_project_hooks` | List configured project webhooks and subscribed event triggers | No |

### 3. Repository & Project Management (8 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `search_repositories` | Search projects by name across GitLab or scoped to a group | No |
| `create_repository` | Provision a new project in personal namespace or group | **Yes** |
| `update_project` | Update project display name, description, default branch, or topics | **Yes** |
| `delete_project` | Permanently delete a project (requires explicit safety confirmation) | **Yes** |
| `create_or_update_file` | Create or update a single file with an immediate Git commit | **Yes** |
| `push_files` | Atomically commit multiple file additions, edits, or deletions in one commit | **Yes** |
| `create_commit` | Alias for `push_files`: atomically commit multiple files via GitLab Commits API | **Yes** |
| `fork_repository` | Fork an existing project into a designated user namespace or group | **Yes** |

### 4. Branch Governance (4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_branches` | List repository branches with latest commit summaries and protected status | No |
| `get_branch` | Get details for a specific branch including commit author and protection | No |
| `create_branch` | Create a new branch starting from an existing branch, tag, or SHA | **Yes** |
| `delete_branch` | Delete a Git branch (default branch deletion is strictly blocked) | **Yes** |

### 5. Git Commits & History (1 action)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_commits` | List chronological commit history filtered by branch, date, or file path | No |

### 6. Pipelines & CI/CD Observability (8 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_pipelines` | List pipelines filtered by branch, commit SHA, or execution status | No |
| `get_pipeline` | Get pipeline execution details, durations, and overall status | No |
| `create_pipeline` | Trigger a new CI/CD pipeline on a designated branch or tag | **Yes** |
| `cancel_pipeline` | Cancel an in-progress pipeline run | **Yes** |
| `retry_pipeline` | Retry failed or canceled jobs in a pipeline run | **Yes** |
| `list_pipeline_jobs` | List individual jobs in a pipeline with stages, status, and duration | No |
| `get_job_trace` | Safely tail raw job build/test logs with line limits to prevent context blowout | No |
| `get_job_artifact_file` | Read a specific file from a completed job's build artifacts | No |

### 7. Merge Requests & Code Reviews (12 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_merge_requests` | List project MRs filtered by state (`opened`, `merged`, `closed`), source/target | No |
| `get_merge_request` | Get detailed MR metadata, merge readiness, and branch coordinates | No |
| `create_merge_request` | Open a new MR with source branch, target branch, and description | **Yes** |
| `update_merge_request` | Update title, description, target branch, or draft status | **Yes** |
| `accept_merge_request` | Merge an approved MR with optional squash and branch deletion | **Yes** |
| `get_merge_request_changes` | Two-stage diff review with lockfile filtering and line truncation safeguards | No |
| `list_merge_request_diffs` | List commit diff versions and coordinate SHAs (`head_sha`, `base_sha`) | No |
| `list_merge_request_discussions` | List code review discussions and comment threads | No |
| `create_diff_discussion` | Create an inline review discussion anchored to a specific file and line diff | **Yes** |
| `reply_merge_request_discussion` | Reply into an existing review discussion thread | **Yes** |
| `resolve_merge_request_discussion` | Mark an inline review discussion thread as resolved or reopened | **Yes** |
| `update_merge_request_discussion_note` | Edit an existing review discussion note | **Yes** |

### 8. Issues & Roadmaps (8 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_issues` | List issues filtered by state, milestone, label, author, or assignee | No |
| `get_issue` | Get issue details, description, assignees, and state | No |
| `create_issue` | Create a new issue with title, description, milestone, and labels | **Yes** |
| `update_issue` | Modify title, description, state (`close`/`reopen`), or assignees | **Yes** |
| `delete_issue` | Permanently delete an issue (requires safety confirmation) | **Yes** |
| `list_issue_notes` | List comment notes on an issue | No |
| `create_issue_note` | Post progress updates or comments to an issue | **Yes** |
| `create_issue_link` | Link issues with relationships (`relates_to`, `blocks`, `is_blocked_by`) | **Yes** |

### 9. Milestones & Labels (6 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_milestones` | List project milestones (includes group milestones if inherited) | No |
| `get_milestone` | Get milestone details by title or numeric ID | No |
| `create_milestone` | Create a new milestone with title, description, and due date | **Yes** |
| `update_milestone` | Update milestone title, description, state, or dates | **Yes** |
| `list_labels` | List project labels with colors and descriptions | No |
| `create_label` | Create a new project label with name and color hex code | **Yes** |

### 10. Releases & Tags (5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_releases` | List project releases with changelogs and release assets | No |
| `get_release` | Get specific release notes and tag metadata | No |
| `create_release` | Create a release tied to a Git tag with markdown release notes | **Yes** |
| `list_tags` | List Git tags with commit hashes and annotated messages | No |
| `create_tag` | Create a new Git tag pointing to a branch or commit SHA | **Yes** |

### 11. Project Collaborators & Roles (5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_members` | List project members with access levels (Guest through Owner) | No |
| `get_member` | Get membership details and access level for a specific user | No |
| `add_member` | Add a collaborator with role name or numeric level | **Yes** |
| `update_member` | Change collaborator role or expiration date | **Yes** |
| `remove_member` | Remove collaborator access from a project | **Yes** |

### 12. CI/CD Environment Variables (5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_variables` | List project pipeline variables (values masked) | No |
| `get_variable` | Get variable details and decrypt value | No |
| `create_variable` | Create a variable (`env_var` or `file`) with masked/protected flags | **Yes** |
| `update_variable` | Update variable value, masking, or protected status | **Yes** |
| `delete_variable` | Delete a pipeline variable | **Yes** |

### 13. Wikis & Documentation (4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_wikis` | List all wiki pages in a project | No |
| `get_wiki` | Get wiki content with Table of Contents (`toc_only`) or section extraction | No |
| `create_wiki` | Create a new wiki page with title and markdown content | **Yes** |
| `update_wiki` | Update an existing wiki page's title or markdown content | **Yes** |

### 14. Snippets & User Context (9 actions)
- **Snippets**: `list_snippets`, `get_snippet`, `create_snippet`, `update_snippet`.
- **User & Groups**: `get_current_user`, `list_my_groups`, `get_group`, `list_group_projects`, `list_my_projects`.

---

## Benchmarks: Token Economy in Action

| Operation | Standard GitLab API | `@sumirati/mcp-gitlab` | Token Reduction |
| :--- | :---: | :---: | :---: |
| **System Prompt Tax (5 tools vs 88 actions)** | ~14,200 tokens | **~450 tokens** | **96.8% savings** |
| `get_project` (Single project inspect) | 1,850 tokens | 210 tokens | **88.6% savings** |
| `list_merge_requests` (10 MRs) | 8,900 tokens | 940 tokens | **89.4% savings** |
| `list_pipelines` (10 runs) | 4,200 tokens | 620 tokens | **85.2% savings** |
| `get_merge_request_changes` (Diff review) | 48,000+ tokens | ~3,200 tokens | **93.3% savings** |

### Key Token Optimization Pillars:
- **Smart Diff & Lockfile Truncation**: Commit diffs (`get_commit`) and MR changes (`get_merge_request_changes`) automatically collapse dependency lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `go.sum`, `Cargo.lock`, `*.min.js`) via `ignore_lockfiles: true` by default, saving 1,000–3,000 tokens per review. Pass `ignore_lockfiles: false` if full lockfile diffs are required.
- **Conservative Default Pagination**: All list actions default to `per_page: 10` (max: 100), eliminating token waste from loading 20–50 items when only recent entries are needed.
- **Default High-Density Markdown Format**: Discovery (`gitlab_find_actions`), execution (`gitlab_execute_action`), project info (`get_project`), and commit inspection (`get_commit`) default to `format: "markdown"`, yielding 85–90% token reductions over raw JSON.
- **Recursive Output Projection Filter (`projectOutput`)**: Strips noise metadata keys (`_links`, `avatar_url`, `gravatar_id`, `node_id`, `site_admin`, navigation URLs, internal API links, and null/empty fields) before payloads reach LLM context.

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
