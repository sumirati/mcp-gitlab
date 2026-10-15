import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";
import { summarizeProject, resolveNamespaceId } from "../helpers.js";

// Schemas
export const SearchRepositoriesSchema = z.object({
  search: z.string().optional().describe("Search query to filter project names/descriptions (e.g. 'my-service')"),
  group: z.union([z.string(), z.number()]).optional().describe("Optional group ID or path (e.g. 'buggycode' or 3) to filter repositories strictly within that group"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of results per page (default: 20, max: 100)"),
});

export const GetProjectSchema = ProjectParamsSchema.extend({
  statistics: z.boolean().optional().default(false).describe("Include project repository and storage statistics"),
});

export const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository / Project name (e.g. 'mcp-github' or 'my-new-service')"),
  path: z.string().optional().describe("Repository path/slug (e.g. 'mcp-github'). Defaults to name if omitted."),
  namespace: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Namespace / Group name, path, or ID (e.g. 'buggycode' or 3) to create the project in. If omitted, creates in personal namespace."),
  description: z.string().optional().describe("Short project description"),
  visibility: z.enum(["private", "internal", "public"]).optional().default("internal").describe("Visibility level"),
  initialize_with_readme: z.boolean().optional().default(false).describe("Initialize the new project with a README.md file (default: false for empty repos)"),
  default_branch: z.string().optional().describe("Default branch name (e.g. 'main')"),
});

export const UpdateProjectSchema = ProjectParamsSchema.extend({
  name: z.string().optional().describe("New project name"),
  description: z.string().optional().describe("Updated project description"),
  default_branch: z.string().optional().describe("New default branch (e.g. 'main')"),
  visibility: z.enum(["private", "internal", "public"]).optional().describe("Updated visibility level"),
  topics: z.array(z.string()).optional().describe("Array of project topic tags"),
});

export const DeleteProjectSchema = ProjectParamsSchema.extend({
  confirm_project_name: z
    .string()
    .describe("Explicit safety confirmation: must match project name, path, or path_with_namespace to confirm deletion"),
});

export const GetFileContentsSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("Path to the file or directory in repo (e.g. 'pom.xml' or 'docs/README.md')"),
  ref: z.string().optional().describe("Branch name, tag, or commit SHA (default: default branch / HEAD)"),
});

export const CreateOrUpdateFileSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("File path to create or update (e.g. 'docs/roadmap.md')"),
  content: z.string().describe("Full content of the file to write"),
  commit_message: z.string().describe("Clear Git commit message describing the change"),
  branch: z.string().describe("Branch to commit to (e.g. 'main' or 'feature/auth')"),
  previous_path: z.string().optional().describe("If renaming or moving a file, specify the old path"),
});

export const PushFilesSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Target branch to push to"),
  commit_message: z.string().describe("Git commit message for the batch commit"),
  files: z
    .array(
      z.object({
        file_path: z.string().describe("Destination path for the file"),
        content: z.string().describe("Full file content"),
      })
    )
    .describe("Array of files to create/update in this single commit"),
});

export const ForkRepositorySchema = ProjectParamsSchema.extend({
  namespace: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Target namespace name, path, or ID to fork into (defaults to your personal namespace)"),
  name: z.string().optional().describe("New project name for the fork"),
  path: z.string().optional().describe("New project path/slug for the fork"),
});

// Tool Definitions
export const repositoryTools = [
  { name: "search_repositories", description: "Search for GitLab projects and repositories (optionally filtered by group)", inputSchema: zodToJsonSchema(SearchRepositoriesSchema) },
  { name: "get_project", description: "Get comprehensive project metadata, description, default branch, and statistics", inputSchema: zodToJsonSchema(GetProjectSchema) },
  { name: "create_repository", description: "Create a new GitLab project/repository (supports groups/namespaces and empty repos)", inputSchema: zodToJsonSchema(CreateRepositorySchema), mutating: true },
  { name: "update_project", description: "Update project metadata (description, name, default branch, visibility, topics)", inputSchema: zodToJsonSchema(UpdateProjectSchema), mutating: true },
  { name: "delete_project", description: "Delete a project/repository (requires explicit name confirmation for safety)", inputSchema: zodToJsonSchema(DeleteProjectSchema), mutating: true },
  { name: "get_file_contents", description: "Read file or directory content from a project repository", inputSchema: zodToJsonSchema(GetFileContentsSchema) },
  { name: "create_or_update_file", description: "Create or update a single file in a GitLab repository", inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema), mutating: true },
  { name: "push_files", description: "Commit multiple files in a single atomic commit", inputSchema: zodToJsonSchema(PushFilesSchema), mutating: true },
  { name: "fork_repository", description: "Fork a project into a user or group namespace", inputSchema: zodToJsonSchema(ForkRepositorySchema), mutating: true },
];

