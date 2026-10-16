import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId, isReadOnly } from "../client.js";
import { ProjectParamsSchema } from "../schemas.js";
import { summarizeMirror, summarizeRunner, summarizeHook } from "../helpers.js";

// Schemas
export const SystemHealthCheckSchema = z.object({});

export const ListPushMirrorsSchema = ProjectParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(10).describe("Number of mirrors per page (default: 10)"),
});

export const TriggerPushMirrorSyncSchema = ProjectParamsSchema.extend({
  mirror_id: z.number().describe("The ID of the remote push mirror to sync"),
});

export const ListRunnersSchema = z.object({
  project_id: z.union([z.string(), z.number()]).optional().describe("Optional project ID or path to list project-specific runners. If omitted, lists accessible instance/group runners."),
  type: z.enum(["instance_type", "group_type", "project_type"]).optional().describe("Filter runners by type"),
  status: z.enum(["active", "paused", "online", "offline"]).optional().describe("Filter runners by status"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(10).describe("Number of runners per page (default: 10)"),
});

export const GetRunnerStatusSchema = z.object({
  runner_id: z.number().describe("The numeric ID of the CI/CD runner to inspect"),
});

export const ListProjectHooksSchema = ProjectParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(10).describe("Number of hooks per page (default: 10)"),
});

// Tool Definitions
export const enterpriseTools = [
  {
    name: "system_health_check",
    title: "System Health & Diagnostics Check",
    description: "Perform end-to-end connectivity, latency, and permission diagnostics against the GitLab instance. Verifies API availability, authentication identity, server version/edition (when permitted), and active read-only policy.",
    inputSchema: zodToJsonSchema(SystemHealthCheckSchema),
  },
  {
    name: "list_push_mirrors",
    title: "List Push Mirrors",
    description: "List remote push mirrors configured for a project, including synchronization status, target URLs, and last error diagnostics. Essential for verifying repository synchronization between local self-hosted instances and upstream GitLab instances or remote Git hosts.",
    inputSchema: zodToJsonSchema(ListPushMirrorsSchema),
  },
  {
    name: "trigger_push_mirror_sync",
    title: "Trigger Push Mirror Sync",
    description: "Force an immediate push mirror synchronization for a designated project remote mirror. Use when code has been committed locally and immediate upstream replication is required without waiting for the scheduled background sync interval.",
    inputSchema: zodToJsonSchema(TriggerPushMirrorSyncSchema),
    mutating: true,
  },
  {
    name: "list_runners",
    title: "List CI/CD Runners",
    description: "List available GitLab CI/CD runners (instance, group, or project-level), detailing their online status, active/paused state, and executor types. Use to diagnose CI pipeline execution delays, runner connectivity, or missing executor tags.",
    inputSchema: zodToJsonSchema(ListRunnersSchema),
  },
  {
    name: "get_runner_status",
    title: "Get Runner Status",
    description: "Retrieve comprehensive details and health status for a specific CI/CD runner, including IP address, architecture, runner version, tags, and last contacted timestamp. Use to troubleshoot stuck jobs or unresponsive self-hosted runners.",
    inputSchema: zodToJsonSchema(GetRunnerStatusSchema),
  },
  {
    name: "list_project_hooks",
    title: "List Project Webhooks",
    description: "List configured project webhooks and their subscribed triggers (push, merge requests, issues, pipeline events). Use to audit integration webhooks and verify CI/CD automation hook registrations.",
    inputSchema: zodToJsonSchema(ListProjectHooksSchema),
  },
];

// Handlers
export const enterpriseHandlers = {
  system_health_check: async () => {
    const startTime = Date.now();
    let versionInfo = null;
    try {
      versionInfo = await gitlabRequest("/version");
    } catch {
      // /version endpoint may require admin access in some GitLab configurations; fallback gracefully
    }
    const user = await gitlabRequest("/user");
    const latencyMs = Date.now() - startTime;

    return {
      status: "healthy",
      api_latency_ms: latencyMs,
      read_only_mode: isReadOnly(),
      authenticated_user: {
        id: user.id,
        username: user.username,
        name: user.name,
        is_admin: Boolean(user.is_admin),
      },
      instance: versionInfo
        ? {
            version: versionInfo.version,
            revision: versionInfo.revision,
          }
        : {
            version: "accessible (endpoint /version restricted to admin)",
          },
    };
  },

  list_push_mirrors: async (args) => {
    const parsed = ListPushMirrorsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await gitlabRequest(`/projects/${pId}/remote_mirrors?${q.toString()}`);
    const items = (res.items || res).map(summarizeMirror);
    return res.pagination ? { pagination: res.pagination, mirrors: items } : items;
  },

  trigger_push_mirror_sync: async (args) => {
    const parsed = TriggerPushMirrorSyncSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/remote_mirrors/${parsed.mirror_id}/sync`, {
      method: "POST",
    });
    return {
      message: `Triggered push mirror sync for mirror ID ${parsed.mirror_id} in project ${parsed.project_id}`,
      result: res,
    };
  },

  list_runners: async (args) => {
    const parsed = ListRunnersSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.type) q.append("type", parsed.type);
    if (parsed.status) q.append("status", parsed.status);

    let endpoint = "/runners";
    if (parsed.project_id !== undefined) {
      const pId = formatProjectId(parsed.project_id);
      endpoint = `/projects/${pId}/runners`;
    }

    const res = await gitlabRequest(`${endpoint}?${q.toString()}`);
    const items = (res.items || res).map(summarizeRunner);
    return res.pagination ? { pagination: res.pagination, runners: items } : items;
  },

  get_runner_status: async (args) => {
    const parsed = GetRunnerStatusSchema.parse(args);
    const res = await gitlabRequest(`/runners/${parsed.runner_id}`);
    const summary = summarizeRunner(res);
    return {
      ...summary,
      architecture: res.architecture || null,
      platform: res.platform || null,
      version: res.version || null,
      tag_list: res.tag_list || [],
      run_untagged: res.run_untagged ?? null,
      locked: res.locked ?? null,
      access_level: res.access_level || null,
    };
  },

  list_project_hooks: async (args) => {
    const parsed = ListProjectHooksSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await gitlabRequest(`/projects/${pId}/hooks?${q.toString()}`);
    const items = (res.items || res).map(summarizeHook);
    return res.pagination ? { pagination: res.pagination, hooks: items } : items;
  },
};
