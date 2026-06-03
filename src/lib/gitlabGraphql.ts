import type { GitLabProject, GitLabPipeline, GitLabJob, PipelineStatus } from '@/types/gitlab';
import { defaultQueue } from '@/lib/apiQueue';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const GITLAB_URL = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';
const GRAPHQL_ENDPOINT = `${GITLAB_URL}/api/graphql`;

/**
 * Mirror of `HttpError` from `gitlabService.ts`. Defined locally so this
 * module can throw without importing back into gitlabService and creating a
 * cycle. Carries the same fields the queue inspects (`status`,
 * `retryAfterMs`).
 */
export class GraphqlError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'GraphqlError';
  }
}

function rateLimitKey(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

async function gqlRequest<T>(
  token: string | undefined,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const limitKey = token ? rateLimitKey(token) : 'preview';

  return defaultQueue.enqueue(
    async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (!res.ok) {
        throw new GraphqlError(
          res.status,
          `GitLab GraphQL ${res.status}`,
          parseRetryAfter(res.headers),
        );
      }

      const body = (await res.json()) as GraphqlResponse<T>;

      if (body.errors && body.errors.length > 0) {
        const message = body.errors.map((e) => e.message).join('; ');
        const isAuth = body.errors.some(
          (e) =>
            /unauth|forbid|denied/i.test(e.message) || e.extensions?.code === 'UNAUTHENTICATED',
        );
        throw new GraphqlError(isAuth ? 401 : 500, `GraphQL error: ${message}`);
      }

      if (!body.data) {
        throw new GraphqlError(500, 'GraphQL response missing data');
      }

      return body.data;
    },
    { rateLimitKey: limitKey },
  );
}

// ── Schema-shaped response types (defensive: only fields we actually read) ────

const GqlJobNodeSchema = z
  .object({
    name: z.string().nullish(),
    status: z.string().nullish(),
    duration: z.number().nullish(),
    finishedAt: z.string().nullish(),
    stage: z.object({ name: z.string().nullish() }).nullish(),
  })
  .passthrough();

const GqlPipelineNodeSchema = z
  .object({
    id: z.string().nullish(),
    ref: z.string().nullish(),
    status: z.string().nullish(),
    sha: z.string().nullish(),
    createdAt: z.string().nullish(),
    finishedAt: z.string().nullish(),
    duration: z.number().nullish(),
    jobs: z.object({ nodes: z.array(GqlJobNodeSchema.nullable()).nullish() }).nullish(),
  })
  .passthrough();

const GqlPipelinesResponseSchema = z.object({
  project: z
    .object({
      pipelines: z
        .object({ nodes: z.array(GqlPipelineNodeSchema.nullable()).nullish() })
        .nullable(),
    })
    .nullable(),
});

type GqlJobNode = z.infer<typeof GqlJobNodeSchema>;
type GqlPipelineNode = z.infer<typeof GqlPipelineNodeSchema>;

// ── Normalisation: GraphQL → REST-shaped types ────────────────────────────────

/** Extract numeric id from a GitLab global id like "gid://gitlab/Ci::Pipeline/12345". */
function gidToNumber(gid: string | null | undefined): number {
  if (!gid) return 0;
  const last = gid.split('/').pop();
  const n = Number(last);
  return Number.isFinite(n) ? n : 0;
}

/** Map GraphQL pipeline status enum (uppercase) to our REST PipelineStatus (lowercase). */
function normaliseStatus(s: string | null | undefined): PipelineStatus {
  if (!s) return 'created';
  const lower = s.toLowerCase();
  if (
    lower === 'success' ||
    lower === 'failed' ||
    lower === 'running' ||
    lower === 'pending' ||
    lower === 'canceled' ||
    lower === 'skipped' ||
    lower === 'manual' ||
    lower === 'scheduled' ||
    lower === 'created' ||
    lower === 'preparing' ||
    lower === 'waiting_for_resource'
  ) {
    return lower as PipelineStatus;
  }
  return 'created';
}

/**
 * GraphQL doesn't expose `Pipeline.tag` directly, so normalised pipelines
 * always have `tag: false`. Callers that need the tag flag must look it up
 * separately (see `fetchTagJobDurations` for the pattern).
 */
function normalisePipeline(node: GqlPipelineNode, project: GitLabProject): GitLabPipeline {
  return {
    id: gidToNumber(node.id),
    iid: 0,
    project_id: project.id,
    status: normaliseStatus(node.status),
    source: '',
    ref: node.ref ?? '',
    sha: node.sha ?? '',
    web_url: '',
    created_at: node.createdAt ?? '',
    updated_at: node.createdAt ?? '',
    started_at: null,
    finished_at: node.finishedAt ?? null,
    duration: node.duration ?? null,
    user: null,
    tag: false,
  };
}

function normaliseJob(node: GqlJobNode, pipelineId: number): GitLabJob {
  return {
    id: 0, // GraphQL job nodes don't expose numeric id by default; not used downstream
    name: node.name ?? '',
    stage: node.stage?.name ?? '',
    status: normaliseStatus(node.status),
    duration: node.duration ?? null,
    failure_reason: null,
    web_url: '',
    pipeline: { id: pipelineId },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

const QUERY_PROJECT_PIPELINES_WITH_JOBS = `
  query ProjectPipelinesWithJobs(
    $fullPath: ID!,
    $updatedAfter: Time,
    $status: PipelineStatusEnum,
    $first: Int!
  ) {
    project(fullPath: $fullPath) {
      pipelines(updatedAfter: $updatedAfter, status: $status, first: $first) {
        nodes {
          id
          ref
          status
          sha
          createdAt
          finishedAt
          duration
          jobs(first: 100) {
            nodes {
              name
              status
              duration
              finishedAt
              stage { name }
            }
          }
        }
      }
    }
  }
`;

export interface PipelinesWithJobsOptions {
  days?: number;
  /** Lowercase REST-style status (e.g. 'failed'); will be uppercased for GraphQL. */
  status?: PipelineStatus;
  first?: number;
}

/**
 * Fetch up to `first` recent pipelines (with their jobs embedded) for one
 * project in **one** GraphQL call — instead of N+1 REST calls.
 */
export async function fetchProjectPipelinesWithJobs(
  token: string | undefined,
  project: GitLabProject,
  opts: PipelinesWithJobsOptions = {},
): Promise<Array<{ pipeline: GitLabPipeline; jobs: GitLabJob[] }>> {
  const { days = 30, status, first = 30 } = opts;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const variables: Record<string, unknown> = {
    fullPath: project.path_with_namespace,
    updatedAfter: since.toISOString(),
    first,
  };
  if (status) variables.status = status.toUpperCase();

  const raw = await gqlRequest<unknown>(token, QUERY_PROJECT_PIPELINES_WITH_JOBS, variables);

  const data = GqlPipelinesResponseSchema.parse(raw);

  const nodes = data.project?.pipelines?.nodes ?? [];
  const out: Array<{ pipeline: GitLabPipeline; jobs: GitLabJob[] }> = [];

  for (const node of nodes) {
    if (!node) continue;
    const pipeline = normalisePipeline(node, project);
    const jobs = (node.jobs?.nodes ?? [])
      .filter((j): j is GqlJobNode => j != null)
      .map((j) => normaliseJob(j, pipeline.id));
    out.push({ pipeline, jobs });
  }

  return out;
}
