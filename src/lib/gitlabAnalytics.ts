import type {
  GitLabProject,
  GitLabPipeline,
  PipelineFilters,
  AnalyticsSummary,
  DurationDataPoint,
  JobFailure,
  TagJobDuration,
  FlakyJob,
} from '@/types/gitlab';
import { gitlabFetch } from '@/lib/gitlabClient';
import { defaultCache } from '@/lib/cache/memory';
import { fetchProjectPipelinesWithJobs } from '@/lib/gitlabGraphql';
import { buildPipelineParams, resolveTargetProjects } from '@/lib/gitlabPipelines';
import { differenceInSeconds } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────

function paramsToDays(params: Record<string, string>): number {
  const iso = params['updated_after'];
  if (!iso) {
    return 30;
  }
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return 30;
  }
  return Math.max(1, Math.round(ms / (24 * 3600 * 1000)));
}

function pipelineDurationSeconds(p: GitLabPipeline): number | null {
  if (p.duration != null) {
    return p.duration;
  }
  if (!p.created_at || !p.updated_at) {
    return null;
  }
  const sec = differenceInSeconds(new Date(p.updated_at), new Date(p.created_at));
  return sec > 0 ? sec : null;
}

function buildDurationTrend(pipelines: GitLabPipeline[]): DurationDataPoint[] {
  const byDay = new Map<string, number[]>();
  for (const p of pipelines) {
    if (p.status !== 'success') {
      continue;
    }
    const dur = pipelineDurationSeconds(p);
    if (dur == null) {
      continue;
    }
    const day = p.created_at.slice(0, 10);
    const bucket = byDay.get(day) ?? [];
    bucket.push(dur);
    byDay.set(day, bucket);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ds]) => ({
      date,
      avgDuration: Math.round(ds.reduce((s, d) => s + d, 0) / ds.length),
    }));
}

async function fetchProjectTagRefs(
  token: string | undefined,
  projectId: number,
): Promise<Set<string>> {
  return defaultCache.getOrSet(`tags:${projectId}`, 3600, async () => {
    const tags = await gitlabFetch<{ name: string }>(
      token,
      `/projects/${projectId}/repository/tags`,
    );
    return new Set(tags.map((t) => t.name));
  });
}

