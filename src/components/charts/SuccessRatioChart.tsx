import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { buildSuccessRatioChartData } from '@/lib/chartAdapters';
import type { AnalyticsSummary } from '@/types/gitlab';

ChartJS.register(ArcElement, Tooltip, Legend);

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: {
      position: 'right' as const,
      align: 'center' as const,
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        padding: 8,
        font: { size: 11 },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { label: string; parsed: number; dataset: { data: number[] } }) => {
          const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
          return `${ctx.label} — ${pct}%`;
        },
      },
    },
  },
} as const;

export function SuccessRatioChart({ summary }: { summary: AnalyticsSummary }) {
  const total = summary.success + summary.failed + summary.canceled + summary.running;
  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  }
  return (
    <div className="h-48">
      <Doughnut data={buildSuccessRatioChartData(summary)} options={OPTIONS} />
    </div>
  );
}
