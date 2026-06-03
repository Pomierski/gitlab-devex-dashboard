import type { APIRoute } from 'astro';
import { getSession } from '@/lib/session';

export const GET: APIRoute = async ({ request }) => {
  const response = new Response(null, { status: 302, headers: { Location: '/auth/login' } });
  const session = await getSession(request, response);
  session.destroy();
  return response;
};
