#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const server = new Server(
  {
    name: "gitlab-mcp-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";

if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}

function formatProjectId(projectId) {
  if (typeof projectId === "number") {
    return projectId.toString();
  }
  const str = projectId.toString().trim();
  return str.includes("/") ? encodeURIComponent(str) : str;
}

function formatLabels(labels) {
  if (!labels) return undefined;
  if (Array.isArray(labels)) {
    return labels.map((l) => l.trim()).filter(Boolean).join(",");
  }
  return labels
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(",");
}

async function gitlabRequest(endpoint, options = {}, responseType = "json") {
  const url = endpoint.startsWith("http") ? endpoint : `${GITLAB_API_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
    ...(options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`GitLab API error (${response.status} ${response.statusText}): ${errorDetail}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  if (responseType === "text") {
    return await response.text();
  }

  const data = await response.json();
  const total = response.headers.get("X-Total");
  const totalPages = response.headers.get("X-Total-Pages");
  const page = response.headers.get("X-Page");
  const perPage = response.headers.get("X-Per-Page");

  if (Array.isArray(data) && total !== null) {
    return {
      pagination: {
        total: parseInt(total, 10),
        total_pages: parseInt(totalPages || "1", 10),
        page: parseInt(page || "1", 10),
        per_page: parseInt(perPage || "20", 10),
      },
      items: data,
    };
  }

  return data;
}

async function resolveMilestoneId(projectId, milestoneIdentifier) {
  if (typeof milestoneIdentifier === "number") {
    return milestoneIdentifier;
  }
  const pId = formatProjectId(projectId);
  const res = await gitlabRequest(`/projects/${pId}/milestones?search=${encodeURIComponent(milestoneIdentifier)}`);
  const list = res.items || res;
  const match = list.find((m) => m.title.toLowerCase() === milestoneIdentifier.toLowerCase()) || list[0];
  if (!match) {
    throw new Error(`Milestone \x27${milestoneIdentifier}\x27 not found in project ${projectId}`);
  }
  return match.id;
}

function summarizeIssue(issue) {
  return {
    iid: issue.iid,
    id: issue.id,
    title: issue.title,
    state: issue.state,
    milestone: issue.milestone ? { id: issue.milestone.id, iid: issue.milestone.iid, title: issue.milestone.title } : null,
    labels: issue.labels || [],
    assignees: (issue.assignees || []).map((a) => a.username),
    author: issue.author ? issue.author.username : null,
    due_date: issue.due_date || null,
    web_url: issue.web_url,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    description: issue.description
      ? issue.description.length > 250
        ? issue.description.slice(0, 250) + "..."
        : issue.description
      : null,
  };
}

function summarizeMilestone(m) {
  return {
    id: m.id,
    iid: m.iid,
    title: m.title,
    state: m.state,
    due_date: m.due_date || null,
    start_date: m.start_date || null,
    expired: m.expired,
    web_url: m.web_url,
    description: m.description,
  };
}

function summarizePipeline(p) {
  return {
    id: p.id,
    iid: p.iid,
    status: p.status,
    ref: p.ref,
    sha: p.sha ? p.sha.slice(0, 8) : null,
    source: p.source,
    created_at: p.created_at,
    web_url: p.web_url,
  };
}

function summarizeJob(j) {
  return {
    id: j.id,
    name: j.name,
    stage: j.stage,
    status: j.status,
    duration: j.duration,
    created_at: j.created_at,
    web_url: j.web_url,
  };
}

function summarizeMR(mr) {
  return {
    iid: mr.iid,
    id: mr.id,
    title: mr.title,
    state: mr.state,
    draft: mr.draft || mr.work_in_progress || false,
    source_branch: mr.source_branch,
    target_branch: mr.target_branch,
    merge_status: mr.merge_status,
    detailed_merge_status: mr.detailed_merge_status,
    milestone: mr.milestone ? mr.milestone.title : null,
    labels: mr.labels || [],
    author: mr.author ? mr.author.username : null,
    web_url: mr.web_url,
  };
}

// ================= SCHEMAS =================
const ProjectParamsSchema = z.object({
  project_id: z
    .union([z.string(), z.number()])
    .describe("Project numeric ID (e.g. 31) or namespace path (e.g. 'group/project-name'). URL-encoding is handled automatically."),
});

// Repository & Files
const SearchRepositoriesSchema = z.object({
  search: z.string().describe("Search query to filter project names/descriptions (e.g. 'my-service')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of results per page (default: 20, max: 100)"),
});

const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository / Project name (e.g. \x27my-new-service\x27)"),
  description: z.string().optional().describe("Short project description"),
  visibility: z.enum(["private", "internal", "public"]).optional().default("internal").describe("Visibility level"),
  initialize_with_readme: z.boolean().optional().default(true).describe("Initialize the new project with a README.md file"),
});

const GetFileContentsSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("Path to the file or directory in repo (e.g. \x27pom.xml\x27 or \x27docs/README.md\x27)"),
  ref: z.string().optional().describe("Branch name, tag, or commit SHA (default: default branch / HEAD)"),
});

const CreateOrUpdateFileSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("File path to create or update (e.g. \x27docs/roadmap.md\x27)"),
  content: z.string().describe("Full content of the file to write"),
  commit_message: z.string().describe("Clear Git commit message describing the change"),
  branch: z.string().describe("Branch to commit to (e.g. \x27main\x27 or \x27feature/auth\x27)"),
  previous_path: z.string().optional().describe("If renaming or moving a file, specify the old path"),
});

const PushFilesSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Target branch to push to"),
  commit_message: z.string().describe("Git commit message for the batch commit"),
  files: z
    .array(
      z.object({
        file_path: z.string().describe("Destination path for the file"),
        content: z.string().describe("Full file content"),
      })
    )
    .describe("Array of files to create/update in this single commit"),
});

const ForkRepositorySchema = ProjectParamsSchema.extend({
  namespace: z.string().optional().describe("Target namespace path to fork into (defaults to your personal namespace)"),
});

const CreateBranchSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Name of the new branch to create (e.g. \x27feature/upgrade-java\x27)"),
  ref: z.string().optional().default("HEAD").describe("Source branch, tag, or commit SHA to branch from (default: HEAD)"),
});

// Issues
const CreateIssueSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Issue title summarizing the task, bug, or story"),
  description: z.string().optional().describe("Detailed markdown description, requirements, or checklist"),
  milestone_id: z.number().optional().describe("Numeric milestone ID to associate with"),
  milestone_title: z.string().optional().describe("Milestone title (e.g. \x27Phase 2: Security Hardening\x27). Auto-resolved if provided."),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Labels as an array ([\x27backend\x27, \x27p1\x27]) or comma-separated string (\x27backend, p1\x27)"),
  assignee_ids: z.array(z.number()).optional().describe("Array of numeric user IDs to assign"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format (e.g. \x272026-11-30\x27)"),
  confidential: z.boolean().optional().default(false).describe("Mark issue as confidential"),
});

const ListIssuesSchema = ProjectParamsSchema.extend({
  state: z.enum(["opened", "closed", "all"]).optional().default("all").describe("Filter by issue state (default: all)"),
  milestone: z.string().optional().describe("Filter by milestone title, or \x27None\x27 for issues without milestones, or \x27Any\x27"),
  milestone_id: z.number().optional().describe("Filter by numeric milestone ID"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Filter by label names (comma-separated or array)"),
  search: z.string().optional().describe("Search query matching issue title or description"),
  assignee_id: z.number().optional().describe("Filter by assignee user ID"),
  author_id: z.number().optional().describe("Filter by author user ID"),
  order_by: z.enum(["created_at", "updated_at", "priority", "due_date"]).optional().default("created_at").describe("Field to sort by"),
  sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction"),
  page: z.number().optional().default(1).describe("Page number for pagination"),
  per_page: z.number().optional().default(20).describe("Items per page (default: 20, max: 100)"),
  verbose: z.boolean().optional().default(false).describe("If true, returns full raw GitLab objects instead of clean summaries"),
});

const GetIssueSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number as seen in UI (e.g. 14 for #14, NOT the global database id)"),
});

const UpdateIssueSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
  title: z.string().optional().describe("Updated issue title"),
  description: z.string().optional().describe("Updated issue description markdown"),
  state_event: z.enum(["close", "reopen"]).optional().describe("Change issue status to closed or reopened"),
  milestone_id: z.number().nullable().optional().describe("Milestone ID to assign (pass 0 to unassign)"),
  milestone_title: z.string().optional().describe("Milestone title to assign (auto-resolved to ID)"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Set labels (replaces all existing labels)"),
  add_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Add labels without removing existing ones"),
  remove_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Remove specific labels from the issue"),
  assignee_ids: z.array(z.number()).optional().describe("Array of user IDs to assign (replaces existing assignees)"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
});

// Issue Notes & Discussions
const ListIssueNotesSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
  sort: z.enum(["asc", "desc"]).optional().default("asc").describe("Sort direction for comments"),
  order_by: z.enum(["created_at", "updated_at"]).optional().default("created_at"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(50),
});

const CreateIssueNoteSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
  body: z.string().describe("Markdown content for the note / comment (progress update, test verification, etc.)"),
});

// Issue Links / Dependencies
const ListIssueLinksSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("The project-scoped issue number (e.g. 14 for #14)"),
});

const CreateIssueLinkSchema = ProjectParamsSchema.extend({
  issue_iid: z.number().describe("Source issue number (e.g. 14)"),
  target_issue_iid: z.number().describe("Target issue number to link to (e.g. 15)"),
  target_project_id: z.union([z.string(), z.number()]).optional().describe("Target project ID (defaults to same project)"),
  link_type: z.enum(["relates_to", "blocks", "is_blocked_by"]).optional().default("relates_to").describe("Relationship type"),
});

