// GitLab API v4 types

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  avatar_url: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  namespace: { id: number; name: string; kind: 'group' | 'user' };
}

export interface GitLabGroup {
  id: number;
  name: string;
  full_path: string;
}

export type PipelineStatus =
  | 'created'
  | 'waiting_for_resource'
  | 'preparing'
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'scheduled';

export interface GitLabPipeline {
  id: number;
  iid: number;
  project_id: number;
  status: PipelineStatus;
  source: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  user: GitLabUser | null;
  tag: boolean;
}

export interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: PipelineStatus;
  duration: number | null;
  failure_reason: string | null;
  web_url: string;
  pipeline: { id: number };
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  author_name: string;
}

// Normalized types for UI consumption

export interface PipelineRow {
  id: number;
  projectId: number;
  projectName: string;
  projectPath: string;
  status: PipelineStatus;
  ref: string;
  isTag: boolean;
  commitTitle: string;
  triggeredBy: string;
  triggeredByAvatar: string;
  duration: number | null;
  createdAt: string;
  webUrl: string;
}

export interface DurationDataPoint {
  date: string;
  avgDuration: number;
}

export interface JobFailure {
  jobName: string;
  stage: string;
  count: number;
}

export interface TagJobDuration {
  tag: string;
  jobName: string;
  avgDuration: number;
}

export interface AnalyticsSummary {
  total: number;
  success: number;
  failed: number;
  running: number;
  canceled: number;
  durationTrend: DurationDataPoint[];
  topFailingJobs: JobFailure[];
  tagJobDurations: TagJobDuration[];
}

// Filter + pagination state

export interface PipelineFilters {
  groupIds: number[];
  projectIds: number[];
  statuses: PipelineStatus[];
  refs: string[];
  dateRange: '7d' | '30d' | '90d';
  tagsOnly: boolean;
  page: number;
  perPage: 20 | 50 | 100;
}

export const DEFAULT_FILTERS: PipelineFilters = {
  groupIds: [],
  projectIds: [],
  statuses: [],
  refs: [],
  dateRange: '30d',
  tagsOnly: false,
  page: 1,
  perPage: 20,
};

export interface PaginatedPipelines {
  rows: PipelineRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface SessionData {
  accessToken?: string;
  user?: GitLabUser;
  oauthState?: string;
}

export interface CiLintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  merged_yaml?: string;
}

// ── v4 Enterprise types ───────────────────────────────────────────────────────

export interface ProjectHealth {
  projectId: number;
  projectName: string;
  projectPath: string;
  successRate: number; // 0–1
  mttr: number | null; // mean-time-to-recovery in seconds
  lastStatus: PipelineStatus;
  totalRuns: number;
}

// Runner-bottleneck and log-fingerprint types moved to `@/types/telemetry`.

/**
 * A job is flaky when, on the same ref, it both passed and failed within the
 * sample window. Score is `failedRuns / totalRuns` - peaks for jobs that fail
 * roughly half the time, which is the worst kind of flakiness.
 */
export interface FlakyJob {
  projectId: number;
  projectName: string;
  jobName: string;
  stage: string;
  ref: string;
  totalRuns: number;
  failedRuns: number;
  flakeRate: number; // 0..1, failedRuns / totalRuns
  lastFailedAt: string;
  lastSuccessAt: string;
}

export type BulkActionType = 'retry' | 'cancel';

export interface BulkActionRequest {
  action: BulkActionType;
  pipelineIds: Array<{ projectId: number; pipelineId: number }>;
}

export interface BulkActionProgress {
  total: number;
  done: number;
  failed: number;
  errors: string[];
  running: boolean;
}

export interface CiDriftEntry {
  projectId: number;
  projectName: string;
  outdatedIncludes: string[]; // include: templates that differ from canonical
  deprecatedImages: string[]; // Docker image tags flagged as deprecated
}

// Worker protocol types live in `@/types/telemetry` to keep the worker bundle
// independent of UI types.
