import { z } from "zod";

export function zodToJsonSchema(schema) {
  if (typeof z.toJSONSchema === "function") {
    return z.toJSONSchema(schema);
  }
  return schema.toJSONSchema();
}

export const ProjectParamsSchema = z.object({
  project_id: z
    .union([z.string(), z.number()])
    .describe("Project numeric ID (e.g. 31) or namespace path (e.g. 'group/project-name'). URL-encoding is handled automatically."),
});
