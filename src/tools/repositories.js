import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";
import { summarizeProject, resolveNamespaceId, summarizeCommit, extractSymbolOutline } from "../helpers.js";

// Schemas
export const SearchRepositoriesSchema = z.object({
  search: z.string().optional().describe("Search query to filter project names/descriptions (e.g. 'my-service')"),
  group: z.union([z.string(), z.number()]).optional().describe("Optional group ID or path (e.g. 'buggycode' or 3) to filter repositories strictly within that group"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(10).describe("Number of results per page (default: 10, max: 100)"),
});

export const GetProjectSchema = ProjectParamsSchema.extend({
  statistics: z.boolean().optional().default(false).describe("Include project repository and storage statistics"),
  format: z.enum(["json", "markdown"]).optional().default("markdown").describe("Output format: 'markdown' (default) or 'json'"),
});

export const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository / Project name (e.g. 'mcp-gitlab' or 'my-new-service')"),
  path: z.string().optional().describe("Repository path/slug (e.g. 'mcp-gitlab'). Defaults to name if omitted."),
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
  file_path: z.string().describe("Path to the file or directory in repo (e.g. 'pom.xml', 'docs/README.md', or 'src' for directory tree)"),
  ref: z.string().optional().describe("Branch name, tag, or commit SHA (default: default branch / HEAD)"),
  outline_only: z
    .boolean()
    .optional()
    .default(false)
    .describe("When true, extract and return only high-level symbol declarations (classes, functions, interfaces, methods, types) with their line numbers instead of full content (default: false)"),
  start_line: z.number().optional().describe("Optional 1-based start line to slice content"),
  end_line: z.number().optional().describe("Optional 1-based end line to slice content"),
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
        file_path: z.string().describe("Destination path for the file relative to repository root"),
        content: z.string().optional().describe("Full file content (required for create/update)"),
        action: z
          .enum(["create", "update", "delete", "move"])
          .optional()
          .describe("Commit action: 'create', 'update', 'delete', or 'move' (auto-detected via GET probe if omitted)"),
        previous_path: z.string().optional().describe("Previous file path (required when action is 'move')"),
      })
    )
    .min(1)
    .describe("Array of file operations (create, update, delete, or move) to commit atomically"),
});

