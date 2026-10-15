import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId, formatLabels } from "../client.js";
import { resolveMilestoneId, summarizeMR } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

const LOCKFILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "go.sum",
];

// Schemas
export const ListMergeRequestsSchema = ProjectParamsSchema.extend({
  state: z.enum(["opened", "closed", "locked", "merged", "all"]).optional().default("opened").describe("Filter MRs by state"),
  source_branch: z.string().optional().describe("Filter by source branch"),
  target_branch: z.string().optional().describe("Filter by target branch"),
  milestone: z.string().optional().describe("Filter by milestone title"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Filter by labels"),
  search: z.string().optional().describe("Search query for title and description"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const GetMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("The project-scoped merge request number (e.g. 5 for !5)"),
});

export const CreateMergeRequestSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Merge request title"),
  description: z.string().optional().describe("Detailed description of changes and test verification"),
  source_branch: z.string().describe("Branch containing your commits"),
  target_branch: z.string().describe("Branch to merge changes into (e.g. 'main')"),
  draft: z.boolean().optional().default(false).describe("Create as draft / WIP merge request"),
  remove_source_branch: z.boolean().optional().default(true).describe("Delete source branch upon merge"),
  squash: z.boolean().optional().default(false).describe("Squash commits upon merge"),
  milestone_title: z.string().optional().describe("Milestone title to associate with"),
  milestone_id: z.number().optional().describe("Milestone ID to associate with"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Labels to apply"),
});

export const UpdateMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID (e.g. 5 for !5)"),
  title: z.string().optional().describe("Updated MR title"),
  description: z.string().optional().describe("Updated MR description"),
  state_event: z.enum(["close", "reopen"]).optional().describe("Close or reopen the merge request"),
  target_branch: z.string().optional().describe("Change destination target branch"),
  milestone_id: z.number().nullable().optional().describe("Milestone ID (0 to unassign)"),
  milestone_title: z.string().optional().describe("Milestone title to associate"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Set labels (replaces existing)"),
  add_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Add labels"),
  remove_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Remove labels"),
});

export const GetMergeRequestChangesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID (e.g. 5 for !5) to get diffs for"),
  file_path: z.string().optional().describe("Filter diffs to a specific single file path"),
  summary_only: z.boolean().optional().default(false).describe("If true, returns only the manifest of changed files without raw diff strings (saves tokens)"),
  ignore_lockfiles: z.boolean().optional().default(true).describe("If true, automatically filters out dependency lockfiles (e.g. package-lock.json, poetry.lock)"),
  max_diff_lines: z.number().optional().default(500).describe("Maximum lines of diff per file to return before truncating (default: 500)"),
});

export const ListMergeRequestDiscussionsSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID"),
  unresolved_only: z.boolean().optional().default(false).describe("If true, returns only unresolved discussions that need attention"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(50),
});

export const CreateDiffDiscussionSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID"),
  file_path: z.string().describe("Path to the file being reviewed (e.g. 'src/client.js')"),
  line: z.number().describe("Line number in the file to attach the review comment to"),
  line_type: z.enum(["new", "old"]).optional().default("new").describe("Whether the line is in the new version ('new') or old version ('old') of the diff (default: new)"),
  body: z.string().describe("Markdown review comment or suggestion"),
});

export const ReplyMergeRequestDiscussionSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID"),
  discussion_id: z.string().describe("The discussion thread ID to reply to"),
  body: z.string().describe("Markdown reply comment"),
});

export const UpdateMergeRequestDiscussionNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID"),
  discussion_id: z.string().describe("The discussion thread ID"),
  note_id: z.number().describe("The note numeric ID to edit"),
  body: z.string().describe("New markdown body for the comment"),
});

export const ResolveMergeRequestDiscussionSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID"),
  discussion_id: z.string().describe("The discussion thread ID to resolve or unresolve"),
  resolved: z.boolean().optional().default(true).describe("Set to true to resolve the thread, false to unresolve"),
});

