import { AlertTriangle, XCircle, Clock } from 'lucide-react';
import type { TelemetryState } from '@/hooks/useTelemetryWorker';

function formatMs(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return m > 0 ? `${m}m ${Math.floor((ms % 60_000) / 1000)}s` : `${Math.floor(ms / 1000)}s`;
}

export function RunnerTelemetry({ telemetry }: { telemetry: TelemetryState }) {
  const { bottlenecks, fingerprints } = telemetry;

  return (
    <div className="space-y-6">
      {/* Runner bottlenecks */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Shared Runner Bottlenecks</h3>
        {bottlenecks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No runner starvation detected.</p>
        ) : (
          <div className="space-y-2">
            {bottlenecks.map((b) => (
              <div
                key={b.projectId}
                className="flex items-center justify-between rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  <span className="text-sm font-medium">{b.projectName}</span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <span className="text-yellow-300 font-mono">{formatMs(b.avgPendingMs)}</span>
                  <span className="ml-2">avg wait · {b.pendingCount} queued</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Log fingerprints */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Incident Fingerprints</h3>
        {fingerprints.length === 0 ? (
          <p className="text-xs text-muted-foreground">No correlated error patterns found.</p>
        ) : (
          <div className="space-y-2">
            {fingerprints.map((f) => (
              <div
                key={f.pattern}
                className={`rounded-md border px-3 py-2 ${
                  f.severity === 'critical'
                    ? 'border-red-500/30 bg-red-500/10'
                    : 'border-yellow-500/30 bg-yellow-500/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {f.severity === 'critical' ? (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium">{f.pattern}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{f.count}×</span>
                </div>
                <p className="text-xs text-muted-foreground pl-5 truncate">
                  Affecting: {f.affectedProjects.slice(0, 5).join(', ')}
                  {f.affectedProjects.length > 5 && ` +${f.affectedProjects.length - 5} more`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
