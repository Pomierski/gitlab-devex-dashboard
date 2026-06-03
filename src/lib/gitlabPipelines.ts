import type {
  GitLabProject,
  GitLabPipeline,
  GitLabJob,
  GitLabCommit,
  PipelineRow,
  PaginatedPipelines,
  PipelineFilters,
} from '@/types/gitlab';
import { gitlabFetch, gitlabFetchOne, gitlabRequest } from '@/lib/gitlabClient';
import { subDays } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function dateRangeParam(range: PipelineFilters['dateRange']): string {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return subDays(new Date(), days).toISOString();
}

export function buildPipelineParams(filters: PipelineFilters): Record<string, string> {
  const params: Record<string, string> = {
    updated_after: dateRangeParam(filters.dateRange),
    order_by: 'updated_at',
    sort: 'desc',
  };
  if (filters.statuses.length === 1) {
    params['status'] = filters.statuses[0];
  }
  if (filters.refs.length === 1) {
    params['ref'] = filters.refs[0];
  }
  if (filters.tagsOnly) {
    params['source'] = 'push';
  }
  return params;
}

export function resolveTargetProjects(
  projects: GitLabProject[],
  filters: PipelineFilters,
): GitLabProject[] {
  if (filters.projectIds.length > 0) {
    return projects.filter((p) => filters.projectIds.includes(p.id));
  }
  if (filters.groupIds.length > 0) {
    return projects.filter((p) => filters.groupIds.includes(p.namespace.id));
  }
  return projects;
}

async function resolveCommitTitle(
  token: string | undefined,
  projectId: number,
  sha: string,
): Promise<string> {
  try {
    const c = await gitlabFetchOne<GitLabCommit>(
      token,
      `/projects/${projectId}/repository/commits/${sha}`,
    );
    return c.title;
  } catch {
    return sha.slice(0, 8);
  }
}

function normalizePipeline(
  p: GitLabPipeline,
  project: GitLabProject,
  commitTitle: string,
): PipelineRow {
  return {
    id: p.id,
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path_with_namespace,
    status: p.status,
    ref: p.ref,
    isTag: p.tag ?? false,
    commitTitle,
    triggeredBy: p.user?.name ?? 'Pipeline',
    triggeredByAvatar: p.user?.avatar_url ?? '',
    duration: p.duration,
    createdAt: p.created_at,
    webUrl: p.web_url,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchJobsForPipeline(
  token: string | undefined,
  projectId: number,
  pipelineId: number,
): Promise<GitLabJob[]> {
  return gitlabFetch<GitLabJob>(token, `/projects/${projectId}/pipelines/${pipelineId}/jobs`);
}

export async function fetchJobLog(
  token: string | undefined,
  projectId: number,
  jobId: number,
): Promise<string> {
  const res = await gitlabRequest(token, `/projects/${projectId}/jobs/${jobId}/trace`);
  return res.text();
}

export async function fetchCiYaml(token: string | undefined, projectId: number): Promise<string> {
  const res = await gitlabRequest(
    token,
    `/projects/${projectId}/repository/files/.gitlab-ci.yml/raw`,
    {},
    new URLSearchParams({ ref: 'HEAD' }),
  );
  return res.text();
}

export async function fetchPipelinesPaginated(
  token: string | undefined,
  projects: GitLabProject[],
  filters: PipelineFilters,
): Promise<PaginatedPipelines> {
  const targetProjects = resolveTargetProjects(projects, filters);
  if (targetProjects.length === 0) {
    return { rows: [], total: 0, page: filters.page, perPage: filters.perPage, totalPages: 0 };
  }

  const params = buildPipelineParams(filters);

  const perProject = await Promise.all(
    targetProjects.map((proj) =>
      gitlabFetch<GitLabPipeline>(token, `/projects/${proj.id}/pipelines`, params),
    ),
  );

  const all = perProject
    .flat()
    .filter((p) => (filters.statuses.length > 1 ? filters.statuses.includes(p.status) : true))
    .filter((p) => (filters.tagsOnly ? p.tag : true))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = all.length;
  const totalPages = Math.ceil(total / filters.perPage);
  const slice = all.slice((filters.page - 1) * filters.perPage, filters.page * filters.perPage);

  const projectMap = new Map(targetProjects.map((p) => [p.id, p]));
  const rows = await Promise.all(
    slice.map(async (p) => {
      const project = projectMap.get(p.project_id)!;
      const commitTitle = await resolveCommitTitle(token, project.id, p.sha);
      return normalizePipeline(p, project, commitTitle);
    }),
  );

  return { rows, total, page: filters.page, perPage: filters.perPage, totalPages };
}

export async function fetchPipelineRows(
  token: string | undefined,
  projects: GitLabProject[],
  filters: PipelineFilters,
): Promise<PipelineRow[]> {
  const result = await fetchPipelinesPaginated(token, projects, {
    ...filters,
    page: 1,
    perPage: 20,
  });
  return result.rows;
}