export const AcceptMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID to merge into target branch"),
  commit_message: z.string().optional().describe("Custom commit message for the merge commit"),
  squash: z.boolean().optional().describe("Squash commits during merge"),
  should_remove_source_branch: z.boolean().optional().describe("Delete source branch after merge"),
});

export const CreateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID"),
  body: z.string().describe("Review comment or sign-off message in markdown"),
});

// Tool Definitions
export const mergeRequestTools = [
  { name: "list_merge_requests", description: "List merge requests filtered by state, branches, milestone, or labels", inputSchema: zodToJsonSchema(ListMergeRequestsSchema) },
  { name: "get_merge_request", description: "Get details and status of a merge request by IID (!<iid>)", inputSchema: zodToJsonSchema(GetMergeRequestSchema) },
  { name: "create_merge_request", description: "Create a merge request between branches with description and options", inputSchema: zodToJsonSchema(CreateMergeRequestSchema), mutating: true },
  { name: "update_merge_request", description: "Update MR title, description, state (close/reopen), target branch, milestone, or labels", inputSchema: zodToJsonSchema(UpdateMergeRequestSchema), mutating: true },
  { name: "get_merge_request_changes", description: "Inspect code diffs and modified files in an MR (supports token-saving summary, file filtering, and lockfile pruning)", inputSchema: zodToJsonSchema(GetMergeRequestChangesSchema) },
  { name: "list_merge_request_discussions", description: "List inline code review discussions and threads on an MR (supports unresolved_only filter)", inputSchema: zodToJsonSchema(ListMergeRequestDiscussionsSchema) },
  { name: "create_diff_discussion", description: "Post an inline code review comment on a specific line and file in an MR (resolves SHAs automatically)", inputSchema: zodToJsonSchema(CreateDiffDiscussionSchema), mutating: true },
  { name: "reply_merge_request_discussion", description: "Post a reply comment into an existing MR code review discussion thread", inputSchema: zodToJsonSchema(ReplyMergeRequestDiscussionSchema), mutating: true },
  { name: "update_merge_request_discussion_note", description: "Update or edit the text of an existing review comment in an MR discussion thread", inputSchema: zodToJsonSchema(UpdateMergeRequestDiscussionNoteSchema), mutating: true },
  { name: "resolve_merge_request_discussion", description: "Resolve or unresolve a code review discussion thread on an MR", inputSchema: zodToJsonSchema(ResolveMergeRequestDiscussionSchema), mutating: true },
  { name: "accept_merge_request", description: "Merge an approved merge request into the target branch", inputSchema: zodToJsonSchema(AcceptMergeRequestSchema), mutating: true },
  { name: "create_merge_request_note", description: "Post a general review comment or note on a merge request", inputSchema: zodToJsonSchema(CreateMergeRequestNoteSchema), mutating: true },
];