// Milestones
const ListMilestonesSchema = ProjectParamsSchema.extend({
  state: z.enum(["active", "closed", "all"]).optional().default("active").describe("Filter by state: active, closed, or all (default: active)"),
  search: z.string().optional().describe("Search query to filter milestones by title"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

const GetMilestoneSchema = ProjectParamsSchema.extend({
  milestone_id: z.number().describe("The milestone numeric database ID"),
});

const CreateMilestoneSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Milestone title (e.g. \x27Phase 3: Code Modernization\x27)"),
  description: z.string().optional().describe("Milestone scope and objectives description"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format (e.g. \x272026-12-31\x27)"),
  start_date: z.string().optional().describe("Start date in YYYY-MM-DD format (e.g. \x272026-10-15\x27)"),
});

const UpdateMilestoneSchema = ProjectParamsSchema.extend({
  milestone_id: z.number().describe("The milestone numeric ID to update"),
  title: z.string().optional().describe("Updated milestone title"),
  description: z.string().optional().describe("Updated description"),
  due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
  start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
  state_event: z.enum(["close", "activate"]).optional().describe("Close or re-activate the milestone"),
});

// Labels
const ListLabelsSchema = ProjectParamsSchema.extend({
  search: z.string().optional().describe("Search query to filter labels"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(50),
});

const CreateLabelSchema = ProjectParamsSchema.extend({
  name: z.string().describe("Name of the label (e.g. \x27qa-verified\x27 or \x27high-priority\x27)"),
  color: z.string().describe("Color hex code starting with # (e.g. \x27#4287f5\x27 or \x27#e11d48\x27)"),
  description: z.string().optional().describe("Explanation of what this label represents"),
});

// CI/CD Pipelines & Test Observability
const ListPipelinesSchema = ProjectParamsSchema.extend({
  ref: z.string().optional().describe("Filter pipelines by branch name or git tag (e.g. \x27main\x27)"),
  status: z
    .enum(["running", "pending", "success", "failed", "canceled", "skipped", "manual"])
    .optional()
    .describe("Filter by pipeline status"),
  sha: z.string().optional().describe("Filter by commit SHA"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

const GetPipelineSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("Numeric ID of the pipeline"),
});

const CreatePipelineSchema = ProjectParamsSchema.extend({
  ref: z.string().describe("Branch name or git tag to trigger the pipeline for (e.g. \x27main\x27)"),
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

const ListPipelineJobsSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("Numeric ID of the pipeline"),
  scope: z
    .enum(["created", "pending", "running", "failed", "success", "canceled", "skipped", "manual"])
    .optional()
    .describe("Filter jobs by execution status"),
});

const GetJobTraceSchema = ProjectParamsSchema.extend({
  job_id: z.number().describe("Numeric ID of the build or test job"),
  tail_lines: z
    .number()
    .optional()
    .default(250)
    .describe("Number of trailing lines from log to return (prevents overflowing context, default: 250, 0 for all)"),
});

const GetPipelineTestReportSchema = ProjectParamsSchema.extend({
  pipeline_id: z.number().describe("Numeric ID of the pipeline to fetch test results for"),
});

// Releases & Tags
const ListReleasesSchema = ProjectParamsSchema.extend({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

const GetReleaseSchema = ProjectParamsSchema.extend({
  tag_name: z.string().describe("Tag name associated with the release (e.g. \x27v1.0.0\x27)"),
});

const CreateReleaseSchema = ProjectParamsSchema.extend({
  name: z.string().describe("Release title (e.g. 'Release 2.0.0 - Service Modernization')"),
  tag_name: z.string().describe("Git tag name (e.g. \x27v2.0.0\x27). If the tag does not exist, ref is required to create it."),
  ref: z.string().optional().describe("Branch name or commit SHA to create the tag from if it doesn\x27t exist yet"),
  description: z.string().describe("Markdown release notes, changelog, and migration guidance"),
  milestones: z.array(z.string()).optional().describe("Array of milestone titles to associate with this release"),
});

const ListTagsSchema = ProjectParamsSchema.extend({
  search: z.string().optional().describe("Search query to filter tag names"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

const CreateTagSchema = ProjectParamsSchema.extend({
  tag_name: z.string().describe("Name of the tag to create (e.g. \x27v2.0.0\x27)"),
  ref: z.string().describe("Branch name or commit SHA that the tag points to (e.g. \x27main\x27)"),
  message: z.string().optional().describe("Annotated tag message"),
});

// Merge Requests
const ListMergeRequestsSchema = ProjectParamsSchema.extend({
  state: z.enum(["opened", "closed", "locked", "merged", "all"]).optional().default("opened").describe("Filter MRs by state"),
  source_branch: z.string().optional().describe("Filter by source branch"),
  target_branch: z.string().optional().describe("Filter by target branch"),
  milestone: z.string().optional().describe("Filter by milestone title"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Filter by labels"),
  search: z.string().optional().describe("Search query for title and description"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

const GetMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("The project-scoped merge request number (e.g. 5 for !5)"),
});

const CreateMergeRequestSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Merge request title"),
  description: z.string().optional().describe("Detailed description of changes and test verification"),
  source_branch: z.string().describe("Branch containing your commits"),
  target_branch: z.string().describe("Branch to merge changes into (e.g. \x27main\x27)"),
  draft: z.boolean().optional().default(false).describe("Create as draft / WIP merge request"),
  remove_source_branch: z.boolean().optional().default(true).describe("Delete source branch upon merge"),
  squash: z.boolean().optional().default(false).describe("Squash commits upon merge"),
  milestone_title: z.string().optional().describe("Milestone title to associate with"),
  milestone_id: z.number().optional().describe("Milestone ID to associate with"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Labels to apply"),
});

const UpdateMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID (e.g. 5 for !5)"),
  title: z.string().optional().describe("Updated MR title"),
  description: z.string().optional().describe("Updated MR description"),
  state_event: z.enum(["close", "reopen"]).optional().describe("Close or reopen the merge request"),
  target_branch: z.string().optional().describe("Change destination target branch"),
  milestone_id: z.number().nullable().optional().describe("Milestone ID (0 to unassign)"),
  milestone_title: z.string().optional().describe("Milestone title to associate"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Set labels (replaces existing)"),
  add_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Add labels"),
  remove_labels: z.union([z.string(), z.array(z.string())]).optional().describe("Remove labels"),
});

const GetMergeRequestChangesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID (e.g. 5 for !5) to get diffs for"),
});

const AcceptMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID to merge into target branch"),
  commit_message: z.string().optional().describe("Custom commit message for the merge commit"),
  squash: z.boolean().optional().describe("Squash commits during merge"),
  should_remove_source_branch: z.boolean().optional().describe("Delete source branch after merge"),
});

const CreateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("Merge request IID"),
  body: z.string().describe("Review comment or sign-off message in markdown"),
});

// ================= TOOLS REGISTRATION =================
const TOOLS = [
  // Repositories & Files
  { name: "search_repositories", description: "Search for GitLab projects and repositories", inputSchema: zodToJsonSchema(SearchRepositoriesSchema) },
  { name: "create_repository", description: "Create a new GitLab project/repository", inputSchema: zodToJsonSchema(CreateRepositorySchema) },
  { name: "get_file_contents", description: "Read file or directory content from a project repository", inputSchema: zodToJsonSchema(GetFileContentsSchema) },
  { name: "create_or_update_file", description: "Create or update a single file in a GitLab repository", inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema) },
  { name: "push_files", description: "Commit multiple files in a single atomic commit", inputSchema: zodToJsonSchema(PushFilesSchema) },
  { name: "fork_repository", description: "Fork a project into a user or group namespace", inputSchema: zodToJsonSchema(ForkRepositorySchema) },
  { name: "create_branch", description: "Create a new branch from a commit, tag, or branch", inputSchema: zodToJsonSchema(CreateBranchSchema) },

  // Issues
  { name: "list_issues", description: "List and filter issues by state, milestone, label, assignee, or search with clean summaries", inputSchema: zodToJsonSchema(ListIssuesSchema) },
  { name: "get_issue", description: "Get comprehensive details for a specific issue by its IID (#<iid>)", inputSchema: zodToJsonSchema(GetIssueSchema) },
  { name: "create_issue", description: "Create a new issue with milestone (by title or ID), labels, assignees, and due date", inputSchema: zodToJsonSchema(CreateIssueSchema) },
  { name: "update_issue", description: "Update issue title, description, state (close/reopen), milestone, labels, or assignees", inputSchema: zodToJsonSchema(UpdateIssueSchema) },

  // Issue Notes & Links
  { name: "list_issue_notes", description: "List discussions, comments, and activity log on an issue", inputSchema: zodToJsonSchema(ListIssueNotesSchema) },
  { name: "create_issue_note", description: "Post a comment or progress/verification note to an issue", inputSchema: zodToJsonSchema(CreateIssueNoteSchema) },
  { name: "list_issue_links", description: "List related, blocking, or blocked-by issue dependencies", inputSchema: zodToJsonSchema(ListIssueLinksSchema) },
  { name: "create_issue_link", description: "Create an issue dependency link (relates_to, blocks, is_blocked_by)", inputSchema: zodToJsonSchema(CreateIssueLinkSchema) },

  // Milestones
  { name: "list_milestones", description: "List project milestones (active, closed, all) with start and due dates", inputSchema: zodToJsonSchema(ListMilestonesSchema) },
  { name: "get_milestone", description: "Get details for a specific milestone by ID", inputSchema: zodToJsonSchema(GetMilestoneSchema) },
  { name: "create_milestone", description: "Create a project milestone with due dates and roadmap scope", inputSchema: zodToJsonSchema(CreateMilestoneSchema) },
  { name: "update_milestone", description: "Update milestone dates, title, description, or state (close/activate)", inputSchema: zodToJsonSchema(UpdateMilestoneSchema) },

  // Labels
  { name: "list_labels", description: "List labels available in the project", inputSchema: zodToJsonSchema(ListLabelsSchema) },
  { name: "create_label", description: "Create a project label with color and description", inputSchema: zodToJsonSchema(CreateLabelSchema) },

  // CI/CD Pipelines & Test Observability
  { name: "list_pipelines", description: "List CI/CD pipelines filtered by branch, tag, status, or commit SHA", inputSchema: zodToJsonSchema(ListPipelinesSchema) },
  { name: "get_pipeline", description: "Get detailed status, duration, and commit info for a pipeline", inputSchema: zodToJsonSchema(GetPipelineSchema) },
  { name: "create_pipeline", description: "Trigger a new CI/CD pipeline execution for a branch or tag", inputSchema: zodToJsonSchema(CreatePipelineSchema) },
  { name: "list_pipeline_jobs", description: "List all jobs (build, test, lint, deploy) and their status in a pipeline", inputSchema: zodToJsonSchema(ListPipelineJobsSchema) },
  { name: "get_job_trace", description: "Get the terminal output log of a build/test job (supports tailing to diagnose test failures)", inputSchema: zodToJsonSchema(GetJobTraceSchema) },
  { name: "get_pipeline_test_report", description: "Get JUnit test report summary (total, passed, failed test suites and error details)", inputSchema: zodToJsonSchema(GetPipelineTestReportSchema) },

  // Releases & Tags
  { name: "list_releases", description: "List published project releases and version changelogs", inputSchema: zodToJsonSchema(ListReleasesSchema) },
  { name: "get_release", description: "Get release details by tag name", inputSchema: zodToJsonSchema(GetReleaseSchema) },
  { name: "create_release", description: "Publish a formal release with tag, description/changelog, and associated milestones", inputSchema: zodToJsonSchema(CreateReleaseSchema) },
  { name: "list_tags", description: "List git tags in the repository", inputSchema: zodToJsonSchema(ListTagsSchema) },
  { name: "create_tag", description: "Create a git tag pointing to a branch or commit", inputSchema: zodToJsonSchema(CreateTagSchema) },

  // Merge Requests
  { name: "list_merge_requests", description: "List merge requests filtered by state, branches, milestone, or labels", inputSchema: zodToJsonSchema(ListMergeRequestsSchema) },
  { name: "get_merge_request", description: "Get details and status of a merge request by IID (!<iid>)", inputSchema: zodToJsonSchema(GetMergeRequestSchema) },
  { name: "create_merge_request", description: "Create a merge request between branches with description and options", inputSchema: zodToJsonSchema(CreateMergeRequestSchema) },
  { name: "update_merge_request", description: "Update MR title, description, state (close/reopen), target branch, milestone, or labels", inputSchema: zodToJsonSchema(UpdateMergeRequestSchema) },
  { name: "get_merge_request_changes", description: "Inspect code diffs and modified files in a merge request", inputSchema: zodToJsonSchema(GetMergeRequestChangesSchema) },
  { name: "accept_merge_request", description: "Merge an approved merge request into the target branch", inputSchema: zodToJsonSchema(AcceptMergeRequestSchema) },
  { name: "create_merge_request_note", description: "Post a review comment or note on a merge request", inputSchema: zodToJsonSchema(CreateMergeRequestNoteSchema) },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const args = request.params.arguments || {};
    const name = request.params.name;

    switch (name) {
      // 1. search_repositories
      case "search_repositories": {
        const parsed = SearchRepositoriesSchema.parse(args);
        const q = new URLSearchParams({
          search: parsed.search,
          page: parsed.page.toString(),
          per_page: parsed.per_page.toString(),
        });
        const res = await gitlabRequest(`/projects?${q.toString()}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 2. create_repository
      case "create_repository": {
        const parsed = CreateRepositorySchema.parse(args);
        const res = await gitlabRequest("/projects", {
          method: "POST",
          body: JSON.stringify(parsed),
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 3. get_file_contents
      case "get_file_contents": {
        const parsed = GetFileContentsSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const encodedPath = encodeURIComponent(parsed.file_path);
        const ref = parsed.ref ? `?ref=${encodeURIComponent(parsed.ref)}` : "?ref=HEAD";
        const res = await gitlabRequest(`/projects/${pId}/repository/files/${encodedPath}${ref}`);
        if (res && !Array.isArray(res) && res.content) {
          res.content = Buffer.from(res.content, "base64").toString("utf8");
        }
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 4. create_or_update_file
      case "create_or_update_file": {
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
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 5. push_files
      case "push_files": {
        const parsed = PushFilesSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/repository/commits`, {
          method: "POST",
          body: JSON.stringify({
            branch: parsed.branch,
            commit_message: parsed.commit_message,
            actions: parsed.files.map((f) => ({
              action: "create",
              file_path: f.file_path,
              content: f.content,
            })),
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 6. fork_repository
      case "fork_repository": {
        const parsed = ForkRepositorySchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = parsed.namespace ? `?namespace=${encodeURIComponent(parsed.namespace)}` : "";
        const res = await gitlabRequest(`/projects/${pId}/fork${q}`, { method: "POST" });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 7. create_branch
      case "create_branch": {
        const parsed = CreateBranchSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/repository/branches`, {
          method: "POST",
          body: JSON.stringify({
            branch: parsed.branch,
            ref: parsed.ref,
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 8. list_issues
      case "list_issues": {
        const parsed = ListIssuesSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);

        const q = new URLSearchParams();
        if (parsed.state) q.append("state", parsed.state);
        if (parsed.milestone) q.append("milestone", parsed.milestone);
        if (parsed.milestone_id !== undefined) q.append("milestone_id", parsed.milestone_id.toString());
        if (parsed.labels) q.append("labels", formatLabels(parsed.labels));
        if (parsed.search) q.append("search", parsed.search);
        if (parsed.assignee_id !== undefined) q.append("assignee_id", parsed.assignee_id.toString());
        if (parsed.author_id !== undefined) q.append("author_id", parsed.author_id.toString());
        if (parsed.order_by) q.append("order_by", parsed.order_by);
        if (parsed.sort) q.append("sort", parsed.sort);
        q.append("page", parsed.page.toString());
        q.append("per_page", parsed.per_page.toString());

        const res = await gitlabRequest(`/projects/${pId}/issues?${q.toString()}`);
        if (!parsed.verbose) {
          const items = (res.items || res).map(summarizeIssue);
          const out = res.pagination ? { pagination: res.pagination, issues: items } : items;
          return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 9. get_issue
      case "get_issue": {
        const parsed = GetIssueSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 10. create_issue
      case "create_issue": {
        const parsed = CreateIssueSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        let mId = parsed.milestone_id;
        if (!mId && parsed.milestone_title) {
          mId = await resolveMilestoneId(pId, parsed.milestone_title);
        }

        const body = {
          title: parsed.title,
          ...(parsed.description ? { description: parsed.description } : {}),
          ...(mId ? { milestone_id: mId } : {}),
          ...(parsed.labels ? { labels: formatLabels(parsed.labels) } : {}),
          ...(parsed.assignee_ids ? { assignee_ids: parsed.assignee_ids } : {}),
          ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
          confidential: parsed.confidential,
        };

        const res = await gitlabRequest(`/projects/${pId}/issues`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizeIssue(res), null, 2) }] };
      }

      // 11. update_issue
      case "update_issue": {
        const parsed = UpdateIssueSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        let mId = parsed.milestone_id;
        if (mId === undefined && parsed.milestone_title) {
          mId = await resolveMilestoneId(pId, parsed.milestone_title);
        }

        const body = {
          ...(parsed.title ? { title: parsed.title } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          ...(parsed.state_event ? { state_event: parsed.state_event } : {}),
          ...(mId !== undefined ? { milestone_id: mId } : {}),
          ...(parsed.labels !== undefined ? { labels: formatLabels(parsed.labels) } : {}),
          ...(parsed.add_labels ? { add_labels: formatLabels(parsed.add_labels) } : {}),
          ...(parsed.remove_labels ? { remove_labels: formatLabels(parsed.remove_labels) } : {}),
          ...(parsed.assignee_ids ? { assignee_ids: parsed.assignee_ids } : {}),
          ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
        };

        const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizeIssue(res), null, 2) }] };
      }

      // 12. list_issue_notes
      case "list_issue_notes": {
        const parsed = ListIssueNotesSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = new URLSearchParams({
          sort: parsed.sort,
          order_by: parsed.order_by,
          page: parsed.page.toString(),
          per_page: parsed.per_page.toString(),
        });
        const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/notes?${q.toString()}`);
        const notes = (res.items || res).map((n) => ({
          id: n.id,
          body: n.body,
          author: n.author ? n.author.username : null,
          created_at: n.created_at,
          system: n.system,
        }));
        return { content: [{ type: "text", text: JSON.stringify(notes, null, 2) }] };
      }

      // 13. create_issue_note
      case "create_issue_note": {
        const parsed = CreateIssueNoteSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/notes`, {
          method: "POST",
          body: JSON.stringify({ body: parsed.body }),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { id: res.id, author: res.author?.username, body: res.body, created_at: res.created_at },
                null,
                2
              ),
            },
          ],
        };
      }

      // 14. list_issue_links
      case "list_issue_links": {
        const parsed = ListIssueLinksSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/links`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 15. create_issue_link
      case "create_issue_link": {
        const parsed = CreateIssueLinkSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const targetPId = parsed.target_project_id ? formatProjectId(parsed.target_project_id) : pId;
        const res = await gitlabRequest(`/projects/${pId}/issues/${parsed.issue_iid}/links`, {
          method: "POST",
          body: JSON.stringify({
            target_project_id: targetPId,
            target_issue_iid: parsed.target_issue_iid,
            link_type: parsed.link_type,
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 16. list_milestones
      case "list_milestones": {
        const parsed = ListMilestonesSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = new URLSearchParams({
          state: parsed.state,
          page: parsed.page.toString(),
          per_page: parsed.per_page.toString(),
        });
        if (parsed.search) q.append("search", parsed.search);
        const res = await gitlabRequest(`/projects/${pId}/milestones?${q.toString()}`);
        const items = (res.items || res).map(summarizeMilestone);
        return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
      }

      // 17. get_milestone
      case "get_milestone": {
        const parsed = GetMilestoneSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/milestones/${parsed.milestone_id}`);
        return { content: [{ type: "text", text: JSON.stringify(summarizeMilestone(res), null, 2) }] };
      }

      // 18. create_milestone
      case "create_milestone": {
        const parsed = CreateMilestoneSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const body = {
          title: parsed.title,
          ...(parsed.description ? { description: parsed.description } : {}),
          ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
          ...(parsed.start_date ? { start_date: parsed.start_date } : {}),
        };
        const res = await gitlabRequest(`/projects/${pId}/milestones`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizeMilestone(res), null, 2) }] };
      }

      // 19. update_milestone
      case "update_milestone": {
        const parsed = UpdateMilestoneSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const body = {
          ...(parsed.title ? { title: parsed.title } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          ...(parsed.due_date ? { due_date: parsed.due_date } : {}),
          ...(parsed.start_date ? { start_date: parsed.start_date } : {}),
          ...(parsed.state_event ? { state_event: parsed.state_event } : {}),
        };
        const res = await gitlabRequest(`/projects/${pId}/milestones/${parsed.milestone_id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizeMilestone(res), null, 2) }] };
      }

      // 20. list_labels
      case "list_labels": {
        const parsed = ListLabelsSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = new URLSearchParams({
          page: parsed.page.toString(),
          per_page: parsed.per_page.toString(),
        });
        if (parsed.search) q.append("search", parsed.search);
        const res = await gitlabRequest(`/projects/${pId}/labels?${q.toString()}`);
        return { content: [{ type: "text", text: JSON.stringify(res.items || res, null, 2) }] };
      }

      // 21. create_label
      case "create_label": {
        const parsed = CreateLabelSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/labels`, {
          method: "POST",
          body: JSON.stringify(parsed),
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 22. list_pipelines
      case "list_pipelines": {
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
        const out = res.pagination ? { pagination: res.pagination, pipelines: items } : items;
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      // 23. get_pipeline
      case "get_pipeline": {
        const parsed = GetPipelineSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 24. create_pipeline
      case "create_pipeline": {
        const parsed = CreatePipelineSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/pipeline`, {
          method: "POST",
          body: JSON.stringify({
            ref: parsed.ref,
            ...(parsed.variables ? { variables: parsed.variables } : {}),
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizePipeline(res), null, 2) }] };
      }

      // 25. list_pipeline_jobs
      case "list_pipeline_jobs": {
        const parsed = ListPipelineJobsSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = parsed.scope ? `?scope=${encodeURIComponent(parsed.scope)}` : "";
        const res = await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}/jobs${q}`);
        const jobs = (res.items || res).map(summarizeJob);
        return { content: [{ type: "text", text: JSON.stringify(jobs, null, 2) }] };
      }

      // 26. get_job_trace
      case "get_job_trace": {
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
        return { content: [{ type: "text", text: output }] };
      }

      // 27. get_pipeline_test_report
      case "get_pipeline_test_report": {
        const parsed = GetPipelineTestReportSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/pipelines/${parsed.pipeline_id}/test_report`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 28. list_releases
      case "list_releases": {
        const parsed = ListReleasesSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = new URLSearchParams({
          page: parsed.page.toString(),
          per_page: parsed.per_page.toString(),
        });
        const res = await gitlabRequest(`/projects/${pId}/releases?${q.toString()}`);
        return { content: [{ type: "text", text: JSON.stringify(res.items || res, null, 2) }] };
      }

      // 29. get_release
      case "get_release": {
        const parsed = GetReleaseSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/releases/${encodeURIComponent(parsed.tag_name)}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 30. create_release
      case "create_release": {
        const parsed = CreateReleaseSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const body = {
          name: parsed.name,
          tag_name: parsed.tag_name,
          description: parsed.description,
          ...(parsed.ref ? { ref: parsed.ref } : {}),
          ...(parsed.milestones ? { milestones: parsed.milestones } : {}),
        };
        const res = await gitlabRequest(`/projects/${pId}/releases`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 31. list_tags
      case "list_tags": {
        const parsed = ListTagsSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = new URLSearchParams({
          page: parsed.page.toString(),
          per_page: parsed.per_page.toString(),
        });
        if (parsed.search) q.append("search", parsed.search);
        const res = await gitlabRequest(`/projects/${pId}/repository/tags?${q.toString()}`);
        return { content: [{ type: "text", text: JSON.stringify(res.items || res, null, 2) }] };
      }

      // 32. create_tag
      case "create_tag": {
        const parsed = CreateTagSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/repository/tags`, {
          method: "POST",
          body: JSON.stringify(parsed),
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 33. list_merge_requests
      case "list_merge_requests": {
        const parsed = ListMergeRequestsSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const q = new URLSearchParams({
          state: parsed.state,
          page: parsed.page.toString(),
          per_page: parsed.per_page.toString(),
        });
        if (parsed.source_branch) q.append("source_branch", parsed.source_branch);
        if (parsed.target_branch) q.append("target_branch", parsed.target_branch);
        if (parsed.milestone) q.append("milestone", parsed.milestone);
        if (parsed.labels) q.append("labels", formatLabels(parsed.labels));
        if (parsed.search) q.append("search", parsed.search);
        const res = await gitlabRequest(`/projects/${pId}/merge_requests?${q.toString()}`);
        const items = (res.items || res).map(summarizeMR);
        const out = res.pagination ? { pagination: res.pagination, merge_requests: items } : items;
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      // 34. get_merge_request
      case "get_merge_request": {
        const parsed = GetMergeRequestSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}`);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      // 35. create_merge_request
      case "create_merge_request": {
        const parsed = CreateMergeRequestSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        let mId = parsed.milestone_id;
        if (!mId && parsed.milestone_title) {
          mId = await resolveMilestoneId(pId, parsed.milestone_title);
        }
        const body = {
          title: parsed.title,
          source_branch: parsed.source_branch,
          target_branch: parsed.target_branch,
          draft: parsed.draft,
          remove_source_branch: parsed.remove_source_branch,
          squash: parsed.squash,
          ...(parsed.description ? { description: parsed.description } : {}),
          ...(mId ? { milestone_id: mId } : {}),
          ...(parsed.labels ? { labels: formatLabels(parsed.labels) } : {}),
        };
        const res = await gitlabRequest(`/projects/${pId}/merge_requests`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizeMR(res), null, 2) }] };
      }

      // 36. update_merge_request
      case "update_merge_request": {
        const parsed = UpdateMergeRequestSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        let mId = parsed.milestone_id;
        if (mId === undefined && parsed.milestone_title) {
          mId = await resolveMilestoneId(pId, parsed.milestone_title);
        }
        const body = {
          ...(parsed.title ? { title: parsed.title } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          ...(parsed.state_event ? { state_event: parsed.state_event } : {}),
          ...(parsed.target_branch ? { target_branch: parsed.target_branch } : {}),
          ...(mId !== undefined ? { milestone_id: mId } : {}),
          ...(parsed.labels !== undefined ? { labels: formatLabels(parsed.labels) } : {}),
          ...(parsed.add_labels ? { add_labels: formatLabels(parsed.add_labels) } : {}),
          ...(parsed.remove_labels ? { remove_labels: formatLabels(parsed.remove_labels) } : {}),
        };
        const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizeMR(res), null, 2) }] };
      }

      // 37. get_merge_request_changes
      case "get_merge_request_changes": {
        const parsed = GetMergeRequestChangesSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/changes`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  iid: res.iid,
                  title: res.title,
                  source_branch: res.source_branch,
                  target_branch: res.target_branch,
                  changes_count: res.changes_count,
                  changes: (res.changes || []).map((c) => ({
                    old_path: c.old_path,
                    new_path: c.new_path,
                    new_file: c.new_file,
                    renamed_file: c.renamed_file,
                    deleted_file: c.deleted_file,
                    diff: c.diff,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // 38. accept_merge_request
      case "accept_merge_request": {
        const parsed = AcceptMergeRequestSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const body = {
          ...(parsed.commit_message ? { merge_commit_message: parsed.commit_message } : {}),
          ...(parsed.squash !== undefined ? { squash: parsed.squash } : {}),
          ...(parsed.should_remove_source_branch !== undefined
            ? { should_remove_source_branch: parsed.should_remove_source_branch }
            : {}),
        };
        const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/merge`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(summarizeMR(res), null, 2) }] };
      }

      // 39. create_merge_request_note
      case "create_merge_request_note": {
        const parsed = CreateMergeRequestNoteSchema.parse(args);
        const pId = formatProjectId(parsed.project_id);
        const res = await gitlabRequest(`/projects/${pId}/merge_requests/${parsed.merge_request_iid}/notes`, {
          method: "POST",
          body: JSON.stringify({ body: parsed.body }),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { id: res.id, author: res.author?.username, body: res.body, created_at: res.created_at },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
    }
    throw error;
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitLab Extended MCP Server v2 running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
