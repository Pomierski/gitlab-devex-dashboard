import type { GitLabProject, GitLabGroup } from '@/types/gitlab';
import { defaultQueue } from '@/lib/apiQueue';
import { defaultCache } from '@/lib/cache/memory';
import { createHash } from 'node:crypto';

export const GITLAB_URL = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';

const TTL_PROJECTS_SEC = 300;
const TTL_PUBLIC_PROJECT_SEC = 1800;

// ── Errors ────────────────────────────────────────────────────────────────────

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number,
    public readonly rateLimit?: RateLimitInfo,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isUnauthorized(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 401;
  }
  return err instanceof Error && err.message.includes('401');
}

// ── Header parsing ────────────────────────────────────────────────────────────

export function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After');
  if (!raw) {
    return undefined;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return undefined;
}

export function parseRateLimit(headers: Headers): RateLimitInfo | undefined {
  const limit = Number(headers.get('RateLimit-Limit'));
  const remaining = Number(headers.get('RateLimit-Remaining'));
  const reset = Number(headers.get('RateLimit-Reset'));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) {
    return undefined;
  }
  return { limit, remaining, resetAt: Number.isFinite(reset) ? Date.now() + reset * 1000 : 0 };
}

export function rateLimitKey(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

// ── Core fetch utilities ──────────────────────────────────────────────────────

interface RequestInitMinimal {
  method?: string;
  headers?: Record<string, string>;
}

export async function gitlabRequest(
  token: string | undefined,
  path: string,
  init: RequestInitMinimal = {},
  search?: URLSearchParams,
): Promise<Response> {
  const limitKey = token ? rateLimitKey(token) : 'preview';

  return defaultQueue.enqueue(
    async () => {
      const url = search
        ? `${GITLAB_URL}/api/v4${path}?${search.toString()}`
        : `${GITLAB_URL}/api/v4${path}`;

      const headers: Record<string, string> = { ...(init.headers ?? {}) };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, { ...init, headers });

      if (!res.ok) {
        throw new HttpError(
          res.status,
          `GitLab API ${res.status}: ${path}`,
          parseRetryAfter(res.headers),
          parseRateLimit(res.headers),
        );
      }
      return res;
    },
    { rateLimitKey: limitKey },
  );
}

export async function gitlabFetch<T>(
  token: string | undefined,
  path: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const search = new URLSearchParams();
    search.set('per_page', '100');
    search.set('page', String(page));
    for (const [k, v] of Object.entries(params)) {
      search.set(k, v);
    }

    const res = await gitlabRequest(token, path, {}, search);
    const data: T[] = await res.json();
    results.push(...data);

    const totalPages = Number(res.headers.get('X-Total-Pages') ?? 1);
    if (page >= totalPages || data.length === 0) {
      break;
    }
    page++;
  }

  return results;
}

export async function gitlabFetchOne<T>(token: string | undefined, path: string): Promise<T> {
  const res = await gitlabRequest(token, path);
  return res.json() as Promise<T>;
}

// ── Project fetching ──────────────────────────────────────────────────────────

const DEFAULT_PREVIEW_PATHS = ['gitlab-org/cli', 'inkscape/inkscape'];

function curatedPreviewPaths(): string[] {
  const env = import.meta.env.PREVIEW_PROJECT_PATHS as string | undefined;
  if (!env) {
    return DEFAULT_PREVIEW_PATHS;
  }
  return env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fetchPublicProjectByPath(path: string): Promise<GitLabProject | null> {
  return defaultCache.getOrSet(`public-project:${path}`, TTL_PUBLIC_PROJECT_SEC, async () => {
    try {
      return await gitlabFetchOne<GitLabProject>(
        undefined,
        `/projects/${encodeURIComponent(path)}`,
      );
    } catch {
      return null;
    }
  });
}

export async function fetchProjects(
  token?: string,
  opts: { extraPaths?: string[] } = {},
): Promise<GitLabProject[]> {
  if (token) {
    const key = `projects:${rateLimitKey(token)}`;
    return defaultCache.getOrSet(key, TTL_PROJECTS_SEC, () =>
      gitlabFetch<GitLabProject>(token, '/projects', {
        membership: 'true',
        order_by: 'last_activity_at',
      }),
    );
  }

  const curated = curatedPreviewPaths();
  const extras = opts.extraPaths ?? [];
  const allPaths = Array.from(new Set([...curated, ...extras]));
  const results = await Promise.all(allPaths.map(fetchPublicProjectByPath));
  return results.filter((p): p is GitLabProject => p !== null);
}

export async function fetchGroups(token: string | undefined): Promise<GitLabGroup[]> {
  return gitlabFetch<GitLabGroup>(token, '/groups', { min_access_level: '10' });
}
