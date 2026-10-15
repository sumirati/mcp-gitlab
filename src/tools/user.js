import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest } from "../client.js";
import { summarizeProject, summarizeGroup } from "../helpers.js";

const ACCESS_LEVEL_MAP = {
  guest: 10,
  reporter: 20,
  developer: 30,
  maintainer: 40,
  owner: 50,
};

// Schemas
export const GetCurrentUserSchema = z.object({});

export const ListMyGroupsSchema = z.object({
  search: z.string().optional().describe("Search query to filter group names/paths"),
  owned: z.boolean().optional().describe("If true, limits to groups explicitly owned by the current user"),
  min_access_level: z.enum(["guest", "reporter", "developer", "maintainer", "owner"]).optional().describe("Minimum access level in the group"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const GetGroupSchema = z.object({
  group_id: z.union([z.string(), z.number()]).describe("Group numeric ID or full path (e.g. 'buggycode' or 3)"),
  with_projects: z.boolean().optional().default(false).describe("Include project details in the group response"),
});

export const ListGroupProjectsSchema = z.object({
  group_id: z.union([z.string(), z.number()]).describe("Group numeric ID or path (e.g. 'buggycode' or 3)"),
  include_subgroups: z.boolean().optional().default(true).describe("Include projects in subgroups (default: true)"),
  search: z.string().optional().describe("Search query within group projects"),
  visibility: z.enum(["private", "internal", "public"]).optional().describe("Filter by project visibility"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const ListMyProjectsSchema = z.object({
  search: z.string().optional().describe("Search query to filter project names or descriptions"),
  owned: z.boolean().optional().describe("If true, limits to projects owned by the current user (e.g. personal namespace)"),
  membership: z.boolean().optional().default(true).describe("If true, limits to projects the current user is explicitly a member of (default: true)"),
  starred: z.boolean().optional().describe("If true, limits to starred projects"),
  visibility: z.enum(["private", "internal", "public"]).optional().describe("Filter by project visibility"),
  min_access_level: z.enum(["guest", "reporter", "developer", "maintainer", "owner"]).optional().describe("Minimum access level in the project"),
  order_by: z.enum(["id", "name", "path", "created_at", "updated_at", "last_activity_at"]).optional().default("last_activity_at"),
  sort: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

// Tool Definitions
export const userTools = [
  {
    name: "get_current_user",
    title: "Get Current Authenticated User",
    description: "Retrieve identity and profile details of the authenticated GitLab account (username, numeric ID, name, email, admin flag). Use to verify token validity, check active permissions, or discover your own username for assignment. Do NOT use to query other users' profiles; use 'list_project_members' instead.",
    inputSchema: zodToJsonSchema(GetCurrentUserSchema),
  },
  {
    name: "list_my_groups",
    title: "List User Groups",
    description: "List GitLab groups and parent organizations where the authenticated user is an active member or owner with access roles. Use to discover namespace paths available for project creation or access audits. Do NOT use to inspect project lists directly; use 'list_group_projects' instead.",
    inputSchema: zodToJsonSchema(ListMyGroupsSchema),
  },
  {
    name: "get_group",
    title: "Get Group Details",
    description: "Retrieve comprehensive details for a specific GitLab group or namespace by its numeric ID or full path (e.g. 'buggycode'). Use when checking group-level visibility, description, or parent group hierarchy. Do NOT use to list projects in the group; use 'list_group_projects' instead.",
    inputSchema: zodToJsonSchema(GetGroupSchema),
  },
  {
    name: "list_group_projects",
    title: "List Group Projects",
    description: "List all repositories and projects belonging to a specific GitLab group or organization with pagination and search. Supports include_subgroups (default: true). Use to discover projects within a team or enterprise namespace. Do NOT use for cross-instance project search; use 'search_repositories' instead.",
    inputSchema: zodToJsonSchema(ListGroupProjectsSchema),
  },
  {
    name: "list_my_projects",
    title: "List My Projects",
    description: "List GitLab projects where the authenticated user is a direct member, owner, or starred contributor with role summaries. Use to discover personal repositories or starred codebases. Do NOT use for generic text searches across public projects; use 'search_repositories' instead.",
    inputSchema: zodToJsonSchema(ListMyProjectsSchema),
  },
];

// Handlers
export const userHandlers = {
  get_current_user: async () => {
    const user = await gitlabRequest("/user");
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      state: user.state,
      is_admin: user.is_admin || false,
      bot: user.bot || false,
      web_url: user.web_url,
      created_at: user.created_at,
    };
  },

  list_my_groups: async (args) => {
    const parsed = ListMyGroupsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.search) q.append("search", parsed.search);
    if (parsed.owned) q.append("owned", "true");
    if (parsed.min_access_level) {
      q.append("min_access_level", ACCESS_LEVEL_MAP[parsed.min_access_level].toString());
    }
    const res = await gitlabRequest(`/groups?${q.toString()}`);
    const items = (res.items || res).map(summarizeGroup);
    return res.pagination ? { pagination: res.pagination, groups: items } : items;
  },

  get_group: async (args) => {
    const parsed = GetGroupSchema.parse(args);
    const gId = typeof parsed.group_id === "number" ? parsed.group_id : encodeURIComponent(parsed.group_id);
    const q = parsed.with_projects ? "?with_projects=true" : "";
    const res = await gitlabRequest(`/groups/${gId}${q}`);
    return summarizeGroup(res);
  },

  list_group_projects: async (args) => {
    const parsed = ListGroupProjectsSchema.parse(args);
    const gId = typeof parsed.group_id === "number" ? parsed.group_id : encodeURIComponent(parsed.group_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.include_subgroups) q.append("include_subgroups", "true");
    if (parsed.search) q.append("search", parsed.search);
    if (parsed.visibility) q.append("visibility", parsed.visibility);

    const res = await gitlabRequest(`/groups/${gId}/projects?${q.toString()}`);
    const items = (res.items || res).map(summarizeProject);
    return res.pagination ? { pagination: res.pagination, projects: items } : items;
  },

  list_my_projects: async (args) => {
    const parsed = ListMyProjectsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
      order_by: parsed.order_by,
      sort: parsed.sort,
    });
    if (parsed.search) q.append("search", parsed.search);
    if (parsed.membership) q.append("membership", "true");
    if (parsed.owned) q.append("owned", "true");
    if (parsed.starred) q.append("starred", "true");
    if (parsed.visibility) q.append("visibility", parsed.visibility);
    if (parsed.min_access_level) {
      q.append("min_access_level", ACCESS_LEVEL_MAP[parsed.min_access_level].toString());
    }
    const res = await gitlabRequest(`/projects?${q.toString()}`);
    const items = (res.items || res).map(summarizeProject);
    return res.pagination ? { pagination: res.pagination, projects: items } : items;
  },
};