export const CreateCommitSchema = PushFilesSchema;

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
  {
    name: "search_repositories",
    title: "Search Repositories",
    description: "Search for GitLab projects and repositories across the instance or scoped to a specific group namespace (recommended to reduce instance load). Capped at 100 per page. If project_id or path_with_namespace is already known, look up directly via 'get_project'.",
    inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
  },
  {
    name: "get_project",
    title: "Get Project Details",
    description: "Retrieve comprehensive metadata for a specific GitLab project, including default branch, repository statistics, visibility, and topic tags. Use to inspect repository settings or verify project access. Do NOT use to inspect directory trees or source code; use 'get_file_contents' instead.",
    inputSchema: zodToJsonSchema(GetProjectSchema),
  },
  {
    name: "create_repository",
    title: "Create Repository",
    description: "Create a new GitLab project/repository under your personal namespace or a designated group. Use when provisioning new codebases or initializing repositories. Side effect: creates a new GitLab project immediately. Do NOT use to duplicate existing projects; use 'fork_repository' instead.",
    inputSchema: zodToJsonSchema(CreateRepositorySchema),
    mutating: true,
  },
  {
    name: "update_project",
    title: "Update Project Settings",
    description: "Update mutable project settings including display name, description, default branch, visibility level, and topics. Use to modify repository configurations or administrative details. Side effect: alters project settings immediately. Do NOT use to commit code changes; use 'create_or_update_file' or 'push_files'.",
    inputSchema: zodToJsonSchema(UpdateProjectSchema),
    mutating: true,
  },
  {
    name: "delete_project",
    title: "Delete Project",
    description: "Permanently delete a GitLab project and all its repository files, issues, merge requests, and CI/CD pipelines. Use solely for project decommissioning. Side effect: DESTRUCTIVE and irreversible. Requires explicit safety confirmation via confirm_project_name.",
    inputSchema: zodToJsonSchema(DeleteProjectSchema),
    mutating: true,
  },
  {
    name: "get_file_contents",
    title: "Get File Contents",
    description: "Read the raw content of a specific file or directory tree from a repository at a designated branch, tag, or commit ref. Use when inspecting current repository source code or configs. Do NOT use for reviewing diffs between branches (use 'get_merge_request_changes') or viewing commit diffs (use 'get_commit').",
    inputSchema: zodToJsonSchema(GetFileContentsSchema),
  },
  {
    name: "create_or_update_file",
    title: "Create or Update File",
    description: "Create a new file or update the content of an existing file in a repository with a Git commit. Use for single-file changes or documentation updates. Side effect: creates an immediate Git commit on the remote branch. Do NOT use when updating multiple files together; use 'push_files' instead for atomic multi-file commits.",
    inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema),
    mutating: true,
  },
  {
    name: "push_files",
    title: "Push Multiple Files",
    description: "Atomically commit multiple file additions, modifications, or deletions to a target branch in a single Git commit. Use for multi-file refactors, features, or project scaffolding. Side effect: creates an atomic multi-action Git commit on the remote branch. Use instead of calling 'create_or_update_file' in a loop.",
    inputSchema: zodToJsonSchema(PushFilesSchema),
    mutating: true,
  },
  {
    name: "create_commit",
    title: "Create Multi-File Atomic Commit",
    description: "Atomically commit multiple file additions, modifications, or updates to a target branch in a single Git commit using GitLab Commits API. Use for multi-file refactors, features, or project scaffolding without local git cloning. Side effect: creates an atomic multi-action Git commit on the remote branch.",
    inputSchema: zodToJsonSchema(CreateCommitSchema),
    mutating: true,
  },
  {
    name: "fork_repository",
    title: "Fork Repository",
    description: "Fork an existing GitLab project into a designated user namespace or group. Use when contributing to upstream projects or establishing an independent fork. Side effect: provisions a new repository linked to the upstream source. Do NOT use to create fresh empty projects; use 'create_repository' instead.",
    inputSchema: zodToJsonSchema(ForkRepositorySchema),
    mutating: true,
  },
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

    const res = await gitlabRequest(`${endpoint}?${q.toString()}`);
    const items = (res.items || res).map(summarizeProject);
    return res.pagination ? { pagination: res.pagination, projects: items } : items;
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

    const res = await gitlabRequest("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeProject(res);
  },

  update_project: async (args) => {
    const parsed = UpdateProjectSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {};
    if (parsed.name) body.name = parsed.name;
    if (parsed.description !== undefined) body.description = parsed.description;
    if (parsed.default_branch) body.default_branch = parsed.default_branch;
    if (parsed.visibility) body.visibility = parsed.visibility;
    if (parsed.topics) body.topics = parsed.topics;

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
    const cleanPath = (parsed.file_path || "").trim().replace(/^\/+|\/+$/g, "");
    const refVal = parsed.ref || "HEAD";

    const fetchDirectoryTree = async () => {
      const treeQuery = new URLSearchParams({ per_page: "100" });
      if (cleanPath && cleanPath !== ".") treeQuery.append("path", cleanPath);
      if (parsed.ref) treeQuery.append("ref", parsed.ref);
      const treeRes = await gitlabRequest(`/projects/${pId}/repository/tree?${treeQuery.toString()}`);
      const items = treeRes.items || treeRes || [];
      return {
        type: "directory",
        path: cleanPath || "/",
        ref: refVal,
        entries: items.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          mode: item.mode,
        })),
      };
    };

    if (!cleanPath || cleanPath === ".") {
      return await fetchDirectoryTree();
    }

    const encodedPath = encodeURIComponent(cleanPath);
    const refQuery = `?ref=${encodeURIComponent(refVal)}`;
    let res;
    try {
      res = await gitlabRequest(`/projects/${pId}/repository/files/${encodedPath}${refQuery}`);
    } catch (err) {
      if (err.message && err.message.includes("404")) {
        return await fetchDirectoryTree();
      }
      throw err;
    }

    if (res.content !== undefined && res.encoding === "base64") {
      res.decoded_content = Buffer.from(res.content, "base64").toString("utf-8");
      delete res.content;
      delete res.content_sha256;
      delete res.blob_id;
      delete res.execute_filemode;

      if (parsed.outline_only) {
        res.outline = extractSymbolOutline(res.decoded_content, cleanPath);
        delete res.decoded_content;
      } else if (parsed.start_line || parsed.end_line) {
        const lines = res.decoded_content.split(/\r?\n/);
        const start = Math.max(1, parsed.start_line || 1);
        const end = Math.min(lines.length, parsed.end_line || lines.length);
        res.decoded_content = lines.slice(start - 1, end).join("\n");
        res.sliced_lines = `${start}-${end} of ${lines.length}`;
      }
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

    const res = await gitlabRequest(endpoint, {
      method,
      body: JSON.stringify(body),
    });
    return {
      file_path: res.file_path,
      branch: res.branch,
    };
  },

  push_files: async (args) => {
    const parsed = PushFilesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const commitMsg = parsed.commit_message.trim();
    if (!commitMsg) {
      throw new Error("Commit message ('commit_message') cannot be empty");
    }

    const actions = await Promise.all(
      parsed.files.map(async (file, idx) => {
        const cleanPath = (file.file_path || "").trim().replace(/^\/+/, "");
        if (!cleanPath) {
          throw new Error(`File at index ${idx} has an empty 'file_path'`);
        }

        let action = file.action;
        if (!action) {
          const encodedPath = encodeURIComponent(cleanPath);
          action = "create";
          try {
            await gitlabRequest(`/projects/${pId}/repository/files/${encodedPath}?ref=${encodeURIComponent(parsed.branch)}`);
            action = "update";
          } catch {
            // File does not exist, keep action as create
          }
        }

        if (action === "delete") {
          return {
            action: "delete",
            file_path: cleanPath,
          };
        }

        if (action === "move") {
          if (!file.previous_path) {
            throw new Error(`File '${cleanPath}' has action 'move' and requires 'previous_path'`);
          }
          return {
            action: "move",
            file_path: cleanPath,
            previous_path: file.previous_path.trim().replace(/^\/+/, ""),
            ...(file.content !== undefined ? { content: file.content } : {}),
          };
        }

        if (file.content === undefined) {
          throw new Error(`File '${cleanPath}' is missing 'content' (required for ${action})`);
        }

        return {
          action,
          file_path: cleanPath,
          content: file.content,
        };
      })
    );

    const res = await gitlabRequest(`/projects/${pId}/repository/commits`, {
      method: "POST",
      body: JSON.stringify({
        branch: parsed.branch,
        commit_message: commitMsg,
        actions,
      }),
    });
    return summarizeCommit(res);
  },

  create_commit: async (args) => {
    return repositoryHandlers.push_files(args);
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

    const res = await gitlabRequest(`/projects/${pId}/fork`, {
      method: "POST",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
    return summarizeProject(res);
  },
};
