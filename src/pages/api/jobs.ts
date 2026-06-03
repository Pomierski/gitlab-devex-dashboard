import type { APIRoute } from 'astro';
import { getAccessMode } from '@/lib/session';
import { fetchJobsForPipeline, isUnauthorized } from '@/lib/gitlabService';

export const GET: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const token = access.type === 'authed' ? access.token : undefined;

  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get('projectId'));
  const pipelineId = Number(url.searchParams.get('pipelineId'));

  try {
    const jobs = await fetchJobsForPipeline(token, projectId, pipelineId);
    return new Response(JSON.stringify(jobs), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (isUnauthorized(e))
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    console.error('[api/jobs]', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
