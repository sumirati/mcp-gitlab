import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const SearchRepositoriesSchema = z.object({
  search: z.string().describe("Search query to filter project names/descriptions (e.g. 'my-service')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of results per page (default: 20, max: 100)"),
});

export const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository / Project name (e.g. 'my-new-service')"),
  description: z.string().optional().describe("Short project description"),
  visibility: z.enum(["private", "internal", "public"]).optional().default("internal").describe("Visibility level"),
  initialize_with_readme: z.boolean().optional().default(true).describe("Initialize the new project with a README.md file"),
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
  namespace: z.string().optional().describe("Target namespace path to fork into (defaults to your personal namespace)"),
});

export const CreateBranchSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Name of the new branch to create (e.g. 'feature/upgrade-java')"),
  ref: z.string().optional().default("HEAD").describe("Source branch, tag, or commit SHA to branch from (default: HEAD)"),
});

// Tool Definitions
export const repositoryTools = [
  { name: "search_repositories", description: "Search for GitLab projects and repositories", inputSchema: zodToJsonSchema(SearchRepositoriesSchema) },
  { name: "create_repository", description: "Create a new GitLab project/repository", inputSchema: zodToJsonSchema(CreateRepositorySchema) },
  { name: "get_file_contents", description: "Read file or directory content from a project repository", inputSchema: zodToJsonSchema(GetFileContentsSchema) },
  { name: "create_or_update_file", description: "Create or update a single file in a GitLab repository", inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema) },
  { name: "push_files", description: "Commit multiple files in a single atomic commit", inputSchema: zodToJsonSchema(PushFilesSchema) },
  { name: "fork_repository", description: "Fork a project into a user or group namespace", inputSchema: zodToJsonSchema(ForkRepositorySchema) },
  { name: "create_branch", description: "Create a new branch from a commit, tag, or branch", inputSchema: zodToJsonSchema(CreateBranchSchema) },
];

// Handlers
export const repositoryHandlers = {
  search_repositories: async (args) => {
    const parsed = SearchRepositoriesSchema.parse(args);
    const q = new URLSearchParams({
      search: parsed.search,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    return await gitlabRequest(`/projects?${q.toString()}`);
  },

  create_repository: async (args) => {
    const parsed = CreateRepositorySchema.parse(args);
    return await gitlabRequest("/projects", {
      method: "POST",
      body: JSON.stringify(parsed),
    });
  },

  get_file_contents: async (args) => {
    const parsed = GetFileContentsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedPath = encodeURIComponent(parsed.file_path);
    const ref = parsed.ref ? `?ref=${encodeURIComponent(parsed.ref)}` : "?ref=HEAD";
    const res = await gitlabRequest(`/projects/${pId}/repository/files/${encodedPath}${ref}`);
    if (res && !Array.isArray(res) && res.content) {
      res.content = Buffer.from(res.content, "base64").toString("utf8");
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
    return await gitlabRequest(`/projects/${pId}/repository/commits`, {
      method: "POST",
      body: JSON.stringify({
        branch: parsed.branch,
        commit_message: parsed.commit_message,
        actions: parsed.files.map((f) => ({
          action: "create",
          file_path: f.file_path,
          content: f.content,
        })),
      }),
    });
  },

  fork_repository: async (args) => {
    const parsed = ForkRepositorySchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = parsed.namespace ? `?namespace=${encodeURIComponent(parsed.namespace)}` : "";
    return await gitlabRequest(`/projects/${pId}/fork${q}`, { method: "POST" });
  },

  create_branch: async (args) => {
    const parsed = CreateBranchSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/repository/branches`, {
      method: "POST",
      body: JSON.stringify({
        branch: parsed.branch,
        ref: parsed.ref,
      }),
    });
  },
};
