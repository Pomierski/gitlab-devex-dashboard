import type { APIRoute } from 'astro';

/**
 * Enter preview mode: sets the gl_preview cookie and redirects to the
 * dashboard. Optionally accepts a `?projects=` query (comma-separated
 * `group/project` paths) which is stored in `gl_preview_projects` so the
 * user can preview-extend the curated list.
 */
export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const requestedProjects = url.searchParams.get('projects') ?? '';

  cookies.set('gl_preview', '1', {
    path: '/',
    httpOnly: false, // frontend can read it for "Preview mode" badge
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  if (requestedProjects) {
    cookies.set('gl_preview_projects', requestedProjects, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return redirect('/');
};
