import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { gitlabRequest, formatProjectId } from "../client.js";
import { summarizePipeline, summarizeJob, extractSmartJobLog } from "../helpers.js";
import { ProjectParamsSchema } from "../schemas.js";

// Schemas
export const ListPipelinesSchema = ProjectParamsSchema.extend({
  ref: z.string().optional().describe("Filter pipelines by branch or tag name"),
  status: z
    .enum(["running", "pending", "success", "failed", "canceled", "skipped", "manual"])
    .optional()
    .describe("Filter pipelines by execution status"),
  sha: z.string().optional().describe("Filter pipelines by commit SHA"),
  username: z.string().optional().describe("Filter pipelines by the username of the user who triggered it directly pushed upstream"),
  order_by: z.enum(["id", "status", "ref", "updated_at"]).optional().default("id").describe("Order pipelines by id, status, ref, or updated_at"),
  sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction (default: desc)"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(10).describe("Number of pipelines per page (default: 10, max: 100)"),
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
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(10).describe("Number of jobs per page (default: 10, max: 100)"),
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
  strip_ansi: z
    .boolean()
    .optional()
    .default(true)
    .describe("Strip ANSI terminal color and control escape sequences (default: true)"),
  smart_failure: z
    .boolean()
    .optional()
    .default(true)
    .describe("Automatically detect and extract the failure stack trace / error block with context lines instead of only blind tailing (default: true)"),
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
  {
    name: "list_pipelines",
    title: "List CI/CD Pipelines",
    description: "List CI/CD pipelines filtered by branch, tag, status ('running', 'success', 'failed', 'canceled'), or commit SHA with token-efficient status summaries. Use to check deployment status, monitor test suite health, or verify build triggers. Do NOT use to inspect specific job logs; use 'get_job_trace' instead.",
    inputSchema: zodToJsonSchema(ListPipelinesSchema),
  },
  {
    name: "get_pipeline",
    title: "Get Pipeline Details",
    description: "Retrieve comprehensive details for a specific CI/CD pipeline by numeric ID, including execution status, duration, queued duration, and associated commit info. Use to evaluate pipeline health or check if all stages completed. Do NOT use to inspect individual job failures; use 'list_pipeline_jobs' or 'get_job_trace' instead.",
    inputSchema: zodToJsonSchema(GetPipelineSchema),
  },
  {
    name: "create_pipeline",
    title: "Trigger CI/CD Pipeline",
    description: "Manually trigger and run a new CI/CD pipeline execution for a specific branch or tag with optional custom pipeline variables. Use to kick off tests, builds, or deployments on demand. Side effect: initiates immediate job execution on GitLab runners. Do NOT use to inspect running jobs; use 'list_pipeline_jobs' instead.",
    inputSchema: zodToJsonSchema(CreatePipelineSchema),
    mutating: true,
  },
  {
    name: "list_pipeline_jobs",
    title: "List Pipeline Jobs",
    description: "List all execution jobs (build, test, lint, deploy) and their current status within a specific pipeline. Use to identify which specific stage or job failed in a pipeline run. Do NOT use to download job output logs; use 'get_job_trace' instead once the failed job ID is known.",
    inputSchema: zodToJsonSchema(ListPipelineJobsSchema),
  },
  {
    name: "get_job",
    title: "Get Job Details",
    description: "Retrieve comprehensive details about a specific CI/CD job, including duration, runner tags, failure reasons, and available artifact archives. Use when diagnosing why a runner job stalled or failed. Do NOT use to stream terminal logs; use 'get_job_trace' instead.",
    inputSchema: zodToJsonSchema(GetJobSchema),
  },
  {
    name: "get_job_trace",
    title: "Get Job Terminal Trace Log",
    description: "Retrieve the raw terminal console output log for a specific CI/CD job with configurable tailing (tail_lines). Use to inspect compilation errors, stack traces, and test assertion failures without overflowing context. Do NOT use to inspect structured JUnit test suites; use 'get_pipeline_test_report' instead.",
    inputSchema: zodToJsonSchema(GetJobTraceSchema),
  },
  {
    name: "get_job_artifact_file",
    title: "Get Job Artifact File",
    description: "Download and read the text content of a specific file from a completed job's build artifacts zip archive (e.g. coverage reports, build manifests, test outputs). Use to inspect generated artifacts without downloading the full archive. Do NOT use for repository files; use 'get_file_contents' instead.",
    inputSchema: zodToJsonSchema(GetJobArtifactFileSchema),
  },
  {
    name: "get_pipeline_test_report",
    title: "Get Pipeline Test Report",
    description: "Retrieve the structured JUnit test summary report for a pipeline run, including total test counts, passed/failed test cases, execution duration, and failure stack traces. Use to diagnose automated test failures across test suites. Do NOT use for raw console output; use 'get_job_trace' instead.",
    inputSchema: zodToJsonSchema(GetPipelineTestReportSchema),
  },
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
    if (parsed.username) q.append("username", parsed.username);
    if (parsed.order_by) q.append("order_by", parsed.order_by);
    if (parsed.sort) q.append("sort", parsed.sort);
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
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.scope) q.append("scope", parsed.scope);
    const res = await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}/jobs?${q.toString()}`);
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
    if (parsed.tail_lines === 0 && !parsed.strip_ansi && !parsed.smart_failure) {
      return rawLog;
    }
    return extractSmartJobLog(rawLog, {
      tail_lines: parsed.tail_lines,
      strip_ansi: parsed.strip_ansi,
      smart_failure: parsed.smart_failure,
    });
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
