import { MetricSummaryWidget } from '@/components/MetricSummaryWidget';
import { DurationTrendChart } from '@/components/charts/DurationTrendChart';
import { JobFailureChart } from '@/components/charts/JobFailureChart';
import { SuccessRatioChart } from '@/components/charts/SuccessRatioChart';
import { TagJobDurationChart } from '@/components/charts/TagJobDurationChart';
import type { AnalyticsSummary } from '@/types/gitlab';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function AnalyticsView({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="space-y-6">
      <MetricSummaryWidget summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Average Pipeline Duration (successful runs)">
            <DurationTrendChart summary={summary} />
          </ChartCard>
        </div>
        <ChartCard title="Success vs Failure Ratio">
          <SuccessRatioChart summary={summary} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Failing Jobs">
          <JobFailureChart summary={summary} />
        </ChartCard>
        <ChartCard title="Tag / Release Job Durations">
          <TagJobDurationChart data={summary.tagJobDurations} />
        </ChartCard>
      </div>
    </div>
  );
}
