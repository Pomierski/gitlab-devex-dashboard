import type { AnalyticsSummary } from '@/types/gitlab';

interface MetricProps {
  label: string;
  value: number | string;
  colorClass?: string;
}

function Metric({ label, value, colorClass = 'text-foreground' }: MetricProps) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function pct(n: number, total: number) {
  return total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
}

export function MetricSummaryWidget({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Metric label="Total Pipelines" value={summary.total} />
      <Metric
        label="Success Rate"
        value={pct(summary.success, summary.total)}
        colorClass="text-green-600"
      />
      <Metric
        label="Failure Rate"
        value={pct(summary.failed, summary.total)}
        colorClass="text-red-600"
      />
      <Metric label="Currently Running" value={summary.running} colorClass="text-blue-600" />
    </div>
  );
}
