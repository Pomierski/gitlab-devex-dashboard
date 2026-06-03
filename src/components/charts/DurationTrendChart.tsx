import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { buildDurationChartData } from '@/lib/chartAdapters';
import type { AnalyticsSummary } from '@/types/gitlab';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const OPTIONS = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    y: { title: { display: true, text: 'Minutes' } },
  },
} as const;

export function DurationTrendChart({ summary }: { summary: AnalyticsSummary }) {
  if (summary.durationTrend.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  }
  return <Line data={buildDurationChartData(summary)} options={OPTIONS} />;
}
