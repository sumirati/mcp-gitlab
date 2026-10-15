import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { summarizePipeline, summarizeJob } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListPipelinesSchema = ProjectParamsSchema.extend({
  ref: z.string().optional().describe("Filter pipelines by branch or tag name"),
  status: z
    .enum(["running", "pending", "success", "failed", "canceled", "skipped", "manual"])
    .optional()
    .describe("Filter pipelines by execution status"),
  sha: z.string().optional().describe("Filter pipelines by commit SHA"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of pipelines per page (default: 20, max: 100)"),
});

export const GetPipelineSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("Numeric ID of the pipeline"),
});

export const CreatePipelineSchema = ProjectParamsSchema.extend({
  ref: z.string().describe("Branch or tag name to run the pipeline on"),
  variables: z
    .array(
      z.object({
        key: z.string().describe("Variable name"),
        value: z.string().describe("Variable value"),
        variable_type: z.enum(["env_var", "file"]).optional().default("env_var").describe("Type of variable"),
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

export const GetJobSchema = ProjectParamsSchema.extend({
  job_id: z.number().describe("Numeric ID of the build or test job"),
});

export const GetJobTraceSchema = ProjectParamsSchema.extend({
  job_id: z.number().describe("Numeric ID of the build or test job"),
  tail_lines: z
    .number()
    .optional()
    .default(250)
    .describe("Number of trailing lines from log to return (prevents overflowing context, default: 250, 0 for all)"),
});

export const GetJobArtifactFileSchema = ProjectParamsSchema.extend({
  job_id: z.number().describe("Numeric ID of the job that generated the artifact"),
  artifact_path: z.string().describe("Relative path to the file in the artifact archive (e.g. 'coverage/report.json' or 'dist/index.html')"),
  max_length: z.number().optional().default(10000).describe("Maximum character length to return (default: 10000, 0 for unlimited)"),
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
  { name: "get_job", description: "Get comprehensive details about a CI/CD job (duration, runner, failure reason, artifacts list)", inputSchema: zodToJsonSchema(GetJobSchema) },
  { name: "get_job_trace", description: "Get the terminal output log of a build/test job (supports tailing to diagnose test failures)", inputSchema: zodToJsonSchema(GetJobTraceSchema) },
  { name: "get_job_artifact_file", description: "Download and read a specific file from a job's build artifacts archive", inputSchema: zodToJsonSchema(GetJobArtifactFileSchema) },
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

  get_job: async (args) => {
    const parsed = GetJobSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    const j = await gitlabRequest(`/projects/${pId}/jobs/${parsed.job_id}`);
    return {
      id: j.id,
      name: j.name,
      stage: j.stage,
      status: j.status,
      ref: j.ref,
      tag: j.tag,
      duration: j.duration,
      queued_duration: j.queued_duration,
      failure_reason: j.failure_reason,
      created_at: j.created_at,
      started_at: j.started_at,
      finished_at: j.finished_at,
      user: j.user ? j.user.username : null,
      runner: j.runner ? { id: j.runner.id, description: j.runner.description } : null,
      artifacts: (j.artifacts || []).map((a) => ({
        file_type: a.file_type,
        size: a.size,
        filename: a.filename,
      })),
      web_url: j.web_url,
    };
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

  get_job_artifact_file: async (args) => {
    const parsed = GetJobArtifactFileSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    // GitLab endpoint: /projects/:id/jobs/:job_id/artifacts/*artifact_path
    const cleanPath = parsed.artifact_path.replace(/^\/+/, "");
    const rawContent = await gitlabRequest(
      `/projects/${pId}/jobs/${parsed.job_id}/artifacts/${cleanPath}`,
      {},
      "text"
    );

    if (parsed.max_length > 0 && rawContent.length > parsed.max_length) {
      return (
        rawContent.slice(0, parsed.max_length) +
        `\n\n[... Truncated at ${parsed.max_length} characters. Total size: ${rawContent.length} characters ...]`
      );
    }
    return rawContent;
  },

  get_pipeline_test_report: async (args) => {
    const parsed = GetPipelineTestReportSchema.parse(args);
    const pId = formatProjectId(parsed.project_id);
    return await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}/test_report`);
  },
};
