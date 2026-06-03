import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getAccessMode } from '@/lib/session';
import type { CiLintResult } from '@/types/gitlab';

const GITLAB_URL = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';

const CiLintSchema = z.object({
  projectId: z.number().int().positive(),
  content: z.string().min(1).max(1_000_000),
});

async function tryLint(token: string, url: string, body: object): Promise<CiLintResult | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // 404 = endpoint doesn't exist on this GitLab version; try next
  if (res.status === 404) return null;

  if (!res.ok) {
    return { valid: false, errors: [`GitLab API error: HTTP ${res.status}`], warnings: [] };
  }

  const raw = await res.json();
  return {
    valid: raw.valid ?? raw.status === 'valid',
    errors: Array.isArray(raw.errors) ? raw.errors : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

export const POST: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) return new Response('Unauthorized', { status: 401 });
  if (access.type === 'preview') {
    return new Response(
      JSON.stringify({ error: 'CI Lint requires sign-in (writes via GitLab API).' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const parsed = CiLintSchema.safeParse(await request.json());
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { projectId, content } = parsed.data;
  const token = access.token;

  // GitLab 16+: project-scoped endpoint (requires Developer role)
  const result = (await tryLint(token, `${GITLAB_URL}/api/v4/projects/${projectId}/ci/lint`, {
    content,
    dry_run: false,
    ref: 'HEAD',
  })) ??
    // GitLab <16: global endpoint
    (await tryLint(token, `${GITLAB_URL}/api/v4/ci/lint`, { content })) ??
      // Both unavailable
      {
        valid: false,
        errors: ['CI Lint API not available on this GitLab instance.'],
        warnings: [],
      };

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