// Handlers
export const mergeRequestHandlers = {
  list_merge_requests: async (args) => {
    const parsed = ListMergeRequestsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      state: parsed.state,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.source_branch) q.append("source_branch", parsed.source_branch);
    if (parsed.target_branch) q.append("target_branch", parsed.target_branch);
    if (parsed.milestone) q.append("milestone", parsed.milestone);
    if (parsed.labels) q.append("labels", formatLabels(parsed.labels));
    if (parsed.search) q.append("search", parsed.search);
    const res = await gitlabRequest(`/projects/${pId}/merge_requests?${q.toString()}`);
    const items = (res.items || res).map(summarizeMR);
    return res.pagination ? { pagination: res.pagination, merge_requests: items } : items;
  },

  get_merge_request: async (args) => {
    const parsed = GetMergeRequestSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}`);
    return summarizeMR(res);
  },

  create_merge_request: async (args) => {
    const parsed = CreateMergeRequestSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);

    let milestoneId = parsed.milestone_id;
    if (!milestoneId && parsed.milestone_title) {
      milestoneId = await resolveMilestoneId(pId, parsed.milestone_title);
    }

    const body = {
      title: parsed.title,
      source_branch: parsed.source_branch,
      target_branch: parsed.target_branch,
      ...(parsed.description ? { description: parsed.description } : {}),
      ...(parsed.draft !== undefined ? { draft: parsed.draft } : {}),
      ...(parsed.remove_source_branch !== undefined
        ? { remove_source_branch: parsed.remove_source_branch }
        : {}),
      ...(parsed.squash !== undefined ? { squash: parsed.squash } : {}),
      ...(milestoneId ? { milestone_id: milestoneId } : {}),
      ...(parsed.labels ? { labels: formatLabels(parsed.labels) } : {}),
    };

    const res = await gitlabRequest(`/projects/${pId}/merge_requests`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeMR(res);
  },

  update_merge_request: async (args) => {
    const parsed = UpdateMergeRequestSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);

    let milestoneId = parsed.milestone_id;
    if (milestoneId === undefined && parsed.milestone_title) {
      milestoneId = await resolveMilestoneId(pId, parsed.milestone_title);
    }

    const body = {
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.target_branch ? { target_branch: parsed.target_branch } : {}),
      ...(parsed.state_event ? { state_event: parsed.state_event } : {}),
      ...(milestoneId !== undefined ? { milestone_id: milestoneId } : {}),
      ...(parsed.labels ? { labels: formatLabels(parsed.labels) } : {}),
      ...(parsed.add_labels ? { add_labels: formatLabels(parsed.add_labels) } : {}),
      ...(parsed.remove_labels ? { remove_labels: formatLabels(parsed.remove_labels) } : {}),
    };

    const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeMR(res);
  },

  get_merge_request_changes: async (args) => {
    const parsed = GetMergeRequestChangesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/changes`);

    let changes = res.changes || [];

    // 1. Lockfile filter
    if (parsed.ignore_lockfiles) {
      changes = changes.filter((c) => {
        const p = c.new_path || c.old_path || "";
        const filename = p.split("/").pop();
        return !LOCKFILES.includes(filename);
      });
    }

    // 2. Single file filter
    if (parsed.file_path) {
      const target = parsed.file_path.trim().toLowerCase();
      changes = changes.filter(
        (c) =>
          (c.new_path && c.new_path.toLowerCase() === target) ||
          (c.old_path && c.old_path.toLowerCase() === target)
      );
    }

    // 3. Summary only mode (saves tokens)
    if (parsed.summary_only) {
      return {
        iid: res.iid,
        title: res.title,
        source_branch: res.source_branch,
        target_branch: res.target_branch,
        changes_count: res.changes_count,
        files_changed: changes.map((c) => ({
          old_path: c.old_path,
          new_path: c.new_path,
          new_file: c.new_file,
          renamed_file: c.renamed_file,
          deleted_file: c.deleted_file,
        })),
      };
    }

    // 4. Truncation capped diffs
    const formattedChanges = changes.map((c) => {
      let diff = c.diff || "";
      if (parsed.max_diff_lines > 0) {
        const lines = diff.split("\n");
        if (lines.length > parsed.max_diff_lines) {
          diff =
            lines.slice(0, parsed.max_diff_lines).join("\n") +
            `\n\n[... Truncated ${lines.length - parsed.max_diff_lines} lines of diff ...]`;
        }
      }
      return {
        old_path: c.old_path,
        new_path: c.new_path,
        new_file: c.new_file,
        renamed_file: c.renamed_file,
        deleted_file: c.deleted_file,
        diff,
      };
    });

    return {
      iid: res.iid,
      title: res.title,
      source_branch: res.source_branch,
      target_branch: res.target_branch,
      changes_count: res.changes_count,
      changes: formattedChanges,
    };
  },

  list_merge_request_discussions: async (args) => {
    const parsed = ListMergeRequestDiscussionsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });

    const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/discussions?${q.toString()}`);
    let discussions = (res.items || res).map((d) => {
      const firstNote = (d.notes || [])[0];
      const pos = firstNote?.position;
      return {
        id: d.id,
        individual_note: d.individual_note,
        resolved: (d.notes || []).every((n) => !n.resolvable || n.resolved),
        position: pos
          ? {
              old_path: pos.old_path,
              new_path: pos.new_path,
              new_line: pos.new_line,
              old_line: pos.old_line,
            }
          : null,
        notes: (d.notes || []).map((n) => ({
          id: n.id,
          author: n.author?.username,
          body: n.body,
          created_at: n.created_at,
          resolvable: n.resolvable || false,
          resolved: n.resolved || false,
        })),
      };
    });

    if (parsed.unresolved_only) {
      discussions = discussions.filter((d) => !d.resolved);
    }

    return discussions;
  },

  create_diff_discussion: async (args) => {
    const parsed = CreateDiffDiscussionSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);

    // 1. Fetch MR metadata to obtain current diff_refs
    const mr = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}`);
    if (!mr.diff_refs || !mr.diff_refs.head_sha) {
      throw new Error(`Merge request !${parsed.merge_request_iid} does not have diff_refs available.`);
    }

    const position = {
      position_type: "text",
      base_sha: mr.diff_refs.base_sha,
      start_sha: mr.diff_refs.start_sha,
      head_sha: mr.diff_refs.head_sha,
      new_path: parsed.file_path,
      old_path: parsed.file_path,
      ...(parsed.line_type === "new" ? { new_line: parsed.line } : { old_line: parsed.line }),
    };

    const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/discussions`, {
      method: "POST",
      body: JSON.stringify({
        body: parsed.body,
        position,
      }),
    });

    return {
      id: res.id,
      notes: (res.notes || []).map((n) => ({
        id: n.id,
        author: n.author?.username,
        body: n.body,
        created_at: n.created_at,
      })),
    };
  },

  reply_merge_request_discussion: async (args) => {
    const parsed = ReplyMergeRequestDiscussionSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(
      `/projects/${pId}/merge_requests/${parsed.merge_request_iid}/discussions/${parsed.discussion_id}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ body: parsed.body }),
      }
    );
    return {
      id: res.id,
      author: res.author?.username,
      body: res.body,
      created_at: res.created_at,
    };
  },

  update_merge_request_discussion_note: async (args) => {
    const parsed = UpdateMergeRequestDiscussionNoteSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(
      `/projects/${pId}/merge_requests/${parsed.merge_request_iid}/discussions/${parsed.discussion_id}/notes/${parsed.note_id}`,
      {
        method: "PUT",
        body: JSON.stringify({ body: parsed.body }),
      }
    );
    return {
      id: res.id,
      author: res.author?.username,
      body: res.body,
      updated_at: res.updated_at,
    };
  },

  resolve_merge_request_discussion: async (args) => {
    const parsed = ResolveMergeRequestDiscussionSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = parsed.resolved ? "resolved=true" : "resolved=false";
    const res = await gitlabRequest(
      `/projects/${pId}/merge_requests/${parsed.merge_request_iid}/discussions/${parsed.discussion_id}?${q}`,
      {
        method: "PUT",
      }
    );
    return {
      id: res.id,
      resolved: parsed.resolved,
    };
  },

  accept_merge_request: async (args) => {
    const parsed = AcceptMergeRequestSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      ...(parsed.commit_message ? { merge_commit_message: parsed.commit_message } : {}),
      ...(parsed.squash !== undefined ? { squash: parsed.squash } : {}),
      ...(parsed.should_remove_source_branch !== undefined
        ? { should_remove_source_branch: parsed.should_remove_source_branch }
        : {}),
    };
    const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/merge`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeMR(res);
  },

  create_merge_request_note: async (args) => {
    const parsed = CreateMergeRequestNoteSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: parsed.body }),
    });
    return { id: res.id, author: res.author?.username, body: res.body, created_at: res.created_at };
  },
};
