import { useQuery } from '@tanstack/react-query';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';
import type { ProjectHealth } from '@/types/gitlab';

function successColor(rate: number): string {
  if (rate >= 0.95) return 'bg-green-500';
  if (rate >= 0.8) return 'bg-yellow-500';
  if (rate >= 0.5) return 'bg-orange-500';
  return 'bg-red-500';
}

function formatMttr(s: number | null): string {
  if (s == null) return 'N/A';
  const m = Math.floor(s / 60);
  return m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function HealthCell({ project }: { project: ProjectHealth }) {
  const label = [
    project.projectName,
    `Success: ${Math.round(project.successRate * 100)}%`,
    `MTTR: ${formatMttr(project.mttr)}`,
    `Runs: ${project.totalRuns}`,
    `Last: ${project.lastStatus}`,
  ].join('\n');

  return (
    <Tooltip label={label} side="top">
      <a
        href={`https://gitlab.com/${project.projectPath}/-/pipelines`}
        target="_blank"
        rel="noopener noreferrer"
        className={`block h-8 w-8 rounded-sm ${successColor(project.successRate)} opacity-80 hover:opacity-100 hover:scale-110 transition-all cursor-pointer`}
        aria-label={project.projectName}
      />
    </Tooltip>
  );
}

export function HealthMatrix() {
  const { data: health, isError: error } = useQuery<ProjectHealth[]>({
    queryKey: ['project-health'],
    queryFn: async () => {
      const r = await fetch('/api/project-health');
      if (r.status === 401) {
        window.location.href = '/auth/login';
        throw new Error('Unauthorized');
      }
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
  });

  if (error) return <p className="text-sm text-red-400">Failed to load health data.</p>;

  if (!health) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-8 w-8 animate-pulse rounded-sm bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-green-500 inline-block" /> ≥95%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-yellow-500 inline-block" /> 80–95%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-orange-500 inline-block" /> 50–80%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-red-500 inline-block" /> &lt;50%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {health.map((p) => (
            <HealthCell key={p.projectId} project={p} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {health.length} projects · hover for details
        </p>
      </div>
    </TooltipProvider>
  );
}
