import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { summarizeCommit } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListCommitsSchema = ProjectParamsSchema.extend({
  ref_name: z.string().optional().describe("Branch name, tag, or commit range (default: default branch / HEAD)"),
  since: z.string().optional().describe("Only commits after or on this date (ISO 8601 or YYYY-MM-DD)"),
  until: z.string().optional().describe("Only commits before or on this date"),
  path: z.string().optional().describe("File path to filter commit history for (e.g. 'src/auth.js')"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const GetCommitSchema = ProjectParamsSchema.extend({
  sha: z.string().describe("Commit SHA or short commit hash to inspect"),
  with_diff: z.boolean().optional().default(true).describe("If true, includes file diffs for the commit"),
  file_path: z.string().optional().describe("Filter diffs to only this specific file (prevents token blowout on large multi-file commits)"),
  max_diff_lines: z.number().optional().default(500).describe("Maximum lines of diff text to return per file (default: 500)"),
});

// Tool Definitions
export const commitTools = [
  {
    name: "list_commits",
    title: "List Commits",
    description: "List chronological commit history for a project, branch, or specific file path with author metadata and commit messages. Use when reviewing recent changes or finding commit SHAs. Do NOT use to inspect complete file diffs; use 'get_commit' or 'get_merge_request_changes' instead.",
    inputSchema: zodToJsonSchema(ListCommitsSchema),
  },
  {
    name: "get_commit",
    title: "Get Commit Details & Diff",
    description: "Retrieve comprehensive details for a specific Git commit SHA, including author info, statistics, modified files, and selective unified file diffs. Use to inspect exact code changes made in a commit. Supports file_path filtering and line limits to prevent context exhaustion on large commits.",
    inputSchema: zodToJsonSchema(GetCommitSchema),
  },
];

// Handlers
export const commitHandlers = {
  list_commits: async (args) => {
    const parsed = ListCommitsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.ref_name) q.append("ref_name", parsed.ref_name);
    if (parsed.since) q.append("since", parsed.since);
    if (parsed.until) q.append("until", parsed.until);
    if (parsed.path) q.append("path", parsed.path);

    const res = await gitlabRequest(`/projects/${pId}/repository/commits?${q.toString()}`);
    const items = (res.items || res).map(summarizeCommit);
    return res.pagination ? { pagination: res.pagination, commits: items } : items;
  },

  get_commit: async (args) => {
    const parsed = GetCommitSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const commit = await gitlabRequest(`/projects/${pId}/repository/commits/${parsed.sha}`);

    const result = {
      id: commit.id,
      short_id: commit.short_id || commit.id.slice(0, 8),
      title: commit.title,
      message: commit.message,
      author_name: commit.author_name,
      author_email: commit.author_email,
      authored_date: commit.authored_date,
      committer_name: commit.committer_name,
      committed_date: commit.committed_date,
      stats: commit.stats,
      web_url: commit.web_url,
    };

    if (parsed.with_diff) {
      const resDiffs = await gitlabRequest(`/projects/${pId}/repository/commits/${parsed.sha}/diff`);
      const diffList = resDiffs.items || resDiffs || [];
      const allFiles = diffList.map((d) => ({
        path: d.new_path,
        old_path: d.old_path !== d.new_path ? d.old_path : undefined,
        status: d.new_file ? "added" : d.deleted_file ? "deleted" : d.renamed_file ? "renamed" : "modified",
      }));
      result.files_changed = allFiles;

      let filteredDiffs = diffList;
      if (parsed.file_path) {
        filteredDiffs = filteredDiffs.filter(
          (d) => d.new_path === parsed.file_path || d.old_path === parsed.file_path
        );
      } else if (filteredDiffs.length > 10) {
        // Safe cap for multi-file commits when no specific file is requested
        result.diff_note = `Commit contains ${filteredDiffs.length} files. Showing diffs for first 10 files. Use file_path parameter to inspect others.`;
        filteredDiffs = filteredDiffs.slice(0, 10);
      }

      result.diffs = filteredDiffs.map((d) => {
        let diffText = d.diff;
        if (parsed.max_diff_lines > 0) {
          const lines = diffText.split("\n");
          if (lines.length > parsed.max_diff_lines) {
            diffText = lines.slice(0, parsed.max_diff_lines).join("\n") + `\n\n[... Truncated ${lines.length - parsed.max_diff_lines} lines of diff ...]`;
          }
        }
        return {
          new_path: d.new_path,
          old_path: d.old_path,
          new_file: d.new_file,
          deleted_file: d.deleted_file,
          renamed_file: d.renamed_file,
          diff: diffText,
        };
      });
    }

    return result;
  },
};
