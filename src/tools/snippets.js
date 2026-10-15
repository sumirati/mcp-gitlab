import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { summarizeSnippet } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListSnippetsSchema = ProjectParamsSchema.extend({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const GetSnippetSchema = ProjectParamsSchema.extend({
  snippet_id: z.number().describe("Numeric snippet ID"),
  raw: z.boolean().optional().default(true).describe("If true, also fetches the raw code content of the snippet"),
});

export const CreateSnippetSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Snippet title summarizing the snippet"),
  file_name: z.string().describe("File name with extension (e.g. 'auth-interceptor.js' or 'setup.sh')"),
  content: z.string().describe("Code or text content of the snippet"),
  description: z.string().optional().describe("Optional description of the snippet"),
  visibility: z.enum(["private", "internal", "public"]).optional().default("internal").describe("Snippet visibility level"),
});

export const UpdateSnippetSchema = ProjectParamsSchema.extend({
  snippet_id: z.number().describe("Numeric ID of the snippet to update"),
  title: z.string().optional().describe("Updated snippet title"),
  file_name: z.string().optional().describe("Updated file name"),
  content: z.string().optional().describe("Updated code or text content"),
  description: z.string().optional().describe("Updated description"),
  visibility: z.enum(["private", "internal", "public"]).optional().describe("Updated visibility level"),
});

// Tool Definitions
export const snippetTools = [
  { name: "list_snippets", description: "List code snippets in a GitLab project with visibility and author details", inputSchema: zodToJsonSchema(ListSnippetsSchema) },
  { name: "get_snippet", description: "Get code snippet details and raw file content by snippet ID", inputSchema: zodToJsonSchema(GetSnippetSchema) },
  { name: "create_snippet", description: "Create a new code snippet in a GitLab project", inputSchema: zodToJsonSchema(CreateSnippetSchema), mutating: true },
  { name: "update_snippet", description: "Update an existing code snippet's content, title, file name, or visibility", inputSchema: zodToJsonSchema(UpdateSnippetSchema), mutating: true },
];

// Handlers
export const snippetHandlers = {
  list_snippets: async (args) => {
    const parsed = ListSnippetsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await gitlabRequest(`/projects/${pId}/snippets?${q.toString()}`);
    const items = (res.items || res).map(summarizeSnippet);
    return res.pagination ? { pagination: res.pagination, snippets: items } : items;
  },

  get_snippet: async (args) => {
    const parsed = GetSnippetSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const meta = await gitlabRequest(`/projects/${pId}/snippets/${parsed.snippet_id}`);
    const out = summarizeSnippet(meta);

    if (parsed.raw) {
      try {
        const rawCode = await gitlabRequest(`/projects/${pId}/snippets/${parsed.snippet_id}/raw`, {}, "text");
        out.content = rawCode;
      } catch {
        // Fallback if raw endpoint unavailable
      }
    }

    return out;
  },

  create_snippet: async (args) => {
    const parsed = CreateSnippetSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      title: parsed.title,
      file_name: parsed.file_name,
      content: parsed.content,
      visibility: parsed.visibility,
      ...(parsed.description ? { description: parsed.description } : {}),
    };
    const res = await gitlabRequest(`/projects/${pId}/snippets`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeSnippet(res);
  },

  update_snippet: async (args) => {
    const parsed = UpdateSnippetSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.file_name ? { file_name: parsed.file_name } : {}),
      ...(parsed.content ? { content: parsed.content } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.visibility ? { visibility: parsed.visibility } : {}),
    };
    const res = await gitlabRequest(`/projects/${pId}/snippets/${parsed.snippet_id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeSnippet(res);
  },
};
