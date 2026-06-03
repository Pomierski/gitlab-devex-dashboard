import type { APIRoute } from 'astro';
import { getAccessMode } from '@/lib/session';
import { fetchProjects, fetchPipelinesPaginated, isUnauthorized } from '@/lib/gitlabService';
import type { PipelineFilters } from '@/types/gitlab';
import { DEFAULT_FILTERS } from '@/types/gitlab';

export const GET: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);

  if (!access) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = access.type === 'authed' ? access.token : undefined;
  const extraPaths = access.type === 'preview' ? access.extraProjects : [];

  const url = new URL(request.url);
  const q = url.searchParams;

  const filters: PipelineFilters = {
    ...DEFAULT_FILTERS,
    groupIds: q.get('groupIds')?.split(',').map(Number).filter(Boolean) ?? [],
    projectIds: q.get('projectIds')?.split(',').map(Number).filter(Boolean) ?? [],
    statuses: (q.get('statuses')?.split(',').filter(Boolean) ?? []) as PipelineFilters['statuses'],
    refs: q.get('refs')?.split(',').filter(Boolean) ?? [],
    dateRange: (q.get('dateRange') as PipelineFilters['dateRange']) ?? '30d',
    tagsOnly: q.get('tagsOnly') === 'true',
    page: Number(q.get('page') ?? 1),
    perPage: Math.min(
      100,
      Math.max(1, Number(q.get('perPage') ?? 20)),
    ) as PipelineFilters['perPage'],
  };

  try {
    const projects = await fetchProjects(token, { extraPaths });
    const result = await fetchPipelinesPaginated(token, projects, filters);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (isUnauthorized(e))
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    console.error('[api/pipelines]', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
