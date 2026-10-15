# GitLab MCP Server (`@sumirati/mcp-gitlab`)

A robust, developer-ready, modular, and LLM-ergonomic Model Context Protocol (MCP) server for both self-hosted GitLab Community Edition (CE) and GitLab Enterprise Edition (EE).

[![npm version](https://img.shields.io/npm/v/@sumirati/mcp-gitlab.svg)](https://www.npmjs.com/package/@sumirati/mcp-gitlab)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-sumirati%2Fmcp--gitlab-181717?logo=github)](https://github.com/sumirati/mcp-gitlab)
[![GitLab](https://img.shields.io/badge/GitLab-sumirati%2Fmcp--gitlab-FC6D26?logo=gitlab)](https://gitlab.com/sumirati/mcp-gitlab)

---

## Mission

`MCP-gitlab` provides high-signal, LLM-optimized access to GitLab instances. Rather than dumping raw API payloads, it focuses on context efficiency, developer ergonomics, and native AI pair-programming workflows for codebase management, task coordination, CI/CD observability, project governance, wiki documentation, and release delivery.

---

## Core Pillars & Capabilities

### 1. Repository & Project Governance
- **Full Project Lifecycle**: Create, inspect, update (name, description, default branch, visibility, topics), and safely delete repositories (with explicit safety confirmation).
- **Group & Namespace Hierarchy**: Support for group namespaces (e.g. `buggycode/project-name`), automatic group name/path resolution (`resolveNamespaceId`), group project search, and group metadata inspection.
- **Branch Management**: List branches with commit status, inspect branches, create branches, and delete stale feature branches (with default-branch deletion protection).
- **Project Members & Permissions**: Add, list, inspect, and remove project collaborators with full role mapping (Guest, Reporter, Developer, Maintainer, Owner).
- **Files & Batch Commits**: Read file/directory trees, update single files, or commit batches across multiple files atomically.

### 2. Task & Project Planning
- **Full Issue Lifecycle**: CRUD operations, filtering by state, milestone, label, author, and assignee with clean summaries.
- **Smart Milestone Management**: Full CRUD with automatic resolution of human-readable `milestone_title` to internal numeric IDs (including inherited group milestones).
- **Task Dependencies (`issue_links`)**: First-class tracking of `blocks`, `is_blocked_by`, and `relates_to` relationships for AI roadmap planning and dependency graphs.
- **Discussions & Progress Tracking (`issue_notes`)**: Post progress logs, test results, or design rationale directly to issues without modifying descriptions.

### 3. CI/CD, Observability & Environment Variables
- **CI/CD Project Variables**: Full lifecycle (create, list, inspect, update, delete) for pipeline variables (`env_var` and `file`) with protected, masked, and scoped environment configurations.
- **Pipelines & Job Inspection**: Query pipelines by branch, commit SHA, or execution status (`running`, `failed`, `success`), and inspect detailed job metrics, durations, and runners.
- **Safe Job Log Tailing (`get_job_trace`)**: Safely tail test/build logs (`tail_lines`) so agents can inspect stack traces directly without token overflow.
- **Artifacts Inspection (`get_job_artifact_file`)**: Read and inspect generated build artifacts, test summaries, and reports directly from job runs.
- **JUnit Test Reports (`get_pipeline_test_report`)**: High-level test suite breakdowns (total, passed, failed, failure messages).

### 4. Merge Request Code Reviews & Diff Discussions
- **Token-Efficient Diff Inspection (`get_merge_request_changes`)**: Two-stage review (manifest first, diffs on demand), lockfile pruning (`package-lock.json`, `poetry.lock`), single-file diff filtering, and line truncation safeguards.
- **Inline Code Review Discussions (`create_diff_discussion`)**: Post comments targeting specific lines in the diff with automatic SHA coordinate resolution (`head_sha`, `base_sha`, `start_sha`).
- **Discussion Thread Replies (`reply_merge_request_discussion`)**: Enable contributors and reviewers to reply directly into active inline threads without requiring maintainer privileges.
- **Discussion Notes Editing (`update_merge_request_discussion_note`)**: Update and refine review feedback inline.
- **Resolution Lifecycle (`list_merge_request_discussions`, `resolve_merge_request_discussion`)**: Filter unresolved discussions to audit blocking feedback, and resolve threads upon verification.
- **Full Merge Delivery (`accept_merge_request`)**: Merge approved MRs with squash and branch cleanup flags.

### 5. Wiki Documentation & Token Slicing
- **Token-Efficient Wiki Exploration**: Inspect page outlines using `toc_only: true` before loading large documentation pages.
- **Targeted Section Extraction**: Jump directly to a topic using `section` or anchor notation (`page#topic`) to retrieve only the relevant lines.
- **Full Wiki Authoring**: Separate, explicit `create_wiki` and `update_wiki` operations.

### 6. Snippets & Code Templates
- **Project Snippets**: Manage shared code snippets, configuration files, and script templates with `list_snippets`, `get_snippet`, `create_snippet`, and `update_snippet`.

### 7. User & Identity Context
- **Current User Discovery (`get_current_user`)**: Check the authenticated identity, username, ID, and administrative privileges.
- **Group & Project Membership (`list_my_groups`, `get_group`, `list_group_projects`, `list_my_projects`)**: Discover all accessible groups, group projects, and owned or contributed repositories.

### 8. Git Commits & Diffs
- **Commit History (`list_commits`)**: Query commit logs with author, date, and clean message summaries.
- **Commit Inspection (`get_commit`)**: View file modification manifests and token-capped diffs with optional single-file filtering (`file_path`).

---

## Architecture & Codebase Design

The server is built with a modular, maintainable architecture under `src/`:

```
MCP-gitlab/
├── index.js                  # Lightweight entry point (< 85 lines)
├── src/
│   ├── client.js             # HTTP client with rate-limiting, auth, read-only guard & pagination
│   ├── schemas.js            # Shared base schemas & Zod 4 JSON Schema converter
│   ├── helpers.js            # Token-saving payload summarizers, namespace & milestone resolvers
│   └── tools/                # 13 domain-specific tool implementations
│       ├── repositories.js   # 9 repository & project management tools
│       ├── branches.js       # 4 branch lifecycle tools
│       ├── members.js        # 5 project member & role tools
│       ├── variables.js      # 5 CI/CD project variable tools
│       ├── issues.js         # 8 issue, note & link tools
│       ├── milestones.js     # 6 milestone & label tools
│       ├── pipelines.js      # 8 pipeline, job, log & artifact tools
│       ├── releases.js       # 5 release & tag tools
│       ├── merge-requests.js # 12 merge request review, diff & discussion tools
│       ├── wikis.js          # 4 wiki tools with TOC & section slicing
│       ├── snippets.js       # 4 snippet lifecycle tools
│       ├── user.js           # 5 user, group & project context tools
│       └── commits.js        # 2 commit history & diff tools
```

---

## LLM-First Architectural Principles

- **Context Token Economy**: Lean response payloads by default returning high-signal summaries instead of thousands of lines of raw GitLab API metadata.
- **Smart Auto-Resolution**: Transparently resolves paths (e.g. `'group/project-name'` vs numeric `31`), milestone titles, user roles/access levels, and label strings/arrays.
- **Self-Hosted & CE First**: Zero dependencies on GitLab Duo or enterprise licenses; connects over standard v4 REST using a Personal Access Token (PAT).
- **3-Tier Read-Only Defense (`GITLAB_READ_ONLY=true`)**: Complete safety guarantee when allowing AI agents to diagnose codebases. Filters mutating tools from `ListTools` (saving thousands of context tokens), intercepts tool invocation at the dispatch layer, and blocks non-GET/HEAD HTTP methods in the network client.

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
# Or from GitLab.com:
# git clone https://gitlab.com/sumirati/mcp-gitlab.git

cd mcp-gitlab
npm install
node index.js
```

---

## Environment Configuration

Configure the following environment variables (or copy `.env.example` to `.env`):

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `GITLAB_PERSONAL_ACCESS_TOKEN` | **Yes** | — | Personal access token with `api` scope. |
| `GITLAB_API_URL` | No | `https://gitlab.com/api/v4` | Base API URL of your GitLab CE/EE or cloud instance. |
| `GITLAB_READ_ONLY` | No | `false` | Enable Read-Only safety mode (`true`, `1`, `yes`). Filters out mutating tools and strictly blocks write/modify HTTP requests. |
| `GITLAB_TOOL_DOMAINS` | No | `*` (all) | Comma-separated domain whitelist to restrict registered tools and preserve context window tokens (e.g. `'repositories,merge-requests,issues'`). Aliases supported: `mr`, `repos`, `ci`. |

---

## Tool Definition Quality Score (TDQS) & Tier A Compliance

All 77 tools adhere to the **[Tool Definition Quality Score (TDQS)](https://github.com/glama-ai/tool-definition-quality-score)** open framework:
- **Purpose Clarity**: Front-loaded active verbs and unambiguous resource targeting.
- **Usage Guidelines**: Explicit *when to use*, *when NOT to use*, and named alternative recommendations on every definition to eliminate agent tool mis-selection.
- **Behavioral Transparency**: Native MCP standard annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) and explicit side-effect disclosures.
- **System Prompt Economy**: Use `GITLAB_TOOL_DOMAINS` to slash schema overhead from ~10,000 tokens down to ~1,200 tokens for specialized agent roles (e.g. code reviewers).

---

## Client Configuration

### Google Antigravity / Claude Desktop / Cursor

Add to your MCP configuration file (`mcp_config.json` or `claude_desktop_config.json`):

#### Using npm / npx:
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

#### Using local repository:
```json
{
  "mcpServers": {
    "gitlab": {
      "command": "node",
      "args": ["/path/to/MCP-gitlab/index.js"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "<your-gitlab-token>",
        "GITLAB_API_URL": "https://gitlab.example.com/api/v4"
      }
    }
  }
}
```

---

## Complete Tools Reference

The server exposes **77 tools** organized across 13 functional domains (41 read-only, 36 mutating):

### 1. Repository & Project Management (9 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `search_repositories` | Search projects and repositories by query with pagination (supports group filter) | No |
| `get_project` | Get comprehensive project metadata, description, default branch, and statistics | No |
| `create_repository` | Create a new GitLab project/repository (supports groups/namespaces and empty repos) | **Yes** |
| `update_project` | Update project metadata (description, name, default branch, visibility, topics) | **Yes** |
| `delete_project` | Delete a project/repository (requires explicit name confirmation for safety) | **Yes** |
| `get_file_contents` | Read file or directory content from a repository | No |
| `create_or_update_file` | Create or update a single file with commit message | **Yes** |
| `push_files` | Commit multiple files in a single atomic commit | **Yes** |
| `fork_repository` | Fork a project into a user or group namespace | **Yes** |

### 2. Branch Management (4 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_branches` | List repository branches with commit details, default flag, and protected status | No |
| `get_branch` | Get specific branch details, commit SHA, and protection rules | No |
| `create_branch` | Create a new branch from a commit, tag, or branch | **Yes** |
| `delete_branch` | Delete a branch from a project repository (blocks default branch deletion) | **Yes** |

### 3. Project Members & Permissions (5 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_project_members` | List project members and collaborators with access levels and roles | No |
| `get_project_member` | Get details for a specific project member by user ID or username | No |
| `add_project_member` | Add a user to a project with specified role/access level | **Yes** |
| `update_project_member` | Update a project member's access level role or expiration date | **Yes** |
| `remove_project_member` | Remove a user/collaborator from a project | **Yes** |

### 4. CI/CD Project Variables (5 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_project_variables` | List CI/CD project variables with keys, types, protected/masked flags | No |
| `get_project_variable` | Get specific CI/CD variable details and value by key | No |
| `create_project_variable` | Create a new CI/CD project variable (env_var or file) | **Yes** |
| `update_project_variable` | Update an existing CI/CD project variable's value or configuration | **Yes** |
| `delete_project_variable` | Delete a CI/CD project variable by key | **Yes** |

### 5. Issues & Notes (8 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_issues` | List and filter issues (state, milestone, labels, assignee) | No |
| `get_issue` | Get details for an issue by project-scoped IID (`#<iid>`) | No |
| `create_issue` | Create an issue with title, description, milestone, and labels | **Yes** |
| `update_issue` | Update issue title, state, milestone, labels, or assignees | **Yes** |
| `list_issue_notes` | List discussions, comments, and activity log on an issue | No |
| `create_issue_note` | Post a comment or progress/verification note to an issue | **Yes** |
| `list_issue_links` | List related, blocking, or blocked-by issue dependencies | No |
| `create_issue_link` | Create an issue dependency (`relates_to`, `blocks`, `is_blocked_by`) | **Yes** |

### 6. Milestones & Labels (6 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_milestones` | List project milestones with start and due dates (supports ancestor groups) | No |
| `get_milestone` | Get details for a milestone by numeric ID | No |
| `create_milestone` | Create a project milestone with due dates | **Yes** |
| `update_milestone` | Update milestone title, dates, description, or state | **Yes** |
| `list_labels` | List labels available in the project (supports ancestor groups) | No |
| `create_label` | Create a project label with color hex and description | **Yes** |

### 7. CI/CD Pipelines, Jobs & Artifacts (8 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_pipelines` | List CI/CD pipelines filtered by branch, tag, status, or SHA | No |
| `get_pipeline` | Get pipeline status, duration, and commit information | No |
| `create_pipeline` | Trigger a new CI/CD pipeline execution for a branch/tag | **Yes** |
| `list_pipeline_jobs` | List all jobs (build, test, deploy) and status in a pipeline | No |
| `get_job` | Get comprehensive details about a CI/CD job (duration, runner, artifacts) | No |
| `get_job_trace` | Inspect terminal output log of a job with safe `tail_lines` | No |
| `get_job_artifact_file` | Download and read a specific file from a job's build artifacts archive | No |
| `get_pipeline_test_report` | Get JUnit test report summary (passed/failed suites, error traces) | No |

### 8. Releases & Tags (5 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_releases` | List published releases and changelogs | No |
| `get_release` | Get release details by tag name | No |
| `create_release` | Publish a formal release with tag, changelog, and milestones | **Yes** |
| `list_tags` | List Git tags in the repository | No |
| `create_tag` | Create a Git tag pointing to a branch or commit | **Yes** |

### 9. Merge Requests & Code Reviews (12 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_merge_requests` | List merge requests filtered by state, branches, milestone, labels | No |
| `get_merge_request` | Get merge request details and status by IID (`!<iid>`) | No |
| `create_merge_request` | Create a merge request between branches | **Yes** |
| `update_merge_request` | Update MR title, description, state, milestone, or labels | **Yes** |
| `get_merge_request_changes` | Inspect code diffs in an MR (supports token-saving summary, file filtering, and lockfile pruning) | No |
| `list_merge_request_discussions` | List inline code review discussions and threads on an MR (supports `unresolved_only` filter) | No |
| `create_diff_discussion` | Post an inline code review comment on a specific line and file (resolves SHAs automatically) | **Yes** |
| `reply_merge_request_discussion` | Post a reply comment into an existing MR code review discussion thread | **Yes** |
| `update_merge_request_discussion_note` | Update or edit the text of an existing review comment in an MR discussion thread | **Yes** |
| `resolve_merge_request_discussion` | Resolve or unresolve a code review discussion thread on an MR | **Yes** |
| `accept_merge_request` | Merge an approved MR with squash and branch cleanup flags | **Yes** |
| `create_merge_request_note` | Post a general review comment or note on a merge request | **Yes** |

### 10. Wiki Documentation (4 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_wikis` | List all wiki pages in a GitLab project (slugs, titles, and formats) | No |
| `get_wiki` | Get wiki page content with `toc_only` outline or `section` extraction | No |
| `create_wiki` | Create a new wiki page with title, markdown content, and format | **Yes** |
| `update_wiki` | Update an existing wiki page's title or markdown content | **Yes** |

### 11. Snippets & Templates (4 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_snippets` | List code snippets in a project with titles and visibility | No |
| `get_snippet` | Get snippet details and full raw content | No |
| `create_snippet` | Create a new code snippet with file name, description, and visibility | **Yes** |
| `update_snippet` | Update an existing code snippet's title, file name, or content | **Yes** |

### 12. User & Identity Context (5 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `get_current_user` | Get authenticated user profile, username, ID, and admin status | No |
| `list_my_groups` | List groups the authenticated user belongs to with access level | No |
| `get_group` | Get comprehensive group details, metadata, visibility, and description by ID or path | No |
| `list_group_projects` | List all projects and repositories belonging to a specific group or organization | No |
| `list_my_projects` | List projects owned by or accessible to the current user | No |

### 13. Commits & Diffs (2 tools)
| Tool | Description | Mutating? |
| :--- | :--- | :---: |
| `list_commits` | List repository commit logs filtered by branch/ref, path, or date | No |
| `get_commit` | Get commit details with file manifest and token-capped diffs (`file_path` filter) | No |

---

## Roadmap

### Delivered in v2.0.0
- [x] **Modular Codebase Architecture**: Domain-driven layout under `src/tools/` (< 85-line `index.js`).
- [x] **Context Token Economy**: Lean response summaries and Zod 4 JSON Schema engine.
- [x] **3-Tier Read-Only Safety Mode (`GITLAB_READ_ONLY=true`)**: Tool list filtering, dispatch-layer blocking, and HTTP client method interception.
- [x] **Project Wiki Documentation**: Full authoring, Table of Contents outline (`toc_only`), and chapter slicing.
- [x] **Project Code Snippets**: Full lifecycle (`list`, `get`, `create`, `update`).
- [x] **Branch Governance**: Complete branch management (`list`, `get`, `create`, `delete` with default-branch protection).
- [x] **Project Members & Permissions**: Add, list, inspect, update, and remove collaborators with role name mapping.
- [x] **CI/CD Project Variables**: Full lifecycle for pipeline variables with masked secret redaction.
- [x] **CI/CD Observability & Artifacts**: Detailed job inspection and safe file reading from build artifact archives.
- [x] **Inline MR Diff Reviews & Discussions**: Full 6-tool suite for authors, contributors, reviewers, and maintainers with automatic SHA coordinate resolution.
- [x] **Group & Namespace Hierarchy**: Support for group namespaces, auto-resolving group paths, group search, and group-inherited milestones/labels.

### Future Deliverables (Priority Backlog)

#### Tier 2: DevOps & Platform Setup
- [ ] **Protected Branch Access Rules**: Query and configure branch protection rules (`list_protected_branches`, `protect_branch`, `unprotect_branch`) to automate push/merge permissions.
- [ ] **Container & Package Registry**: Inspect published Docker image tags and packages (npm, Maven, generic) hosted in GitLab's built-in registry (`list_registry_repositories`, `list_packages`).
- [ ] **Deploy Keys & Deploy Tokens**: Manage read/write deploy tokens and deploy keys for automated CI/CD runners and external staging environments (`list_deploy_keys`, `create_deploy_token`).
- [ ] **Issue Kanban Boards**: Query visual issue boards and list columns (`list_boards`, `list_board_lists`) for sprint and backlog tracking.

#### Tier 3: Integrations & Administration
- [ ] **Project Webhooks & Integrations**: List and configure project webhooks (`list_project_hooks`, `create_project_hook`) for event notifications.

- [ ] **Streamable HTTP / SSE Remote Transport**: Support running as a remote/hosted MCP service alongside the default local stdio transport.
- [ ] **Upstream Contribution to `jmrplens/gitlab-mcp-server`**: Propose and contribute our token-saving output projection filters (77%–98% payload compression) upstream to the `jmrplens` Go project, helping the broader ecosystem reduce context window bloat.

---

## Upcoming Sibling Project: `@sumirati/mcp-github`

To enable seamless **cross-platform AI synchronization** across public edge repositories (GitHub.com, GitLab.com) and authoritative self-hosted GitLab masters, a dedicated sibling project **`@sumirati/mcp-github`** is planned. It will share the exact same architectural DNA as `@sumirati/mcp-gitlab`:
- Lightweight, zero-dependency Node.js runtime (`npx @sumirati/mcp-github`).
- Context token economy (manifest-first diff inspection, automatic lockfile filtering).
- 3-Tier Read-Only safety mode (`GITHUB_READ_ONLY=true`).
- Complete symmetry for PR diff discussions and GitHub Actions workflow log tailing.

---

## Acknowledgements & Third-Party Lineage

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
