import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { buildFailureChartData } from '@/lib/chartAdapters';
import type { AnalyticsSummary } from '@/types/gitlab';

ChartJS.register(ArcElement, Tooltip, Legend);

const OPTIONS = {
  responsive: true,
  plugins: { legend: { position: 'right' as const } },
} as const;

export function JobFailureChart({ summary }: { summary: AnalyticsSummary }) {
  if (summary.topFailingJobs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No failures</p>;
  }
  return <Doughnut data={buildFailureChartData(summary)} options={OPTIONS} />;
}
