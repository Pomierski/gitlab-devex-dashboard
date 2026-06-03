import type { APIRoute } from 'astro';
import { exchangeCodeForToken, fetchCurrentUser, getSession } from '@/lib/session';

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code) return redirect('/auth/error');

  try {
    const response = new Response(null, { status: 302, headers: { Location: '/' } });
    const session = await getSession(request, response);

    // Validate CSRF state
    if (!state || state !== session.oauthState) {
      return redirect('/auth/error');
    }
    delete session.oauthState;

    session.accessToken = await exchangeCodeForToken(code);
    session.user = await fetchCurrentUser(session.accessToken);
    await session.save();

    return response;
  } catch {
    return redirect('/auth/error');
  }
};
