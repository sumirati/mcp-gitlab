import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { summarizeMilestone } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListMilestonesSchema = ProjectParamsSchema.extend({
  state: z.enum(["active", "closed", "all"]).optional().default("active").describe("Filter by state: active, closed, or all (default: active)"),
  search: z.string().optional().describe("Search query to filter milestones by title"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
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
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(50),
});

export const CreateLabelSchema = ProjectParamsSchema.extend({
  name: z.string().describe("Name of the label (e.g. 'qa-verified' or 'high-priority')"),
  color: z.string().describe("Color hex code starting with # (e.g. '#4287f5' or '#e11d48')"),
  description: z.string().optional().describe("Explanation of what this label represents"),
});

// Tool Definitions
export const milestoneTools = [
  { name: "list_milestones", description: "List project milestones (active, closed, all) with start and due dates", inputSchema: zodToJsonSchema(ListMilestonesSchema) },
  { name: "get_milestone", description: "Get details for a specific milestone by ID", inputSchema: zodToJsonSchema(GetMilestoneSchema) },
  { name: "create_milestone", description: "Create a project milestone with due dates and roadmap scope", inputSchema: zodToJsonSchema(CreateMilestoneSchema) },
  { name: "update_milestone", description: "Update milestone dates, title, description, or state (close/activate)", inputSchema: zodToJsonSchema(UpdateMilestoneSchema) },
  { name: "list_labels", description: "List labels available in the project", inputSchema: zodToJsonSchema(ListLabelsSchema) },
  { name: "create_label", description: "Create a project label with color and description", inputSchema: zodToJsonSchema(CreateLabelSchema) },
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
    const res = await gitlabRequest(`/projects/${pId}/labels?${q.toString()}`);
    return res.items || res;
  },

  create_label: async (args) => {
    const parsed = CreateLabelSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/labels`, {
      method: "POST",
      body: JSON.stringify(parsed),
    });
  },
};
