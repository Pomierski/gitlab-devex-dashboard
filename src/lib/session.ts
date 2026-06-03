import { getIronSession } from 'iron-session';
import type { SessionData } from '@/types/gitlab';

function getSessionSecret(): string {
  const secret = import.meta.env.SESSION_SECRET;
  if (secret) return secret;
  if (import.meta.env.PROD) throw new Error('SESSION_SECRET env var is required in production');
  return 'fallback_dev_secret_32_chars_min!!';
}

const SESSION_OPTIONS = {
  password: getSessionSecret(),
  cookieName: 'gl_session',
  cookieOptions: {
    secure: import.meta.env.PROD,
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};

// iron-session expects a Request/Response pair; we adapt Astro's cookies via a
// minimal shim so we don't need to pass the raw Request everywhere.
export async function getSession(
  request: Request,
  response: Response,
): Promise<ReturnType<typeof getIronSession<SessionData>>> {
  return getIronSession<SessionData>(request, response, SESSION_OPTIONS);
}

export function buildOAuthUrl(state: string): string {
  const base = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';
  const url = new URL(`${base}/oauth/authorize`);
  url.searchParams.set('client_id', import.meta.env.GITLAB_CLIENT_ID);
  url.searchParams.set('redirect_uri', import.meta.env.GITLAB_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'read_api read_user');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const base = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';
  const res = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: import.meta.env.GITLAB_CLIENT_ID,
      client_secret: import.meta.env.GITLAB_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: import.meta.env.GITLAB_REDIRECT_URI,
    }),
  });

  if (!res.ok) throw new Error('Token exchange failed');
  const data = await res.json();
  return data.access_token as string;
}

export async function fetchCurrentUser(token: string) {
  const base = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';
  const res = await fetch(`${base}/api/v4/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

// ── Access mode (authed vs preview) ──────────────────────────────────────────

const PREVIEW_COOKIE = 'gl_preview';
const PREVIEW_PROJECTS_COOKIE = 'gl_preview_projects';

export type AccessMode =
  | { type: 'authed'; token: string }
  | { type: 'preview'; extraProjects: string[] };

/** Parse the Cookie header into a plain object. Tolerates missing values. */
function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * Determine how this request should access GitLab data.
 *
 * - `'authed'` when the iron-session has a valid access token (OAuth)
 * - `'preview'` when the `gl_preview` cookie is set (read-only, public projects)
 * - `null` when neither — caller should reject with 401
 */
export async function getAccessMode(
  request: Request,
  response: Response,
): Promise<AccessMode | null> {
  const session = await getSession(request, response);
  if (session.accessToken) {
    return { type: 'authed', token: session.accessToken };
  }

  const cookies = parseCookies(request.headers.get('cookie'));
  if (cookies[PREVIEW_COOKIE] === '1') {
    const raw = cookies[PREVIEW_PROJECTS_COOKIE] ?? '';
    const extraProjects = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[\w.-]+(\/[\w.-]+)+$/.test(s)); // basic group/project shape
    return { type: 'preview', extraProjects };
  }

  return null;
}