async function fetchTopFailingJobs(
  token: string | undefined,
  projects: GitLabProject[],
  params: Record<string, string>,
): Promise<JobFailure[]> {
  const days = paramsToDays(params);

  const perProject = await Promise.all(
    projects.map((p) =>
      fetchProjectPipelinesWithJobs(token, p, { days, status: 'failed', first: 30 }),
    ),
  );

  const counts = new Map<string, JobFailure>();
  for (const rows of perProject) {
    for (const { jobs } of rows) {
      for (const job of jobs) {
        if (job.status !== 'failed') {
          continue;
        }
        const key = `${job.stage}:${job.name}`;
        const e = counts.get(key);
        if (e) {
          e.count++;
        } else {
          counts.set(key, { jobName: job.name, stage: job.stage, count: 1 });
        }
      }
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function fetchTagJobDurations(
  token: string | undefined,
  projects: GitLabProject[],
  params: Record<string, string>,
): Promise<TagJobDuration[]> {
  const days = paramsToDays(params);

  const perProject = await Promise.all(
    projects.map(async (p) => {
      const [tagRefs, rows] = await Promise.all([
        fetchProjectTagRefs(token, p.id),
        fetchProjectPipelinesWithJobs(token, p, { days, first: 50 }),
      ]);
      return { tagRefs, rows };
    }),
  );

  const tagRows = perProject
    .flatMap(({ tagRefs, rows }) =>
      rows.filter(({ pipeline }) => pipeline.status === 'success' && tagRefs.has(pipeline.ref)),
    )
    .slice(0, 20);

  if (tagRows.length === 0) {
    return [];
  }

  const acc = new Map<string, { total: number; count: number }>();
  for (const { pipeline, jobs } of tagRows) {
    for (const job of jobs) {
      if (job.duration == null) {
        continue;
      }
      const key = `${pipeline.ref}::${job.name}`;
      const e = acc.get(key) ?? { total: 0, count: 0 };
      e.total += job.duration;
      e.count++;
      acc.set(key, e);
    }
  }

  return Array.from(acc.entries()).map(([key, { total, count }]) => {
    const [tag, jobName] = key.split('::');
    return { tag, jobName, avgDuration: Math.round(total / count) };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchAnalytics(
  token: string | undefined,
  projects: GitLabProject[],
  filters: PipelineFilters,
): Promise<AnalyticsSummary> {
  const targetProjects = resolveTargetProjects(projects, filters).slice(0, 10);
  const params = buildPipelineParams(filters);

  const allPipelines = (
    await Promise.all(
      targetProjects.map((p) =>
        gitlabFetch<GitLabPipeline>(token, `/projects/${p.id}/pipelines`, params),
      ),
    )
  ).flat();

  const [topFailingJobs, tagJobDurations] = await Promise.all([
    fetchTopFailingJobs(token, targetProjects, params),
    fetchTagJobDurations(token, targetProjects, params),
  ]);

  return {
    total: allPipelines.length,
    success: allPipelines.filter((p) => p.status === 'success').length,
    failed: allPipelines.filter((p) => p.status === 'failed').length,
    running: allPipelines.filter((p) => p.status === 'running').length,
    canceled: allPipelines.filter((p) => p.status === 'canceled').length,
    durationTrend: buildDurationTrend(allPipelines),
    topFailingJobs,
    tagJobDurations,
  };
}

export async function fetchFlakyJobs(
  token: string | undefined,
  projects: GitLabProject[],
  options: { days?: number; projectLimit?: number; pipelineLimit?: number } = {},
): Promise<FlakyJob[]> {
  const { days = 30, projectLimit = 10, pipelineLimit = 30 } = options;

  const targetProjects = projects.slice(0, projectLimit);
  if (targetProjects.length === 0) {
    return [];
  }

  const perProject = await Promise.all(
    targetProjects.map((p) =>
      fetchProjectPipelinesWithJobs(token, p, { days, first: pipelineLimit }).then((rows) => ({
        project: p,
        rows,
      })),
    ),
  );

  type Bucket = {
    projectId: number;
    projectName: string;
    jobName: string;
    stage: string;
    ref: string;
    total: number;
    failed: number;
    lastFailedAt: string;
    lastSuccessAt: string;
  };
  const buckets = new Map<string, Bucket>();

  for (const { project, rows } of perProject) {
    for (const { pipeline, jobs } of rows) {
      if (pipeline.status !== 'success' && pipeline.status !== 'failed') {
        continue;
      }

      for (const job of jobs) {
        if (job.status !== 'success' && job.status !== 'failed') {
          continue;
        }
        const key = `${project.id}::${pipeline.ref}::${job.name}`;
        const b = buckets.get(key) ?? {
          projectId: project.id,
          projectName: project.name,
          jobName: job.name,
          stage: job.stage,
          ref: pipeline.ref,
          total: 0,
          failed: 0,
          lastFailedAt: '',
          lastSuccessAt: '',
        };
        b.total++;
        if (job.status === 'failed') {
          b.failed++;
          if (pipeline.created_at > b.lastFailedAt) {
            b.lastFailedAt = pipeline.created_at;
          }
        } else {
          if (pipeline.created_at > b.lastSuccessAt) {
            b.lastSuccessAt = pipeline.created_at;
          }
        }
        buckets.set(key, b);
      }
    }
  }

  const flaky: FlakyJob[] = [];
  for (const b of buckets.values()) {
    if (b.total < 3) {
      continue;
    }
    if (b.failed === 0 || b.failed === b.total) {
      continue;
    }
    flaky.push({
      projectId: b.projectId,
      projectName: b.projectName,
      jobName: b.jobName,
      stage: b.stage,
      ref: b.ref,
      totalRuns: b.total,
      failedRuns: b.failed,
      flakeRate: b.failed / b.total,
      lastFailedAt: b.lastFailedAt,
      lastSuccessAt: b.lastSuccessAt,
    });
  }

  return flaky.sort((a, b) => b.flakeRate - a.flakeRate).slice(0, 25);
}
