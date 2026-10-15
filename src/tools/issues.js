import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId, formatLabels } from "../client.js";
import { resolveMilestoneId, summarizeIssue } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const CreateIssueSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Issue title summarizing the task, bug, or story"),
  description: z.string().optional().describe("Detailed markdown description, requirements, or checklist"),
  milestone_id: z.number().optional().describe("Numeric milestone ID to associate with"),
  milestone_title: z.string().optional().describe("Milestone title (e.g. 'Phase 2: Security Hardening'). Auto-resolved if provided."),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Labels as an array (['backend', 'p1']) or comma-separated string ('backend, p1')"),
  assignee_ids: z.array(z.number()).optional().describe("Array of numeric user IDs to assign"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format (e.g. '2026-11-30')"),
  confidential: z.boolean().optional().default(false).describe("Mark issue as confidential"),
});

export const ListIssuesSchema = ProjectParamsSchema.extend({
  state: z.enum(["opened", "closed", "all"]).optional().default("all").describe("Filter by issue state (default: all)"),
  milestone: z.string().optional().describe("Filter by milestone title, or 'None' for issues without milestones, or 'Any'"),
  milestone_id: z.number().optional().describe("Filter by numeric milestone ID"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Filter by label names (comma-separated or array)"),
  search: z.string().optional().describe("Search query matching issue title or description"),
  assignee_id: z.number().optional().describe("Filter by assignee user ID"),
  assignee_username: z.string().optional().describe("Filter by assignee username directly pushed upstream"),
  author_id: z.number().optional().describe("Filter by author user ID"),
  author_username: z.string().optional().describe("Filter by author username directly pushed upstream"),
  order_by: z.enum(["created_at", "updated_at", "priority", "due_date"]).optional().default("created_at").describe("Field to sort by"),
  sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction"),
  page: z.number().optional().default(1).describe("Page number for pagination"),
  per_page: z.number().min(1).max(100).optional().default(20).describe("Items per page (default: 20, max: 100)"),
  verbose: z.boolean().optional().default(false).describe("If true, returns full raw GitLab objects instead of clean summaries"),
});

export const GetIssueSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number as seen in UI (e.g. 14 for #14, NOT the global database id)"),
});

export const UpdateIssueSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
  title: z.string().optional().describe("Updated issue title"),
  description: z.string().optional().describe("Updated issue description markdown"),
  state_event: z.enum(["close", "reopen"]).optional().describe("Change issue status to closed or reopened"),
  milestone_id: z.number().nullable().optional().describe("Milestone ID to assign (pass 0 to unassign)"),
  milestone_title: z.string().optional().describe("Milestone title to assign (auto-resolved to ID)"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Set labels (replaces all existing labels)"),
  add_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Add labels without removing existing ones"),
  remove_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Remove specific labels from the issue"),
  assignee_ids: z.array(z.number()).optional().describe("Array of user IDs to assign (replaces existing assignees)"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
});

export const ListIssueNotesSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
  sort: z.enum(["asc", "desc"]).optional().default("asc").describe("Sort direction for comments"),
  order_by: z.enum(["created_at", "updated_at"]).optional().default("created_at"),
  page: z.number().optional().default(1),
  per_page: z.number().min(1).max(100).optional().default(50).describe("Number of notes per page (default: 50, max: 100)"),
});

export const CreateIssueNoteSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
  body: z.string().describe("Markdown content for the note / comment (progress update, test verification, etc.)"),
});

export const ListIssueLinksSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
});

export const CreateIssueLinkSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("Source issue number (e.g. 14)"),
  target_issue_iid: z.number().describe("Target issue number to link to (e.g. 15)"),
  target_project_id: z.union([z.string(), z.number()]).optional().describe("Target project ID (defaults to same project)"),
  link_type: z.enum(["relates_to", "blocks", "is_blocked_by"]).optional().default("relates_to").describe("Relationship type"),
});

// Tool Definitions
export const issueTools = [
  {
    name: "list_issues",
    title: "List Issues",
    description: "List and filter project issues by state ('opened', 'closed', 'all'), milestone, labels, author, assignee, or keyword search pushed directly upstream to GitLab's indexed database. Architectural Best Practice: For known issues, always prefer 'get_issue' with exact issue_iid rather than broad listing.",
    inputSchema: zodToJsonSchema(ListIssuesSchema),
  },
  {
    name: "get_issue",
    title: "Get Issue Details",
    description: "Retrieve comprehensive details for a specific issue by its project-scoped IID (#<iid>), including description, assignees, labels, milestone, and issue status. Use to review issue requirements or track resolution. Do NOT use to list comments on the issue; use 'list_issue_notes' instead.",
    inputSchema: zodToJsonSchema(GetIssueSchema),
  },
  {
    name: "create_issue",
    title: "Create Issue",
    description: "Create a new issue with a title, markdown description, milestone (by title or ID), labels, assignees, and optional due date. Use to report bugs, track user stories, or plan tasks. Side effect: creates a new GitLab issue immediately. Do NOT use to comment on existing issues; use 'create_issue_note' instead.",
    inputSchema: zodToJsonSchema(CreateIssueSchema),
    mutating: true,
  },
  {
    name: "update_issue",
    title: "Update Issue",
    description: "Update an existing issue's title, description, state ('close' or 'reopen'), milestone, labels, or assignees. Use to transition issue lifecycle or update task status. Side effect: alters issue state immediately. Do NOT use to post progress comments; use 'create_issue_note' instead.",
    inputSchema: zodToJsonSchema(UpdateIssueSchema),
    mutating: true,
  },
  {
    name: "list_issue_notes",
    title: "List Issue Notes & Comments",
    description: "List the chronological discussion notes, user comments, and activity audit log for a specific issue by IID. Use to review problem discussion, past comments, or implementation progress. Do NOT use for merge request discussions; use 'list_merge_request_discussions' instead.",
    inputSchema: zodToJsonSchema(ListIssueNotesSchema),
  },
  {
    name: "create_issue_note",
    title: "Add Issue Comment",
    description: "Post a new markdown comment, progress update, or verification note to an existing issue. Use to communicate findings, document test results, or ask questions on a task. Side effect: posts a public comment to the issue thread immediately.",
    inputSchema: zodToJsonSchema(CreateIssueNoteSchema),
    mutating: true,
  },
  {
    name: "list_issue_links",
    title: "List Issue Links",
    description: "List issue dependency links ('relates_to', 'blocks', 'is_blocked_by') associated with a specific issue. Use when analyzing task dependencies or release blockers. Do NOT use to inspect issue discussion notes; use 'list_issue_notes' instead.",
    inputSchema: zodToJsonSchema(ListIssueLinksSchema),
  },
  {
    name: "create_issue_link",
    title: "Link Issues",
    description: "Create a dependency or relationship link between two issues ('relates_to', 'blocks', 'is_blocked_by'), across the same project or across different projects. Use to track blocker relationships or connected bug reports. Side effect: creates a bi-directional issue relationship immediately.",
    inputSchema: zodToJsonSchema(CreateIssueLinkSchema),
    mutating: true,
  },
];

