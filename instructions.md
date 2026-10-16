# GitLab MCP Server Usage Guide

## Project Identifier
You can pass either the numeric project ID or the URL/namespace path for `project_id`:
- Numeric ID: `31`
- Namespace Path: `"2aim/avendoo-bridge"` (URL-encoding is automatically handled)

## Issues & Tasks
- **Issue Numbering**: Always use the project-scoped `issue_iid` (e.g. `14` for `#14`), not the global internal database `id`.
- **Milestones**: You can specify either `milestone_title` (e.g. `"Phase 2: Configuration & Security Hardening"`) or `milestone_id`. Titles are auto-resolved automatically.
- **Labels**: Pass either an array `["backend", "security"]` or a comma-separated string `"backend, security"`.
- **Issue Notes**: Use `create_issue_note` to post updates, test execution results, or architectural notes without rewriting the issue description.
- **Dependencies & Blockers**: Use `create_issue_link` with `link_type`: `"blocks"`, `"is_blocked_by"`, or `"relates_to"`.

## CI/CD Pipelines & Test Logs
- **Checking Build / Test Status**: Run `list_pipelines` to check status (`success`, `failed`, `running`).
- **Diagnosing Test Failures**:
  1. Call `list_pipeline_jobs` with `pipeline_id` to find the failing job.
  2. Call `get_job_trace` with `job_id`. By default, `smart_failure: true` and `strip_ansi: true` automatically scan for the failure anchor (errors, panics, assertion failures) and return the failure block and teardown tail without flooding context.
  3. Call `get_pipeline_test_report` to get high-level JUnit summaries (passed/failed test suite counts).

## Releases & Version Delivery
- **Tags**: Use `create_tag` to point a semantic tag (e.g. `v2.0.0`) to a branch or commit.
- **Releases**: Use `create_release` with `tag_name`, `name`, `description` (changelog), and associated `milestones`.

## Merge Requests
- Inspect diffs with `get_merge_request_changes`.
- Complete work items with `accept_merge_request` (with `squash` and `should_remove_source_branch` flags).

## Atomic Multi-File Commits
- **Batch Commits without Local Git**: When creating or modifying multiple files simultaneously (e.g. refactoring code and updating documentation together), do **NOT** invoke `create_or_update_file` in a loop.
- **Use `create_commit` (or `push_files`)**: Provide `project_id`, `branch`, `commit_message` (or `message`), and an array `files: [{ file_path: "src/file1.js", content: "..." }, { file_path: "docs/file2.md", content: "..." }]`. This constructs a single atomic Git commit via GitLab's Commits API directly on the remote branch without local git cloning.

## Daily Drivers & Token Economy
- **Code Inspection (Outline First)**: Always prefer `get_file_contents` to inspect files without cloning.
  - Set `outline_only: true` on initial file inspection to extract function, class, and method symbol signatures with line numbers in ~50-100 tokens.
  - Follow up with `start_line` and `end_line` (e.g. lines 120–160) to inspect only the targeted function implementation.
- **Commit Inspection**: Use `get_commit` with `max_diff_lines` and optional `file_path` filter.
- **Smart Diff & Lockfile Truncation**: `get_commit` and `get_merge_request_changes` automatically collapse/filter noisy dependency lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `go.sum`, `Cargo.lock`, `*.min.js`) via `ignore_lockfiles: true` by default. Pass `ignore_lockfiles: false` if you explicitly need to inspect lockfile changes.
- **Conservative Pagination**: All list actions default to `per_page: 10` (max: 100) to protect LLM context windows and prevent token waste.
- **Default High-Density Markdown Format**: Discovery (`gitlab_find_actions`), execution (`gitlab_execute_action`), project info (`get_project`), and commit inspection (`get_commit`) default to `format: "markdown"`, yielding 85–90% token reduction over raw JSON.
- **Dynamic Discovery**: For all other platform actions (mirrors, runners, variables, wikis, members), use `gitlab_find_actions(query: "...")` to look up parameter signatures before invoking `gitlab_execute_action`.
