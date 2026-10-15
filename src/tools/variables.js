import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";
import { summarizeVariable } from "../helpers.js";

// Schemas
export const ListProjectVariablesSchema = ProjectParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(50).describe("Number of variables per page (default: 50, max: 100)"),
});

export const GetProjectVariableSchema = ProjectParamsSchema.extend({
  key: z.string().describe("Variable key/name (e.g. 'DEPLOY_TOKEN')"),
  filter_environment_scope: z.string().optional().describe("Optional environment scope filter (e.g. 'production' or '*')"),
});

export const CreateProjectVariableSchema = ProjectParamsSchema.extend({
  key: z.string().describe("Variable key/name (e.g. 'DATABASE_URL')"),
  value: z.string().describe("Variable value"),
  variable_type: z.enum(["env_var", "file"]).optional().default("env_var").describe("Variable type: 'env_var' or 'file' (default: env_var)"),
  protected: z.boolean().optional().default(false).describe("If true, variable is only passed to pipelines running on protected branches/tags"),
  masked: z.boolean().optional().default(false).describe("If true, variable value is masked in job logs"),
  raw: z.boolean().optional().default(false).describe("If true, variable value is not expanded"),
  environment_scope: z.string().optional().default("*").describe("Environment scope for the variable (default: '*')"),
  description: z.string().optional().describe("Optional description of the variable purpose"),
});

export const UpdateProjectVariableSchema = ProjectParamsSchema.extend({
  key: z.string().describe("Variable key/name to update"),
  value: z.string().optional().describe("New variable value"),
  variable_type: z.enum(["env_var", "file"]).optional().describe("Variable type"),
  protected: z.boolean().optional().describe("Protected status"),
  masked: z.boolean().optional().describe("Masked status in job logs"),
  raw: z.boolean().optional().describe("Raw value status"),
  environment_scope: z.string().optional().describe("Environment scope filter"),
  description: z.string().optional().describe("Variable description"),
});

export const DeleteProjectVariableSchema = ProjectParamsSchema.extend({
  key: z.string().describe("Variable key/name to delete"),
  filter_environment_scope: z.string().optional().describe("Environment scope of the variable to delete"),
});

// Tool Definitions
export const variableTools = [
  {
    name: "list_project_variables",
    title: "List CI/CD Project Variables",
    description: "List all CI/CD pipeline variables configured for a project, including keys, variable types ('env_var' or 'file'), protected/masked flags, and environment scopes. Use to verify secret and configuration presence before running build/deploy pipelines. Do NOT use to fetch secret values; use 'get_project_variable' instead.",
    inputSchema: zodToJsonSchema(ListProjectVariablesSchema),
  },
  {
    name: "get_project_variable",
    title: "Get CI/CD Variable",
    description: "Retrieve comprehensive details and current value of a specific CI/CD variable by key name. Use when debugging pipeline environment failures or checking secret values. Do NOT use to list all configured variables; use 'list_project_variables' instead.",
    inputSchema: zodToJsonSchema(GetProjectVariableSchema),
  },
  {
    name: "create_project_variable",
    title: "Create CI/CD Variable",
    description: "Create a new CI/CD pipeline variable ('env_var' or 'file') with protected, masked, and environment scope settings. Use when configuring build secrets, tokens, or environment configs. Side effect: exposes the variable to CI/CD pipeline jobs immediately. Do NOT use to update existing variables; use 'update_project_variable' instead.",
    inputSchema: zodToJsonSchema(CreateProjectVariableSchema),
    mutating: true,
  },
  {
    name: "update_project_variable",
    title: "Update CI/CD Variable",
    description: "Update the value, masking status, protection status, or environment scope of an existing CI/CD variable. Use when rotating secrets or updating configuration values. Side effect: alters the pipeline execution environment immediately. Do NOT use to create new variables; use 'create_project_variable' instead.",
    inputSchema: zodToJsonSchema(UpdateProjectVariableSchema),
    mutating: true,
  },
  {
    name: "delete_project_variable",
    title: "Delete CI/CD Variable",
    description: "Permanently delete a CI/CD pipeline variable from a project by key. Use when revoking expired credentials or cleaning up obsolete configuration. Side effect: DESTRUCTIVE; subsequent pipeline runs will no longer have access to this variable.",
    inputSchema: zodToJsonSchema(DeleteProjectVariableSchema),
    mutating: true,
  },
];

// Handlers
export const variableHandlers = {
  list_project_variables: async (args) => {
    const parsed = ListProjectVariablesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await gitlabRequest(`/projects/${pId}/variables?${q.toString()}`);
    const items = (res.items || res).map(summarizeVariable);
    return res.pagination ? { pagination: res.pagination, variables: items } : items;
  },

  get_project_variable: async (args) => {
    const parsed = GetProjectVariableSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedKey = encodeURIComponent(parsed.key);
    const q = parsed.filter_environment_scope
      ? `?filter[environment_scope]=${encodeURIComponent(parsed.filter_environment_scope)}`
      : "";
    const res = await gitlabRequest(`/projects/${pId}/variables/${encodedKey}${q}`);
    return summarizeVariable(res);
  },

  create_project_variable: async (args) => {
    const parsed = CreateProjectVariableSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const body = {
      key: parsed.key,
      value: parsed.value,
      variable_type: parsed.variable_type,
      protected: parsed.protected,
      masked: parsed.masked,
      raw: parsed.raw,
      environment_scope: parsed.environment_scope,
      ...(parsed.description ? { description: parsed.description } : {}),
    };
    const res = await gitlabRequest(`/projects/${pId}/variables`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeVariable(res);
  },

  update_project_variable: async (args) => {
    const parsed = UpdateProjectVariableSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedKey = encodeURIComponent(parsed.key);
    const q = parsed.environment_scope
      ? `?filter[environment_scope]=${encodeURIComponent(parsed.environment_scope)}`
      : "";

    const body = {};
    if (parsed.value !== undefined) body.value = parsed.value;
    if (parsed.variable_type !== undefined) body.variable_type = parsed.variable_type;
    if (parsed.protected !== undefined) body.protected = parsed.protected;
    if (parsed.masked !== undefined) body.masked = parsed.masked;
    if (parsed.raw !== undefined) body.raw = parsed.raw;
    if (parsed.description !== undefined) body.description = parsed.description;

    const res = await gitlabRequest(`/projects/${pId}/variables/${encodedKey}${q}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return summarizeVariable(res);
  },

  delete_project_variable: async (args) => {
    const parsed = DeleteProjectVariableSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const encodedKey = encodeURIComponent(parsed.key);
    const q = parsed.filter_environment_scope
      ? `?filter[environment_scope]=${encodeURIComponent(parsed.filter_environment_scope)}`
      : "";
    return await gitlabRequest(`/projects/${pId}/variables/${encodedKey}${q}`, {
      method: "DELETE",
    });
  },
};
