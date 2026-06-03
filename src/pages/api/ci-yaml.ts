import type { APIRoute } from 'astro';
import { getAccessMode } from '@/lib/session';
import { fetchCiYaml, isUnauthorized } from '@/lib/gitlabService';

export const GET: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) return new Response('Unauthorized', { status: 401 });

  const token = access.type === 'authed' ? access.token : undefined;
  const projectId = Number(new URL(request.url).searchParams.get('projectId'));

  try {
    const yaml = await fetchCiYaml(token, projectId);
    return new Response(yaml, { headers: { 'Content-Type': 'text/plain' } });
  } catch (e) {
    if (isUnauthorized(e)) return new Response('Unauthorized', { status: 401 });
    console.error('[api/ci-yaml]', e);
    return new Response('Internal server error', { status: 500 });
  }
};
