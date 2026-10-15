import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId, formatLabels } from "../client.js";
import { resolveMilestoneId, summarizeMR } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

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
  { name: "get_merge_request_changes", description: "Inspect code diffs and modified files in a merge request", inputSchema: zodToJsonSchema(GetMergeRequestChangesSchema) },
  { name: "accept_merge_request", description: "Merge an approved merge request into the target branch", inputSchema: zodToJsonSchema(AcceptMergeRequestSchema), mutating: true },
  { name: "create_merge_request_note", description: "Post a review comment or note on a merge request", inputSchema: zodToJsonSchema(CreateMergeRequestNoteSchema), mutating: true },
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
    return await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}`);
  },

  create_merge_request: async (args) => {
    const parsed = CreateMergeRequestSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    let mId = parsed.milestone_id;
    if (!mId && parsed.milestone_title) {
      mId = await resolveMilestoneId(pId, parsed.milestone_title);
    }
    const body = {
      title: parsed.title,
      source_branch: parsed.source_branch,
      target_branch: parsed.target_branch,
      draft: parsed.draft,
      remove_source_branch: parsed.remove_source_branch,
      squash: parsed.squash,
      ...(parsed.description ? { description: parsed.description } : {}),
      ...(mId ? { milestone_id: mId } : {}),
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
    let mId = parsed.milestone_id;
    if (mId === undefined && parsed.milestone_title) {
      mId = await resolveMilestoneId(pId, parsed.milestone_title);
    }
    const body = {
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.state_event ? { state_event: parsed.state_event } : {}),
      ...(parsed.target_branch ? { target_branch: parsed.target_branch } : {}),
      ...(mId !== undefined ? { milestone_id: mId } : {}),
      ...(parsed.labels !== undefined ? { labels: formatLabels(parsed.labels) } : {}),
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
    return {
      iid: res.iid,
      title: res.title,
      source_branch: res.source_branch,
      target_branch: res.target_branch,
      changes_count: res.changes_count,
      changes: (res.changes || []).map((c) => ({
        old_path: c.old_path,
        new_path: c.new_path,
        new_file: c.new_file,
        renamed_file: c.renamed_file,
        deleted_file: c.deleted_file,
        diff: c.diff,
      })),
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
