import type { APIRoute } from 'astro';
import { getAccessMode } from '@/lib/session';
import { fetchProjects, fetchFlakyJobs, isUnauthorized } from '@/lib/gitlabService';

export const GET: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const token = access.type === 'authed' ? access.token : undefined;
  const extraPaths = access.type === 'preview' ? access.extraProjects : [];

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') ?? 30)));

  try {
    const projects = await fetchProjects(token, { extraPaths });
    const flaky = await fetchFlakyJobs(token, projects, { days });
    return new Response(JSON.stringify(flaky), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (isUnauthorized(e)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    console.error('[api/flaky-jobs]', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
