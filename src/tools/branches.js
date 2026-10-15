import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";
import { summarizeBranch } from "../helpers.js";

// Schemas
export const ListBranchesSchema = ProjectParamsSchema.extend({
  search: z.string().optional().describe("Search query to filter branch names (e.g. 'feature')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of branches per page (default: 20, max: 100)"),
});

export const GetBranchSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Branch name (e.g. 'main' or 'feature/user-auth')"),
});

export const CreateBranchSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Name of the new branch to create (e.g. 'feature/upgrade-java')"),
  ref: z.string().optional().default("HEAD").describe("Source branch, tag, or commit SHA to branch from (default: HEAD)"),
});

export const DeleteBranchSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Name of the branch to delete"),
});

// Tool Definitions
export const branchTools = [
  { name: "list_branches", description: "List repository branches with commit details, default flag, and protected status", inputSchema: zodToJsonSchema(ListBranchesSchema) },
  { name: "get_branch", description: "Get specific branch details, commit SHA, and protection rules", inputSchema: zodToJsonSchema(GetBranchSchema) },
  { name: "create_branch", description: "Create a new branch from a commit, tag, or branch", inputSchema: zodToJsonSchema(CreateBranchSchema), mutating: true },
  { name: "delete_branch", description: "Delete a branch from a project repository (blocks accidental deletion of default branch)", inputSchema: zodToJsonSchema(DeleteBranchSchema), mutating: true },
];

// Handlers
export const branchHandlers = {
  list_branches: async (args) => {
    const parsed = ListBranchesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.search) q.append("search", parsed.search);
    const res = await gitlabRequest(`/projects/${pId}/repository/branches?${q.toString()}`);
    const items = (res.items || res).map(summarizeBranch);
    return res.pagination ? { pagination: res.pagination, branches: items } : items;
  },

  get_branch: async (args) => {
    const parsed = GetBranchSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedBranch = encodeURIComponent(parsed.branch);
    const res = await gitlabRequest(`/projects/${pId}/repository/branches/${encodedBranch}`);
    return summarizeBranch(res);
  },

  create_branch: async (args) => {
    const parsed = CreateBranchSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/repository/branches`, {
      method: "POST",
      body: JSON.stringify({
        branch: parsed.branch,
        ref: parsed.ref,
      }),
    });
    return summarizeBranch(res);
  },

  delete_branch: async (args) => {
    const parsed = DeleteBranchSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedBranch = encodeURIComponent(parsed.branch);

    // Safety check: ensure we do not delete the default branch
    const b = await gitlabRequest(`/projects/${pId}/repository/branches/${encodedBranch}`);
    if (b.default) {
      throw new Error(`Cannot delete branch '${parsed.branch}' because it is configured as the project default branch.`);
    }

    return await gitlabRequest(`/projects/${pId}/repository/branches/${encodedBranch}`, {
      method: "DELETE",
    });
  },
};
