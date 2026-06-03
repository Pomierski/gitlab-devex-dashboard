import type { APIRoute } from 'astro';
import { getAccessMode } from '@/lib/session';
import { fetchJobLog, isUnauthorized } from '@/lib/gitlabService';

export const GET: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) return new Response('Unauthorized', { status: 401 });

  const token = access.type === 'authed' ? access.token : undefined;
  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get('projectId'));
  const jobId = Number(url.searchParams.get('jobId'));

  try {
    const log = await fetchJobLog(token, projectId, jobId);
    return new Response(log, { headers: { 'Content-Type': 'text/plain' } });
  } catch (e) {
    if (isUnauthorized(e)) return new Response('Unauthorized', { status: 401 });
    console.error('[api/job-log]', e);
    return new Response('Internal server error', { status: 500 });
  }
};
