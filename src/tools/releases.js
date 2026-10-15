import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListReleasesSchema = ProjectParamsSchema.extend({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const GetReleaseSchema = ProjectParamsSchema.extend({
  tag_name: z.string().describe("Tag name associated with the release (e.g. 'v1.0.0')"),
});

export const CreateReleaseSchema = ProjectParamsSchema.extend({
  name: z.string().describe("Release title (e.g. 'Release 2.0.0 - Service Modernization')"),
  tag_name: z.string().describe("Git tag name (e.g. 'v2.0.0'). If the tag does not exist, ref is required to create it."),
  ref: z.string().optional().describe("Branch name or commit SHA to create the tag from if it doesn't exist yet"),
  description: z.string().describe("Markdown release notes, changelog, and migration guidance"),
  milestones: z.array(z.string()).optional().describe("Array of milestone titles to associate with this release"),
});

export const ListTagsSchema = ProjectParamsSchema.extend({
  search: z.string().optional().describe("Search query to filter tag names"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const CreateTagSchema = ProjectParamsSchema.extend({
  tag_name: z.string().describe("Name of the tag to create (e.g. 'v2.0.0')"),
  ref: z.string().describe("Branch name or commit SHA that the tag points to (e.g. 'main')"),
  message: z.string().optional().describe("Annotated tag message"),
});

// Tool Definitions
export const releaseTools = [
  { name: "list_releases", description: "List published project releases and version changelogs", inputSchema: zodToJsonSchema(ListReleasesSchema) },
  { name: "get_release", description: "Get release details by tag name", inputSchema: zodToJsonSchema(GetReleaseSchema) },
  { name: "create_release", description: "Publish a formal release with tag, description/changelog, and associated milestones", inputSchema: zodToJsonSchema(CreateReleaseSchema), mutating: true },
  { name: "list_tags", description: "List git tags in the repository", inputSchema: zodToJsonSchema(ListTagsSchema) },
  { name: "create_tag", description: "Create a git tag pointing to a branch or commit", inputSchema: zodToJsonSchema(CreateTagSchema), mutating: true },
];

// Handlers
export const releaseHandlers = {
  list_releases: async (args) => {
    const parsed = ListReleasesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await gitlabRequest(`/projects/${pId}/releases?${q.toString()}`);
    return res.items || res;
  },

  get_release: async (args) => {
    const parsed = GetReleaseSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/releases/${encodeURIComponent(parsed.tag_name)}`);
  },

  create_release: async (args) => {
    const parsed = CreateReleaseSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      name: parsed.name,
      tag_name: parsed.tag_name,
      description: parsed.description,
      ...(parsed.ref ? { ref: parsed.ref } : {}),
      ...(parsed.milestones ? { milestones: parsed.milestones } : {}),
    };
    return await gitlabRequest(`/projects/${pId}/releases`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  list_tags: async (args) => {
    const parsed = ListTagsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.search) q.append("search", parsed.search);
    const res = await gitlabRequest(`/projects/${pId}/repository/tags?${q.toString()}`);
    return res.items || res;
  },

  create_tag: async (args) => {
    const parsed = CreateTagSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/repository/tags`, {
      method: "POST",
      body: JSON.stringify(parsed),
    });
  },
};
