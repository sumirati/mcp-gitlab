import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { summarizePipeline, summarizeJob } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListPipelinesSchema = ProjectParamsSchema.extend({
  ref: z.string().optional().describe("Filter pipelines by branch name or git tag (e.g. 'main')"),
  status: z
    .enum(["running", "pending", "success", "failed", "canceled", "skipped", "manual"])
    .optional()
    .describe("Filter by pipeline status"),
  sha: z.string().optional().describe("Filter by commit SHA"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const GetPipelineSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("Numeric ID of the pipeline"),
});

export const CreatePipelineSchema = ProjectParamsSchema.extend({
  ref: z.string().describe("Branch name or git tag to trigger the pipeline for (e.g. 'main')"),
  variables: z
    .array(
      z.object({
        key: z.string().describe("Environment variable name"),
        value: z.string().describe("Environment variable value"),
      })
    )
    .optional()
    .describe("Optional CI/CD variables to pass to the pipeline execution"),
});

export const ListPipelineJobsSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("Numeric ID of the pipeline"),
  scope: z
    .enum(["created", "pending", "running", "failed", "success", "canceled", "skipped", "manual"])
    .optional()
    .describe("Filter jobs by execution status"),
});

export const GetJobTraceSchema = ProjectParamsSchema.extend({
  job_id: z.number().describe("Numeric ID of the build or test job"),
  tail_lines: z
    .number()
    .optional()
    .default(250)
    .describe("Number of trailing lines from log to return (prevents overflowing context, default: 250, 0 for all)"),
});

export const GetPipelineTestReportSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("Numeric ID of the pipeline to fetch test results for"),
});

// Tool Definitions
export const pipelineTools = [
  { name: "list_pipelines", description: "List CI/CD pipelines filtered by branch, tag, status, or commit SHA", inputSchema: zodToJsonSchema(ListPipelinesSchema) },
  { name: "get_pipeline", description: "Get detailed status, duration, and commit info for a pipeline", inputSchema: zodToJsonSchema(GetPipelineSchema) },
  { name: "create_pipeline", description: "Trigger a new CI/CD pipeline execution for a branch or tag", inputSchema: zodToJsonSchema(CreatePipelineSchema), mutating: true },
  { name: "list_pipeline_jobs", description: "List all jobs (build, test, lint, deploy) and their status in a pipeline", inputSchema: zodToJsonSchema(ListPipelineJobsSchema) },
  { name: "get_job_trace", description: "Get the terminal output log of a build/test job (supports tailing to diagnose test failures)", inputSchema: zodToJsonSchema(GetJobTraceSchema) },
  { name: "get_pipeline_test_report", description: "Get JUnit test report summary (total, passed, failed test suites and error details)", inputSchema: zodToJsonSchema(GetPipelineTestReportSchema) },
];

// Handlers
export const pipelineHandlers = {
  list_pipelines: async (args) => {
    const parsed = ListPipelinesSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.ref) q.append("ref", parsed.ref);
    if (parsed.status) q.append("status", parsed.status);
    if (parsed.sha) q.append("sha", parsed.sha);
    const res = await gitlabRequest(`/projects/${pId}/pipelines?${q.toString()}`);
    const items = (res.items || res).map(summarizePipeline);
    return res.pagination ? { pagination: res.pagination, pipelines: items } : items;
  },

  get_pipeline: async (args) => {
    const parsed = GetPipelineSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}`);
  },

  create_pipeline: async (args) => {
    const parsed = CreatePipelineSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const res = await gitlabRequest(`/projects/${pId}/pipeline`, {
      method: "POST",
      body: JSON.stringify({
        ref: parsed.ref,
        ...(parsed.variables ? { variables: parsed.variables } : {}),
      }),
    });
    return summarizePipeline(res);
  },

  list_pipeline_jobs: async (args) => {
    const parsed = ListPipelineJobsSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const q = parsed.scope ? `?scope=${encodeURIComponent(parsed.scope)}` : "";
    const res = await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}/jobs${q}`);
    return (res.items || res).map(summarizeJob);
  },

  get_job_trace: async (args) => {
    const parsed = GetJobTraceSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const rawLog = await gitlabRequest(`/projects/${pId}/jobs/${parsed.job_id}/trace`, {}, "text");
    let output = rawLog;
    if (parsed.tail_lines > 0) {
      const lines = rawLog.split("\n");
      if (lines.length > parsed.tail_lines) {
        output = `[... Truncated first ${lines.length - parsed.tail_lines} lines ...]\n` + lines.slice(-parsed.tail_lines).join("\n");
      }
    }
    return output;
  },

  get_pipeline_test_report: async (args) => {
    const parsed = GetPipelineTestReportSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}/test_report`);
  },
};
