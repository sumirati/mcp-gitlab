# GitLab MCP Server (`MCP-gitlab`)

A robust, developer-ready, and LLM-ergonomic Model Context Protocol (MCP) server for both self-hosted GitLab Community Edition (CE) and GitLab Enterprise Edition (EE).

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

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- A GitLab Personal Access Token with `api` scope

### Installation

```bash
git clone <your-gitlab-url>/mcp-gitlab.git
cd mcp-gitlab
npm install
```

### Environment Configuration

Copy `.env.example` to `.env` or export variables in your environment:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GITLAB_PERSONAL_ACCESS_TOKEN` | **Required**. Personal access token with `api` scope. | — |
| `GITLAB_API_URL` | Base API endpoint of your GitLab instance. | `https://gitlab.com/api/v4` |

```bash
# Example manual launch
GITLAB_PERSONAL_ACCESS_TOKEN="glpat-..." \
GITLAB_API_URL="https://gitlab.example.com/api/v4" \
node index.js
```

### Antigravity / Client Configuration

Add to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "node",
      "args": ["/path/to/MCP-gitlab/index.js"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "<your-gitlab-pat>",
        "GITLAB_API_URL": "https://gitlab.example.com/api/v4"
      }
    }
  }
}
```

---

## Roadmap & Upstream Contributions

- **Log Analysis & Diagnostics**: Upstream CI/CD failure diagnostics (`job_trace` with log tailing + `pipeline_test_report`) to community servers.
- **Milestone & Dependency Management**: Add dedicated Milestone CRUD and `issue_links` for blocker management.
- **GitLab CLI (`glab`)**: Propose adding issue link dependencies and milestone title resolution to `glab mcp serve`.
- **Standalone Package**: Publish as an independent open-source package for developers seeking a drop-in GitLab MCP integration.

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
