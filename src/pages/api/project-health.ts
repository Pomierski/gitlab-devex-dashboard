import type { APIRoute } from 'astro';
import { getAccessMode } from '@/lib/session';
import { fetchProjects, isUnauthorized } from '@/lib/gitlabService';
import type { ProjectHealth } from '@/types/gitlab';

const GITLAB_URL = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';

export const GET: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) return new Response('Unauthorized', { status: 401 });

  const token = access.type === 'authed' ? access.token : undefined;
  const extraPaths = access.type === 'preview' ? access.extraProjects : [];

  let projects;
  try {
    projects = await fetchProjects(token, { extraPaths });
  } catch (e) {
    if (isUnauthorized(e)) return new Response('Unauthorized', { status: 401 });
    throw e;
  }

  // Fetch last 20 pipelines per project in parallel (capped at 30 projects for perf)
  const sample = projects.slice(0, 30);

  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const results = await Promise.all(
    sample.map(async (proj): Promise<ProjectHealth> => {
      try {
        const url = new URL(`${GITLAB_URL}/api/v4/projects/${proj.id}/pipelines`);
        url.searchParams.set('per_page', '20');
        url.searchParams.set('order_by', 'updated_at');
        const res = await fetch(url.toString(), { headers: authHeader });
        if (!res.ok) throw new Error();
        const pipelines: Array<{ status: string; created_at: string; finished_at: string | null }> =
          await res.json();

        const total = pipelines.length;
        const success = pipelines.filter((p) => p.status === 'success').length;
        const lastStatus = (pipelines[0]?.status ?? 'created') as ProjectHealth['lastStatus'];

        // MTTR: avg time from failure to next success
        let mttrSum = 0,
          mttrCount = 0;
        for (let i = 0; i < pipelines.length - 1; i++) {
          if (pipelines[i].status === 'failed') {
            const recovery = pipelines.slice(i + 1).find((p) => p.status === 'success');
            if (recovery?.finished_at && pipelines[i].created_at) {
              mttrSum +=
                new Date(recovery.finished_at).getTime() -
                new Date(pipelines[i].created_at).getTime();
              mttrCount++;
            }
          }
        }

        return {
          projectId: proj.id,
          projectName: proj.name,
          projectPath: proj.path_with_namespace,
          successRate: total > 0 ? success / total : 1,
          mttr: mttrCount > 0 ? Math.round(mttrSum / mttrCount / 1000) : null,
          lastStatus,
          totalRuns: total,
        };
      } catch {
        return {
          projectId: proj.id,
          projectName: proj.name,
          projectPath: proj.path_with_namespace,
          successRate: 0,
          mttr: null,
          lastStatus: 'created',
          totalRuns: 0,
        };
      }
    }),
  );

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
