import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package } from 'lucide-react';
import type { CiDriftEntry } from '@/types/gitlab';

function DriftRow({ entry }: { entry: CiDriftEntry }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <p className="text-sm font-medium">{entry.projectName}</p>

      {entry.outdatedIncludes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Outdated include templates
          </p>
          {entry.outdatedIncludes.map((inc) => (
            <p key={inc} className="text-xs text-muted-foreground font-mono pl-4 truncate">
              {inc}
            </p>
          ))}
        </div>
      )}

      {entry.deprecatedImages.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-orange-400 flex items-center gap-1">
            <Package className="h-3 w-3" /> Deprecated Docker images
          </p>
          {entry.deprecatedImages.map((img) => (
            <p key={img} className="text-xs text-muted-foreground font-mono pl-4 truncate">
              {img}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function CiDriftView() {
  const { data: entries, isError: error } = useQuery<CiDriftEntry[]>({
    queryKey: ['ci-drift'],
    queryFn: async () => {
      const r = await fetch('/api/ci-drift');
      if (r.status === 401) {
        window.location.href = '/auth/login';
        throw new Error('Unauthorized');
      }
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
  });

  if (error) return <p className="text-sm text-red-400">Failed to load drift data.</p>;

  if (!entries) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {entries.length === 0
          ? 'All projects are up to date.'
          : `${entries.length} project${entries.length > 1 ? 's' : ''} with CI/CD drift detected.`}
      </p>
      {entries.map((e) => (
        <DriftRow key={e.projectId} entry={e} />
      ))}
    </div>
  );
}
