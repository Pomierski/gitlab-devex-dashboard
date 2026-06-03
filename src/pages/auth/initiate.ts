import type { APIRoute } from 'astro';
import { buildOAuthUrl, getSession } from '@/lib/session';

export const GET: APIRoute = async ({ request, redirect }) => {
  const state = crypto.randomUUID();
  const url = buildOAuthUrl(state);

  const response = redirect(url);
  const session = await getSession(request, response);
  session.oauthState = state;
  await session.save();

  return response;
};
