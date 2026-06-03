import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, X, Bell } from 'lucide-react';
import type { AnomalyAlert } from '@/hooks/useAnomalyDetection';

interface Props {
  alerts: AnomalyAlert[];
}

export function AlertPanel({ alerts }: Props) {
  // Default-collapsed when empty so it doesn't crowd the layout
  const [collapsed, setCollapsed] = useState(alerts.length === 0);

  // If new alerts arrive while collapsed, auto-expand once.
  // (Wrapped in effect so it's not a setState during render.)
  useEffect(() => {
    if (alerts.length > 0) setCollapsed(false);
  }, [alerts.length]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="group relative flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        aria-label={`Expand alerts (${alerts.length})`}
        title={
          alerts.length === 0
            ? 'No anomalies'
            : `${alerts.length} alert${alerts.length > 1 ? 's' : ''}`
        }
      >
        <Bell
          className={`h-4 w-4 ${
            criticalCount > 0
              ? 'text-red-400'
              : alerts.length > 0
                ? 'text-yellow-400'
                : 'text-muted-foreground'
          }`}
        />
        {criticalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {criticalCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex w-64 shrink-0 flex-col self-start rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bell
          className={`h-3.5 w-3.5 ${criticalCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}
        />
        <span className="text-xs font-semibold">Alerts</span>
        {alerts.length > 0 && (
          <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
            {alerts.length}
          </span>
        )}
        <button
          onClick={() => setCollapsed(true)}
          className="ml-auto text-muted-foreground hover:text-foreground"
          aria-label="Collapse alerts"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[calc(100vh-200px)] overflow-y-auto divide-y divide-border">
        {alerts.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            No anomalies detected.
          </p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="px-3 py-2.5 space-y-0.5">
              <div className="flex items-center gap-1.5">
                {alert.severity === 'critical' ? (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                )}
                <span className="text-xs font-medium truncate">{alert.projectName}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug pl-5">{alert.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
