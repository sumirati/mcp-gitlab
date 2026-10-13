# GitLab MCP Server (`@sumirati/mcp-gitlab`)

A robust, developer-ready, and LLM-ergonomic Model Context Protocol (MCP) server for both self-hosted GitLab Community Edition (CE) and GitLab Enterprise Edition (EE).

[![npm version](https://img.shields.io/npm/v/@sumirati/mcp-gitlab.svg)](https://www.npmjs.com/package/@sumirati/mcp-gitlab)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-sumirati%2Fmcp--gitlab-181717?logo=github)](https://github.com/sumirati/mcp-gitlab)
[![GitLab](https://img.shields.io/badge/GitLab-sumirati%2Fmcp--gitlab-FC6D26?logo=gitlab)](https://gitlab.com/sumirati/mcp-gitlab)

---

## Mission

`MCP-gitlab` provides high-signal, LLM-optimized access to GitLab instances. Rather than dumping raw API payloads, it focuses on context efficiency, developer ergonomics, and native AI pair-programming workflows for codebase management, task coordination, CI/CD observability, and release delivery.

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

---

## LLM-First Architectural Principles

- **Context Token Economy**: Lean response payloads by default returning high-signal summaries instead of thousands of lines of raw GitLab API metadata.
- **Smart Auto-Resolution**: Transparently resolves paths (e.g. `'group/project-name'` vs numeric `31`), milestone titles, and label strings/arrays.
- **Self-Hosted & CE First**: Zero dependencies on GitLab Duo or enterprise licenses; connects over standard v4 REST using a Personal Access Token (PAT).

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

The server exposes **39 tools** organized across key functional domains:

### Repository & Files
| Tool | Description |
| :--- | :--- |
| `search_repositories` | Search projects and repositories by query with pagination |
| `create_repository` | Create a new GitLab project/repository |
| `get_file_contents` | Read file or directory content from a repository |
| `create_or_update_file` | Create or update a single file with commit message |
| `push_files` | Commit multiple files in a single atomic commit |
| `fork_repository` | Fork a project into a user or group namespace |
| `create_branch` | Create a new branch from a commit, tag, or branch |

### Issues & Notes
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

### Milestones & Labels
| Tool | Description |
| :--- | :--- |
| `list_milestones` | List project milestones with start and due dates |
| `get_milestone` | Get details for a milestone by numeric ID |
| `create_milestone` | Create a project milestone with due dates |
| `update_milestone` | Update milestone title, dates, description, or state |
| `list_labels` | List labels available in the project |
| `create_label` | Create a project label with color hex and description |

### CI/CD Pipelines & Test Observability
| Tool | Description |
| :--- | :--- |
| `list_pipelines` | List CI/CD pipelines filtered by branch, tag, status, or SHA |
| `get_pipeline` | Get pipeline status, duration, and commit information |
| `create_pipeline` | Trigger a new CI/CD pipeline execution for a branch/tag |
| `list_pipeline_jobs` | List all jobs (build, test, deploy) and status in a pipeline |
| `get_job_trace` | Inspect terminal output log of a job with safe `tail_lines` |
| `get_pipeline_test_report` | Get JUnit test report summary (passed/failed suites, error traces) |

### Releases & Tags
| Tool | Description |
| :--- | :--- |
| `list_releases` | List published releases and changelogs |
| `get_release` | Get release details by tag name |
| `create_release` | Publish a formal release with tag, changelog, and milestones |
| `list_tags` | List Git tags in the repository |
| `create_tag` | Create a Git tag pointing to a branch or commit |

### Merge Requests
| Tool | Description |
| :--- | :--- |
| `list_merge_requests` | List merge requests filtered by state, branches, milestone, labels |
| `get_merge_request` | Get merge request details and status by IID (`!<iid>`) |
| `create_merge_request` | Create a merge request between branches |
| `update_merge_request` | Update MR title, description, state, milestone, or labels |
| `get_merge_request_changes` | Inspect code diffs and modified files in an MR |
| `accept_merge_request` | Merge an approved MR with squash and branch cleanup flags |
| `create_merge_request_note` | Post a review comment or note on a merge request |

---

## Roadmap

- [ ] **Read-Only Mode (`GITLAB_READ_ONLY=true`)**: Safeguard enabling AI agents to read, query, and diagnose GitLab assets without permission to perform write operations, commits, or state changes.
- [ ] **Inline Diff Reviews**: Add support for posting review comments directly to specific diff lines/positions on Merge Requests (`create_diff_discussion`).
- [ ] **Project Wiki & Snippets Support**: Expand tooling to read and update GitLab project wikis and code snippets.
- [ ] **Streamable HTTP Remote Transport**: Support running as a remote/hosted MCP service alongside the default local stdio transport.

---

## Acknowledgements & Third-Party Lineage

This project incorporates architectural concepts, schemas, and patterns from:
- **[`@modelcontextprotocol/server-gitlab`](https://github.com/modelcontextprotocol/servers-archived)** (MIT License) — Copyright (c) 2024 Anthropic, PBC / GitLab, PBC. Baseline repository and file schema patterns.
- **[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)** (MIT License) — Copyright (c) Anthropic, PBC.
- **[`zod`](https://github.com/colinhacks/zod)** & **[`zod-to-json-schema`](https://github.com/StefanTerdell/zod-to-json-schema)** (MIT License) — Colin McDonnell & Stefan Evertsson.
- **GitLab REST API v4** — GitLab, PBC.
- Architectural patterns evaluated from `Vijay-Duke/mcp-gitlab` and `zereight/gitlab-mcp`.

See [`NOTICE`](./NOTICE) for complete third-party attribution details.

---

## License

This project is licensed under the [MIT License](./LICENSE) — Copyright (c) 2026 sumirati@buggycode.net.
