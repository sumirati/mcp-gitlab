import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";

// Helper: Parse markdown headings to generate a structured Table of Contents
function extractWikiHeadings(markdown) {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ level, title, anchor, line: i + 1 });
    }
  }
  return headings;
}

// Helper: Extract a single section under a target heading
function extractSectionContent(markdown, targetSection) {
  if (!markdown) return { found: false, message: "Wiki page has no content" };
  const cleanTarget = targetSection.replace(/^#/, "").trim().toLowerCase();
  const lines = markdown.split("\n");
  let targetIndex = -1;
  let targetLevel = 0;
  let targetTitle = "";

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      if (
        title.toLowerCase() === cleanTarget ||
        anchor === cleanTarget ||
        title.toLowerCase().includes(cleanTarget)
      ) {
        targetIndex = i;
        targetLevel = level;
        targetTitle = title;
        break;
      }
    }
  }

  if (targetIndex === -1) {
    return {
      found: false,
      message: `Section matching '${targetSection}' not found in wiki page. Call with toc_only: true to inspect available chapters.`,
    };
  }

  const sectionLines = [lines[targetIndex]];
  for (let i = targetIndex + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      if (level <= targetLevel) {
        break;
      }
    }
    sectionLines.push(lines[i]);
  }

  return {
    found: true,
    title: targetTitle,
    content: sectionLines.join("\n").trim(),
  };
}

// Schemas
export const ListWikisSchema = ProjectParamsSchema.extend({
  with_content: z.boolean().optional().default(false).describe("If true, includes full wiki content for each page"),
});

export const GetWikiSchema = ProjectParamsSchema.extend({
  slug: z.string().describe("Wiki page slug or title (e.g. 'home' or 'architecture#database-schema')"),
  section: z.string().optional().describe("Optional chapter/heading title or anchor (e.g. 'Data Model' or '#data-model') to extract only that section"),
  toc_only: z.boolean().optional().default(false).describe("If true, returns only the structured Table of Contents (saves thousands of tokens)"),
  max_length: z.number().optional().describe("Optional max character length to truncate full content to"),
});

export const CreateWikiSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Wiki page title (e.g. 'Deployment Architecture')"),
  content: z.string().describe("Markdown content for the new wiki page"),
  format: z.enum(["markdown", "rdoc", "asciidoc"]).optional().default("markdown").describe("Wiki format (default: markdown)"),
});

export const UpdateWikiSchema = ProjectParamsSchema.extend({
  slug: z.string().describe("Slug of the existing wiki page to edit"),
  content: z.string().describe("New markdown content for the wiki page"),
  title: z.string().optional().describe("Optional new title if renaming the wiki page"),
  format: z.enum(["markdown", "rdoc", "asciidoc"]).optional().describe("Wiki format"),
});

// Tool Definitions
export const wikiTools = [
  { name: "list_wikis", description: "List all wiki pages in a GitLab project (slugs, titles, and formats)", inputSchema: zodToJsonSchema(ListWikisSchema) },
  { name: "get_wiki", description: "Get wiki page content, structured Table of Contents (toc_only), or a specific chapter/section by heading", inputSchema: zodToJsonSchema(GetWikiSchema) },
  { name: "create_wiki", description: "Create a new wiki page in a GitLab project", inputSchema: zodToJsonSchema(CreateWikiSchema) },
  { name: "update_wiki", description: "Update an existing wiki page's content or title in a GitLab project", inputSchema: zodToJsonSchema(UpdateWikiSchema) },
];

// Handlers
export const wikiHandlers = {
  list_wikis: async (args) => {
    const parsed = ListWikisSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = parsed.with_content ? "?with_content=1" : "";
    const res = await gitlabRequest(`/projects/${pId}/wikis${q}`);
    const items = res.items || res;
    return items.map((w) => ({
      slug: w.slug,
      title: w.title,
      format: w.format,
      ...(w.content ? { content: w.content.slice(0, 300) + "..." } : {}),
    }));
  },

  get_wiki: async (args) => {
    const parsed = GetWikiSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    let [cleanSlug, inlineSection] = parsed.slug.split("#");
    const targetSection = parsed.section || inlineSection;

    const res = await gitlabRequest(`/projects/${pId}/wikis/${encodeURIComponent(cleanSlug)}`);
    const rawContent = res.content || "";

    if (parsed.toc_only) {
      const headings = extractWikiHeadings(rawContent);
      return {
        slug: res.slug,
        title: res.title,
        format: res.format,
        table_of_contents: headings,
      };
    }

    if (targetSection) {
      const sectionResult = extractSectionContent(rawContent, targetSection);
      if (!sectionResult.found) {
        return {
          slug: res.slug,
          title: res.title,
          error: sectionResult.message,
          table_of_contents: extractWikiHeadings(rawContent),
        };
      }
      return {
        slug: res.slug,
        title: res.title,
        section: sectionResult.title,
        content: sectionResult.content,
      };
    }

    let finalContent = rawContent;
    if (parsed.max_length && finalContent.length > parsed.max_length) {
      finalContent = finalContent.slice(0, parsed.max_length) + `\n\n[... Truncated remainder of ${finalContent.length} bytes ...]`;
    }

    return {
      slug: res.slug,
      title: res.title,
      format: res.format,
      content: finalContent,
    };
  },

  create_wiki: async (args) => {
    const parsed = CreateWikiSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      title: parsed.title,
      content: parsed.content,
      format: parsed.format,
    };
    return await gitlabRequest(`/projects/${pId}/wikis`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update_wiki: async (args) => {
    const parsed = UpdateWikiSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      content: parsed.content,
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.format ? { format: parsed.format } : {}),
    };
    return await gitlabRequest(`/projects/${pId}/wikis/${encodeURIComponent(parsed.slug)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};
