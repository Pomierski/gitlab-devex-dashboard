import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getAccessMode } from '@/lib/session';
import { defaultQueue } from '@/lib/apiQueue';
import { HttpError } from '@/lib/gitlabService';

const GITLAB_URL = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';

const BulkActionSchema = z.object({
  action: z.enum(['retry', 'cancel']),
  pipelineIds: z
    .array(
      z.object({
        projectId: z.number().int().positive(),
        pipelineId: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(50),
});

export const POST: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) return new Response('Unauthorized', { status: 401 });
  if (access.type === 'preview') {
    return new Response(JSON.stringify({ error: 'Bulk actions require sign-in.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = BulkActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const body = parsed.data;
  const token = access.token;

  const results = await Promise.allSettled(
    body.pipelineIds.map(({ projectId, pipelineId }) =>
      defaultQueue.enqueue(async () => {
        const endpoint =
          body.action === 'retry'
            ? `/projects/${projectId}/pipelines/${pipelineId}/retry`
            : `/projects/${projectId}/pipelines/${pipelineId}/cancel`;

        const res = await fetch(`${GITLAB_URL}/api/v4${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          // Throw with .status so ApiQueue can apply backoff on 429/5xx
          throw new HttpError(res.status, `HTTP ${res.status}`);
        }

        return { projectId, pipelineId };
      }),
    ),
  );

  const done = results.filter((r) => r.status === 'fulfilled').length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => String((r.reason as Error).message));

  return new Response(
    JSON.stringify({ total: results.length, done, failed: errors.length, errors }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
