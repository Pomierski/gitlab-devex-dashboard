import type { APIRoute } from 'astro';
import { getAccessMode } from '@/lib/session';
import { fetchProjects, isUnauthorized } from '@/lib/gitlabService';
import type { CiDriftEntry } from '@/types/gitlab';

const GITLAB_URL = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';

// Patterns considered deprecated/drifted
const DEPRECATED_IMAGE_PATTERNS = [
  /:latest$/,
  /alpine:3\.[0-7]\./,
  /node:1[0-6][-\s]/,
  /python:3\.[0-7][-\s]/,
];
const CANONICAL_INCLUDE_HOST = import.meta.env.GITLAB_URL ?? 'https://gitlab.com';

async function fetchYaml(token: string | undefined, projectId: number): Promise<string | null> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(
    `${GITLAB_URL}/api/v4/projects/${projectId}/repository/files/.gitlab-ci.yml/raw?ref=HEAD`,
    { headers },
  );
  return res.ok ? res.text() : null;
}

function extractIncludes(yaml: string): string[] {
  const matches = yaml.match(/include:\s*\n([\s\S]*?)(?=\n\w|\n#|$)/g) ?? [];
  const refs: string[] = [];
  for (const block of matches) {
    const projectRefs = block.match(/project:\s*['"]?([^'"\n]+)/g) ?? [];
    refs.push(...projectRefs.map((r) => r.replace(/project:\s*['"]?/, '').trim()));
    const fileRefs = block.match(/file:\s*['"]?([^'"\n]+)/g) ?? [];
    refs.push(...fileRefs.map((r) => r.replace(/file:\s*['"]?/, '').trim()));
  }
  return refs;
}

function extractImages(yaml: string): string[] {
  return (yaml.match(/image:\s*['"]?([^\s'"#\n]+)/g) ?? []).map((m) =>
    m.replace(/image:\s*['"]?/, '').trim(),
  );
}

export const GET: APIRoute = async ({ request }) => {
  const response = new Response();
  const access = await getAccessMode(request, response);
  if (!access) return new Response('Unauthorized', { status: 401 });

  const token = access.type === 'authed' ? access.token : undefined;
  const extraPaths = access.type === 'preview' ? access.extraProjects : [];

  let projects;
  try {
    projects = (await fetchProjects(token, { extraPaths })).slice(0, 20);
  } catch (e) {
    if (isUnauthorized(e)) return new Response('Unauthorized', { status: 401 });
    throw e;
  }

  const entries = (
    await Promise.all(
      projects.map(async (proj): Promise<CiDriftEntry | null> => {
        const yaml = await fetchYaml(token, proj.id);
        if (!yaml) return null;

        const includes = extractIncludes(yaml);
        const images = extractImages(yaml);

        const outdatedIncludes = includes.filter(
          (inc) => inc.includes('template') && !inc.includes(CANONICAL_INCLUDE_HOST),
        );
        const deprecatedImages = images.filter((img) =>
          DEPRECATED_IMAGE_PATTERNS.some((re) => re.test(img)),
        );

        if (outdatedIncludes.length === 0 && deprecatedImages.length === 0) return null;

        return {
          projectId: proj.id,
          projectName: proj.name,
          outdatedIncludes,
          deprecatedImages,
        };
      }),
    )
  ).filter((e): e is CiDriftEntry => e !== null);

  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' },
  });
};
