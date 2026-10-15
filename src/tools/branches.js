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
  {
    name: "list_branches",
    title: "List Branches",
    description: "List repository branches with latest commit summaries, default branch indicators, and protected status. Use to discover active development branches or check branch existence. Do NOT use to inspect commit diffs (use 'get_commit') or list tags (use 'list_tags').",
    inputSchema: zodToJsonSchema(ListBranchesSchema),
  },
  {
    name: "get_branch",
    title: "Get Branch Details",
    description: "Retrieve comprehensive details for a specific Git branch, including latest commit SHA, author info, and branch protection rules. Use to verify commit alignment before creating merge requests. Do NOT use to inspect file contents directly; use 'get_file_contents' instead.",
    inputSchema: zodToJsonSchema(GetBranchSchema),
  },
  {
    name: "create_branch",
    title: "Create Branch",
    description: "Create a new Git branch starting from an existing branch, tag, or commit SHA. Use to initialize feature branches, bugfixes, or release branches. Side effect: creates a new branch pointer on the remote repository. Do NOT use to create new repositories; use 'create_repository' instead.",
    inputSchema: zodToJsonSchema(CreateBranchSchema),
    mutating: true,
  },
  {
    name: "delete_branch",
    title: "Delete Branch",
    description: "Delete an existing Git branch from a project repository. Use to clean up merged or obsolete feature branches. Side effect: DESTRUCTIVE. Accidental deletion of the project's default branch is actively blocked for safety. Do NOT use to delete tags; use Git tag management instead.",
    inputSchema: zodToJsonSchema(DeleteBranchSchema),
    mutating: true,
  },
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
