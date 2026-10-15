import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";
import { resolveAccessLevel, summarizeMember } from "../helpers.js";

// Schemas
export const ListProjectMembersSchema = ProjectParamsSchema.extend({
  query: z.string().optional().describe("Filter members by username or name"),
  include_inherited: z.boolean().optional().default(true).describe("Include members inherited from parent groups (default: true)"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of members per page (default: 20, max: 100)"),
});

export const GetProjectMemberSchema = ProjectParamsSchema.extend({
  user_id: z.union([z.number(), z.string()]).describe("User numeric ID or username"),
});

export const AddProjectMemberSchema = ProjectParamsSchema.extend({
  user_id: z.union([z.number(), z.string()]).describe("User numeric ID or username to add"),
  access_level: z
    .union([z.number(), z.string()])
    .describe("GitLab access level: 'guest' (10), 'reporter' (20), 'developer' (30), 'maintainer' (40), 'owner' (50)"),
  expires_at: z.string().optional().describe("Optional membership expiration date (YYYY-MM-DD)"),
});

export const UpdateProjectMemberSchema = ProjectParamsSchema.extend({
  user_id: z.union([z.number(), z.string()]).describe("User numeric ID or username"),
  access_level: z
    .union([z.number(), z.string()])
    .describe("Updated access level: 'guest' (10), 'reporter' (20), 'developer' (30), 'maintainer' (40), 'owner' (50)"),
  expires_at: z.string().optional().describe("Updated expiration date (YYYY-MM-DD) or empty to remove"),
});

export const RemoveProjectMemberSchema = ProjectParamsSchema.extend({
  user_id: z.union([z.number(), z.string()]).describe("User numeric ID or username to remove from project"),
});

// Helper to resolve numeric user_id if a username string was passed
async function resolveUserId(userIdentifier) {
  if (typeof userIdentifier === "number") return userIdentifier;
  const parsed = parseInt(userIdentifier, 10);
  if (!isNaN(parsed) && parsed.toString() === userIdentifier.trim()) {
    return parsed;
  }
  const clean = userIdentifier.replace(/^@/, "").trim();
  const users = await gitlabRequest(`/users?username=${encodeURIComponent(clean)}`);
  const list = users.items || users;
  if (!list.length) {
    throw new Error(`GitLab user '${userIdentifier}' not found`);
  }
  return list[0].id;
}

// Tool Definitions
export const memberTools = [
  { name: "list_project_members", description: "List project members and collaborators with access levels and roles", inputSchema: zodToJsonSchema(ListProjectMembersSchema) },
  { name: "get_project_member", description: "Get details for a specific project member by user ID or username", inputSchema: zodToJsonSchema(GetProjectMemberSchema) },
  { name: "add_project_member", description: "Add a user to a project with specified role/access level", inputSchema: zodToJsonSchema(AddProjectMemberSchema), mutating: true },
  { name: "update_project_member", description: "Update a project member's access level role or expiration date", inputSchema: zodToJsonSchema(UpdateProjectMemberSchema), mutating: true },
  { name: "remove_project_member", description: "Remove a user/collaborator from a project", inputSchema: zodToJsonSchema(RemoveProjectMemberSchema), mutating: true },
];

// Handlers
export const memberHandlers = {
  list_project_members: async (args) => {
    const parsed = ListProjectMembersSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const endpoint = parsed.include_inherited ? `/projects/${pId}/members/all` : `/projects/${pId}/members`;
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.query) q.append("query", parsed.query);
    const res = await gitlabRequest(`${endpoint}?${q.toString()}`);
    const items = (res.items || res).map(summarizeMember);
    return res.pagination ? { pagination: res.pagination, members: items } : items;
  },

  get_project_member: async (args) => {
    const parsed = GetProjectMemberSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const uId = await resolveUserId(parsed.user_id);
    const res = await gitlabRequest(`/projects/${pId}/members/all/${uId}`);
    return summarizeMember(res);
  },

  add_project_member: async (args) => {
    const parsed = AddProjectMemberSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const uId = await resolveUserId(parsed.user_id);
    const accessLevel = resolveAccessLevel(parsed.access_level);

    const body = {
      user_id: uId,
      access_level: accessLevel,
      ...(parsed.expires_at ? { expires_at: parsed.expires_at } : {}),
    };

    const res = await gitlabRequest(`/projects/${pId}/members`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeMember(res);
  },

  update_project_member: async (args) => {
    const parsed = UpdateProjectMemberSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const uId = await resolveUserId(parsed.user_id);
    const accessLevel = resolveAccessLevel(parsed.access_level);

    const body = {
      access_level: accessLevel,
      ...(parsed.expires_at !== undefined ? { expires_at: parsed.expires_at } : {}),
    };

    const res = await gitlabRequest(`/projects/${pId}/members/${uId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeMember(res);
  },

  remove_project_member: async (args) => {
    const parsed = RemoveProjectMemberSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const uId = await resolveUserId(parsed.user_id);
    return await gitlabRequest(`/projects/${pId}/members/${uId}`, {
      method: "DELETE",
    });
  },
};