// Handlers
export const issueHandlers = {
  list_issues: async (args) => {
    const parsed = ListIssuesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);

    const q = new URLSearchParams();
    if (parsed.state) q.append("state", parsed.state);
    if (parsed.milestone) q.append("milestone", parsed.milestone);
    if (parsed.milestone_id !== undefined) q.append("milestone_id", parsed.milestone_id.toString());
    if (parsed.labels) q.append("labels", formatLabels(parsed.labels));
    if (parsed.search) q.append("search", parsed.search);
    if (parsed.assignee_id !== undefined) q.append("assignee_id", parsed.assignee_id.toString());
    if (parsed.assignee_username) q.append("assignee_username", parsed.assignee_username);
    if (parsed.author_id !== undefined) q.append("author_id", parsed.author_id.toString());
    if (parsed.author_username) q.append("author_username", parsed.author_username);
    if (parsed.order_by) q.append("order_by", parsed.order_by);
    if (parsed.sort) q.append("sort", parsed.sort);
    q.append("page", parsed.page.toString());
    q.append("per_page", parsed.per_page.toString());

    const res = await gitlabRequest(`/projects/${pId}/issues?${q.toString()}`);
    if (!parsed.verbose) {
      const items = (res.items || res).map(summarizeIssue);
      return res.pagination ? { pagination: res.pagination, issues: items } : items;
    }
    return res;
  },

  get_issue: async (args) => {
    const parsed = GetIssueSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}`);
  },

  create_issue: async (args) => {
    const parsed = CreateIssueSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    let mId = parsed.milestone_id;
    if (!mId && parsed.milestone_title) {
      mId = await resolveMilestoneId(pId, parsed.milestone_title);
    }

    const body = {
      title: parsed.title,
      ...(parsed.description ? { description: parsed.description } : {}),
      ...(mId ? { milestone_id: mId } : {}),
      ...(parsed.labels ? { labels: formatLabels(parsed.labels) } : {}),
      ...(parsed.assignee_ids ? { assignee_ids: parsed.assignee_ids } : {}),
      ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
      confidential: parsed.confidential,
    };

    const res = await gitlabRequest(`/projects/${pId}/issues`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeIssue(res);
  },

  update_issue: async (args) => {
    const parsed = UpdateIssueSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    let mId = parsed.milestone_id;
    if (mId === undefined && parsed.milestone_title) {
      mId = await resolveMilestoneId(pId, parsed.milestone_title);
    }

    const body = {
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.state_event ? { state_event: parsed.state_event } : {}),
      ...(mId !== undefined ? { milestone_id: mId } : {}),
      ...(parsed.labels !== undefined ? { labels: formatLabels(parsed.labels) } : {}),
      ...(parsed.add_labels ? { add_labels: formatLabels(parsed.add_labels) } : {}),
      ...(parsed.remove_labels ? { remove_labels: formatLabels(parsed.remove_labels) } : {}),
      ...(parsed.assignee_ids ? { assignee_ids: parsed.assignee_ids } : {}),
      ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
    };

    const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeIssue(res);
  },

  list_issue_notes: async (args) => {
    const parsed = ListIssueNotesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      sort: parsed.sort,
      order_by: parsed.order_by,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/notes?${q.toString()}`);
    return (res.items || res).map((n) => ({
      id: n.id,
      body: n.body,
      author: n.author ? n.author.username : null,
      created_at: n.created_at,
      system: n.system,
    }));
  },

  create_issue_note: async (args) => {
    const parsed = CreateIssueNoteSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: parsed.body }),
    });
    return { id: res.id, author: res.author?.username, body: res.body, created_at: res.created_at };
  },

  list_issue_links: async (args) => {
    const parsed = ListIssueLinksSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/links`);
  },

  create_issue_link: async (args) => {
    const parsed = CreateIssueLinkSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const targetPId = parsed.target_project_id ? formatProjectId(parsed.target_project_id) : pId;
    return await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/links`, {
      method: "POST",
      body: JSON.stringify({
        target_project_id: targetPId,
        target_issue_iid: parsed.target_issue_iid,
        link_type: parsed.link_type,
      }),
    });
  },
};
