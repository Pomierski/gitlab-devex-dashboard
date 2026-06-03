import type { APIRoute } from 'astro';

/**
 * Exit preview mode: clears the preview cookies and sends the user to login.
 */
export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('gl_preview', { path: '/' });
  cookies.delete('gl_preview_projects', { path: '/' });
  return redirect('/auth/login');
};
