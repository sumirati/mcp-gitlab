import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { summarizeMilestone } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListMilestonesSchema = ProjectParamsSchema.extend({
  state: z.enum(["active", "closed", "all"]).optional().default("active").describe("Filter by state: active, closed, or all (default: active)"),
  search: z.string().optional().describe("Search query to filter milestones by title"),
  include_ancestor_groups: z.boolean().optional().default(true).describe("Include milestones from ancestor groups (default: true)"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(20).describe("Number of milestones per page (default: 20, max: 100)"),
});

export const GetMilestoneSchema = ProjectParamsSchema.extend({
  milestone_id: z.number().describe("The milestone numeric database ID"),
});

export const CreateMilestoneSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Milestone title (e.g. 'Phase 3: Code Modernization')"),
  description: z.string().optional().describe("Milestone scope and objectives description"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format (e.g. '2026-12-31')"),
  start_date: z.string().optional().describe("Start date in YYYY-MM-DD format (e.g. '2026-10-15')"),
});

export const UpdateMilestoneSchema = ProjectParamsSchema.extend({
  milestone_id: z.number().describe("The milestone numeric ID to update"),
  title: z.string().optional().describe("Updated milestone title"),
  description: z.string().optional().describe("Updated description"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
  start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
  state_event: z.enum(["close", "activate"]).optional().describe("Close or re-activate the milestone"),
});

export const ListLabelsSchema = ProjectParamsSchema.extend({
  search: z.string().optional().describe("Search query to filter labels"),
  include_ancestor_groups: z.boolean().optional().default(true).describe("Include labels from ancestor groups (default: true)"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(50).describe("Number of labels per page (default: 50, max: 100)"),
});

export const CreateLabelSchema = ProjectParamsSchema.extend({
  name: z.string().describe("Name of the label (e.g. 'qa-verified' or 'high-priority')"),
  color: z.string().describe("Color hex code starting with # (e.g. '#4287f5' or '#e11d48')"),
  description: z.string().optional().describe("Explanation of what this label represents"),
});

// Tool Definitions
export const milestoneTools = [
  {
    name: "list_milestones",
    title: "List Milestones",
    description: "List project and ancestor group milestones filtered by state ('active', 'closed', 'all') with start dates, due dates, and progress. Use to track sprint goals, release targets, or project roadmaps. Do NOT use to inspect individual issue lists inside a milestone; use 'list_issues' with a milestone filter instead.",
    inputSchema: zodToJsonSchema(ListMilestonesSchema),
  },
  {
    name: "get_milestone",
    title: "Get Milestone Details",
    description: "Retrieve comprehensive details for a specific project milestone by numeric ID, including description, dates, and state. Use when validating target milestone dates or checking milestone progress. Do NOT use to list project milestones; use 'list_milestones' instead.",
    inputSchema: zodToJsonSchema(GetMilestoneSchema),
  },
  {
    name: "create_milestone",
    title: "Create Milestone",
    description: "Create a new project milestone with a title, description, start date, and due date. Use to plan a release version, sprint, or delivery roadmap. Side effect: creates a new project milestone immediately. Do NOT use to create releases; use 'create_release' instead.",
    inputSchema: zodToJsonSchema(CreateMilestoneSchema),
    mutating: true,
  },
  {
    name: "update_milestone",
    title: "Update Milestone",
    description: "Update an existing milestone's title, description, due date, start date, or lifecycle state ('activate' or 'close'). Use to adjust release schedules or complete sprints. Side effect: alters milestone metadata immediately.",
    inputSchema: zodToJsonSchema(UpdateMilestoneSchema),
    mutating: true,
  },
  {
    name: "list_labels",
    title: "List Labels",
    description: "List labels available within a project (including inherited ancestor group labels) with colors and descriptions. Use to discover valid taxonomy labels before categorizing issues or merge requests. Do NOT use to create new labels; use 'create_label' instead.",
    inputSchema: zodToJsonSchema(ListLabelsSchema),
  },
  {
    name: "create_label",
    title: "Create Label",
    description: "Create a new label with a name, hexadecimal color code, and description in a project. Use when establishing project workflow tags, priority markers, or component categories. Side effect: creates a new project label immediately.",
    inputSchema: zodToJsonSchema(CreateLabelSchema),
    mutating: true,
  },
];

// Handlers
export const milestoneHandlers = {
  list_milestones: async (args) => {
    const parsed = ListMilestonesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      state: parsed.state,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.search) q.append("search", parsed.search);
    if (parsed.include_ancestor_groups) q.append("include_ancestor_groups", "true");
    const res = await gitlabRequest(`/projects/${pId}/milestones?${q.toString()}`);
    return (res.items || res).map(summarizeMilestone);
  },

  get_milestone: async (args) => {
    const parsed = GetMilestoneSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/milestones/${parsed.milestone_id}`);
    return summarizeMilestone(res);
  },

  create_milestone: async (args) => {
    const parsed = CreateMilestoneSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      title: parsed.title,
      ...(parsed.description ? { description: parsed.description } : {}),
      ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
      ...(parsed.start_date ? { start_date: parsed.start_date } : {}),
    };
    const res = await gitlabRequest(`/projects/${pId}/milestones`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeMilestone(res);
  },

  update_milestone: async (args) => {
    const parsed = UpdateMilestoneSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
      ...(parsed.start_date ? { start_date: parsed.start_date } : {}),
      ...(parsed.state_event ? { state_event: parsed.state_event } : {}),
    };
    const res = await gitlabRequest(`/projects/${pId}/milestones/${parsed.milestone_id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeMilestone(res);
  },

  list_labels: async (args) => {
    const parsed = ListLabelsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.search) q.append("search", parsed.search);
    if (parsed.include_ancestor_groups) q.append("include_ancestor_groups", "true");
    const res = await gitlabRequest(`/projects/${pId}/labels?${q.toString()}`);
    return res.items || res;
  },

  create_label: async (args) => {
    const parsed = CreateLabelSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/labels`, {
      method: "POST",
      body: JSON.stringify(parsed),
    });
    return {
      id: res.id,
      name: res.name,
      color: res.color,
      description: res.description,
    };
  },
};
