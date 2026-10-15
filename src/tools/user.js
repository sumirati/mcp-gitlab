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
  { name: "get_current_user", description: "Get the profile and identity of the authenticated user (username, ID, name, email)", inputSchema: zodToJsonSchema(GetCurrentUserSchema) },
  { name: "list_my_groups", description: "List groups the authenticated user is a member or owner of", inputSchema: zodToJsonSchema(ListMyGroupsSchema) },
  { name: "list_my_projects", description: "List projects the authenticated user participates in, owns, or has starred", inputSchema: zodToJsonSchema(ListMyProjectsSchema) },
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
