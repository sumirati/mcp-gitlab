# GitLab MCP Server (`@sumirati/mcp-gitlab`)

A robust, developer-ready, modular, and LLM-ergonomic Model Context Protocol (MCP) server for both self-hosted GitLab Community Edition (CE) and GitLab Enterprise Edition (EE).

[![npm version](https://img.shields.io/npm/v/@sumirati/mcp-gitlab.svg)](https://www.npmjs.com/package/@sumirati/mcp-gitlab)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-sumirati%2Fmcp--gitlab-181717?logo=github)](https://github.com/sumirati/mcp-gitlab)
[![GitLab](https://img.shields.io/badge/GitLab-sumirati%2Fmcp--gitlab-FC6D26?logo=gitlab)](https://gitlab.com/sumirati/mcp-gitlab)

---

## Mission

`MCP-gitlab` provides high-signal, LLM-optimized access to GitLab instances. Rather than dumping raw API payloads, it focuses on context efficiency, developer ergonomics, and native AI pair-programming workflows for codebase management, task coordination, CI/CD observability, wiki documentation, and release delivery.

---

## Core Pillars & Capabilities

### 1. Task & Project Planning
- **Full Issue Lifecycle**: CRUD operations, filtering by state, milestone, label, author, and assignee with clean summaries.
- **Smart Milestone Management**: Full CRUD with automatic resolution of human-readable `milestone_title` to internal numeric IDs.
- **Task Dependencies (`issue_links`)**: First-class tracking of `blocks`, `is_blocked_by`, and `relates_to` relationships for AI roadmap planning and dependency graphs.
- **Discussions & Progress Tracking (`issue_notes`)**: Post progress logs, test results, or design rationale directly to issues without modifying descriptions.

### 2. CI/CD & Test Observability
- **Pipelines & Job Inspection**: Query pipelines by branch, commit SHA, or execution status (`running`, `failed`, `success`).
- **Safe Job Log Tailing (`get_job_trace`)**: Safely tail test/build logs (`tail_lines`) so agents can inspect stack traces directly without token overflow.
- **JUnit Test Reports (`get_pipeline_test_report`)**: High-level test suite breakdowns (total, passed, failed, failure messages).

### 3. Release & Version Delivery
- **GitLab Releases API**: Create and inspect formal GitLab releases linked to Git tags, milestones, and markdown changelogs.
- **Git Tags**: List and create semantic version tags (`vX.Y.Z`).

### 4. Merge Request Review & Delivery
- **Full MR Lifecycle**: Create, inspect, update, and accept/merge MRs with branch cleanup and squash options.
- **Diff Reviews (`get_merge_request_changes`)**: Review code diffs and post review comments (`create_merge_request_note`).

### 5. Wiki Documentation & Token Slicing
- **Token-Efficient Wiki Exploration**: Inspect page outlines using `toc_only: true` before loading large documentation pages.
- **Targeted Section Extraction**: Jump directly to a topic using `section` or anchor notation (`page#topic`) to retrieve only the relevant lines.
- **Full Wiki Authoring**: Separate, explicit `create_wiki` and `update_wiki` operations.

### 6. Snippets & Code Templates
- **Project Snippets**: Manage shared code snippets, configuration files, and script templates with `list_snippets`, `get_snippet`, `create_snippet`, and `update_snippet`.

### 7. User & Identity Context
- **Current User Discovery (`get_current_user`)**: Check the authenticated identity, username, ID, and administrative privileges.
- **Group & Project Membership (`list_my_groups`, `list_my_projects`)**: Discover all accessible groups and owned or contributed projects.

### 8. Git Commits & Diffs
- **Commit History (`list_commits`)**: Query commit logs with author, date, and clean message summaries.
- **Commit Inspection (`get_commit`)**: View file modification manifests and token-capped diffs with optional single-file filtering (`file_path`).

---

## Architecture & Codebase Design

The server is built with a modular, maintainable architecture under `src/`:

```
MCP-gitlab/
├── index.js                  # Lightweight entry point (< 70 lines)
├── src/
│   ├── client.js             # HTTP client with rate-limiting, auth & pagination
│   ├── schemas.js            # Shared base schemas & Zod 4 JSON Schema converter
│   ├── helpers.js            # Token-saving payload summarizers & milestone resolver
│   └── tools/                # Domain-specific tool implementations
│       ├── repositories.js   # 7 repository & file tools
│       ├── issues.js         # 8 issue, note & link tools
│       ├── milestones.js     # 6 milestone & label tools
│       ├── pipelines.js      # 6 pipeline & job observability tools
│       ├── releases.js       # 5 release & tag tools
│       ├── merge-requests.js # 7 merge request review & merge tools
│       ├── wikis.js          # 4 wiki tools with TOC & section slicing
│       ├── snippets.js       # 4 snippet lifecycle tools
│       ├── user.js           # 3 user, group & project context tools
│       └── commits.js        # 2 commit history & diff tools
```

---

## LLM-First Architectural Principles

- **Context Token Economy**: Lean response payloads by default returning high-signal summaries instead of thousands of lines of raw GitLab API metadata.
- **Smart Auto-Resolution**: Transparently resolves paths (e.g. `'group/project-name'` vs numeric `31`), milestone titles, and label strings/arrays.
- **Self-Hosted & CE First**: Zero dependencies on GitLab Duo or enterprise licenses; connects over standard v4 REST using a Personal Access Token (PAT).
- **3-Tier Read-Only Defense (`GITLAB_READ_ONLY=true`)**: Complete safety guarantee when allowing AI agents to diagnose codebases. Filters mutating tools from `ListTools` (saving thousands of context tokens), intercepts tool invocation at the schema layer, and blocks non-GET/HEAD HTTP methods in the network client.

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

The server exposes **52 tools** organized across 10 functional domains:

### 1. Repository & Files (7 tools)
| Tool | Description |
| :--- | :--- |
| `search_repositories` | Search projects and repositories by query with pagination |
| `create_repository` | Create a new GitLab project/repository |
| `get_file_contents` | Read file or directory content from a repository |
| `create_or_update_file` | Create or update a single file with commit message |
| `push_files` | Commit multiple files in a single atomic commit |
| `fork_repository` | Fork a project into a user or group namespace |
| `create_branch` | Create a new branch from a commit, tag, or branch |

### 2. Issues & Notes (8 tools)
| Tool | Description |
| :--- | :--- |
| `list_issues` | List and filter issues (state, milestone, labels, assignee) |
| `get_issue` | Get details for an issue by project-scoped IID (`#<iid>`) |
| `create_issue` | Create an issue with title, description, milestone, and labels |
| `update_issue` | Update issue title, state, milestone, labels, or assignees |
| `list_issue_notes` | List discussions, comments, and activity log on an issue |
| `create_issue_note` | Post a comment or progress/verification note to an issue |
| `list_issue_links` | List related, blocking, or blocked-by issue dependencies |
| `create_issue_link` | Create an issue dependency (`relates_to`, `blocks`, `is_blocked_by`) |

### 3. Milestones & Labels (6 tools)
| Tool | Description |
| :--- | :--- |
| `list_milestones` | List project milestones with start and due dates |
| `get_milestone` | Get details for a milestone by numeric ID |
| `create_milestone` | Create a project milestone with due dates |
| `update_milestone` | Update milestone title, dates, description, or state |
| `list_labels` | List labels available in the project |
| `create_label` | Create a project label with color hex and description |

### 4. CI/CD Pipelines & Test Observability (6 tools)
| Tool | Description |
| :--- | :--- |
| `list_pipelines` | List CI/CD pipelines filtered by branch, tag, status, or SHA |
| `get_pipeline` | Get pipeline status, duration, and commit information |
| `create_pipeline` | Trigger a new CI/CD pipeline execution for a branch/tag |
| `list_pipeline_jobs` | List all jobs (build, test, deploy) and status in a pipeline |
| `get_job_trace` | Inspect terminal output log of a job with safe `tail_lines` |
| `get_pipeline_test_report` | Get JUnit test report summary (passed/failed suites, error traces) |

### 5. Releases & Tags (5 tools)
| Tool | Description |
| :--- | :--- |
| `list_releases` | List published releases and changelogs |
| `get_release` | Get release details by tag name |
| `create_release` | Publish a formal release with tag, changelog, and milestones |
| `list_tags` | List Git tags in the repository |
| `create_tag` | Create a Git tag pointing to a branch or commit |

### 6. Merge Requests (7 tools)
| Tool | Description |
| :--- | :--- |
| `list_merge_requests` | List merge requests filtered by state, branches, milestone, labels |
| `get_merge_request` | Get merge request details and status by IID (`!<iid>`) |
| `create_merge_request` | Create a merge request between branches |
| `update_merge_request` | Update MR title, description, state, milestone, or labels |
| `get_merge_request_changes` | Inspect code diffs and modified files in an MR |
| `accept_merge_request` | Merge an approved MR with squash and branch cleanup flags |
| `create_merge_request_note` | Post a review comment or note on a merge request |

### 7. Wiki Documentation (4 tools)
| Tool | Description |
| :--- | :--- |
| `list_wikis` | List all wiki pages in a GitLab project (slugs, titles, and formats) |
| `get_wiki` | Get wiki page content with `toc_only` outline or `section` extraction |
| `create_wiki` | Create a new wiki page with title, markdown content, and format |
| `update_wiki` | Update an existing wiki page's title or markdown content |

### 8. Snippets & Templates (4 tools)
| Tool | Description |
| :--- | :--- |
| `list_snippets` | List code snippets in a project with titles and visibility |
| `get_snippet` | Get snippet details and full raw content |
| `create_snippet` | Create a new code snippet with file name, description, and visibility |
| `update_snippet` | Update an existing code snippet's title, file name, or content |

### 9. User & Identity Context (3 tools)
| Tool | Description |
| :--- | :--- |
| `get_current_user` | Get authenticated user profile, username, ID, and admin status |
| `list_my_groups` | List groups the authenticated user belongs to with access level |
| `list_my_projects` | List projects owned by or accessible to the current user |

### 10. Commits & Diffs (2 tools)
| Tool | Description |
| :--- | :--- |
| `list_commits` | List repository commit logs filtered by branch/ref, path, or date |
| `get_commit` | Get commit details with file manifest and token-capped diffs (`file_path` filter) |

---

## Roadmap

- [x] **Project Wiki & Snippets Support**: Full CRUD, Table of Contents outlines, and chapter slicing.
- [x] **User & Identity Context**: Authenticated profile and group/project ownership discovery.
- [x] **Commit History & Multi-File Diffs**: Commit logs and safe, token-capped diffs.
- [x] **Read-Only Mode (`GITLAB_READ_ONLY=true`)**: 3-tier safety guard enabling AI agents to query, read, and diagnose GitLab assets without permission or capability to perform write operations, commits, or state changes.
- [ ] **Inline Diff Reviews**: Add support for posting review comments directly to specific diff lines/positions on Merge Requests (`create_diff_discussion`).
- [ ] **Streamable HTTP Remote Transport**: Support running as a remote/hosted MCP service alongside the default local stdio transport.

---

## Acknowledgements & Third-Party Lineage

This project incorporates architectural concepts, schemas, and patterns from:
- **[`@modelcontextprotocol/server-gitlab`](https://github.com/modelcontextprotocol/servers-archived)** (MIT License) — Copyright (c) 2024 Anthropic, PBC / GitLab, PBC. Baseline repository and file schema patterns.
- **[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)** (MIT License) — Copyright (c) Anthropic, PBC.
- **[`zod`](https://github.com/colinhacks/zod)** (MIT License) — Colin McDonnell.
- **GitLab REST API v4** — GitLab, PBC.
- Architectural patterns evaluated from `Vijay-Duke/mcp-gitlab` and `zereight/gitlab-mcp`.

See [`NOTICE`](./NOTICE) for complete third-party attribution details.

---

## License

This project is licensed under the [MIT License](./LICENSE) — Copyright (c) 2026 sumirati@buggycode.net.