// Handlers
export const repositoryHandlers = {
  search_repositories: async (args) => {
    const parsed = SearchRepositoriesSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.search) q.append("search", parsed.search);

    let endpoint = "/projects";
    if (parsed.group !== undefined) {
      const gId = typeof parsed.group === "number" ? parsed.group : encodeURIComponent(parsed.group);
      endpoint = `/groups/${gId}/projects`;
    }

    return await gitlabRequest(`${endpoint}?${q.toString()}`);
  },

  get_project: async (args) => {
    const parsed = GetProjectSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = parsed.statistics ? "?statistics=true" : "";
    const res = await gitlabRequest(`/projects/${pId}${q}`);
    return summarizeProject(res);
  },

  create_repository: async (args) => {
    const parsed = CreateRepositorySchema.parse(args);
    const body = {
      name: parsed.name,
      ...(parsed.path ? { path: parsed.path } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.visibility ? { visibility: parsed.visibility } : {}),
      ...(parsed.initialize_with_readme !== undefined ? { initialize_with_readme: parsed.initialize_with_readme } : {}),
      ...(parsed.default_branch ? { default_branch: parsed.default_branch } : {}),
    };

    if (parsed.namespace !== undefined) {
      body.namespace_id = await resolveNamespaceId(parsed.namespace);
    }

    return await gitlabRequest("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update_project: async (args) => {
    const parsed = UpdateProjectSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {};
    if (parsed.name) body.name = parsed.name;
    if (parsed.description !== undefined) body.description = parsed.description;
    if (parsed.default_branch) body.default_branch = parsed.default_branch;
    if (parsed.visibility) body.visibility = parsed.visibility;
    if (parsed.topics) body.topics = parsed.topics.join(",");

    const res = await gitlabRequest(`/projects/${pId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeProject(res);
  },

  delete_project: async (args) => {
    const parsed = DeleteProjectSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);

    // Safety guard: fetch project first to verify confirmation name matches
    const proj = await gitlabRequest(`/projects/${pId}`);
    const conf = parsed.confirm_project_name.trim().toLowerCase();
    const matches =
      (proj.name && proj.name.toLowerCase() === conf) ||
      (proj.path && proj.path.toLowerCase() === conf) ||
      (proj.path_with_namespace && proj.path_with_namespace.toLowerCase() === conf);

    if (!matches) {
      throw new Error(
        `Project deletion aborted: confirm_project_name '${parsed.confirm_project_name}' does not match project '${proj.path_with_namespace}' or '${proj.name}'.`
      );
    }

    return await gitlabRequest(`/projects/${pId}`, {
      method: "DELETE",
    });
  },

  get_file_contents: async (args) => {
    const parsed = GetFileContentsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedPath = encodeURIComponent(parsed.file_path);
    const ref = parsed.ref ? `?ref=${encodeURIComponent(parsed.ref)}` : "?ref=HEAD";
    const res = await gitlabRequest(`/projects/${pId}/repository/files/${encodedPath}${ref}`);
    if (res.content && res.encoding === "base64") {
      res.decoded_content = Buffer.from(res.content, "base64").toString("utf-8");
    }
    return res;
  },

  create_or_update_file: async (args) => {
    const parsed = CreateOrUpdateFileSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedPath = encodeURIComponent(parsed.file_path);
    const endpoint = `/projects/${pId}/repository/files/${encodedPath}`;

    let method = "POST";
    try {
      await gitlabRequest(`${endpoint}?ref=${encodeURIComponent(parsed.branch)}`);
      method = "PUT";
    } catch {
      // File does not exist yet, use POST
    }

    const body = {
      branch: parsed.branch,
      content: parsed.content,
      commit_message: parsed.commit_message,
      ...(parsed.previous_path ? { previous_path: parsed.previous_path } : {}),
    };

    return await gitlabRequest(endpoint, {
      method,
      body: JSON.stringify(body),
    });
  },

  push_files: async (args) => {
    const parsed = PushFilesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const actions = await Promise.all(
      parsed.files.map(async (file) => {
        const encodedPath = encodeURIComponent(file.file_path);
        let action = "create";
        try {
          await gitlabRequest(`/projects/${pId}/repository/files/${encodedPath}?ref=${encodeURIComponent(parsed.branch)}`);
          action = "update";
        } catch {
          // File does not exist, keep action as create
        }
        return {
          action,
          file_path: file.file_path,
          content: file.content,
        };
      })
    );

    return await gitlabRequest(`/projects/${pId}/repository/commits`, {
      method: "POST",
      body: JSON.stringify({
        branch: parsed.branch,
        commit_message: parsed.commit_message,
        actions,
      }),
    });
  },

  fork_repository: async (args) => {
    const parsed = ForkRepositorySchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {};
    if (parsed.namespace !== undefined) {
      body.namespace_id = await resolveNamespaceId(parsed.namespace);
    }
    if (parsed.name) body.name = parsed.name;
    if (parsed.path) body.path = parsed.path;

    return await gitlabRequest(`/projects/${pId}/fork`, {
      method: "POST",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  },
};
