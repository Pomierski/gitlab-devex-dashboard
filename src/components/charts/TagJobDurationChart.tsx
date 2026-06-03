import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { TagJobDuration } from '@/types/gitlab';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const OPTIONS = {
  responsive: true,
  indexAxis: 'y' as const,
  plugins: { legend: { display: false } },
  scales: { x: { title: { display: true, text: 'Avg Duration (s)' } } },
} as const;

export function TagJobDurationChart({ data }: { data: TagJobDuration[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No tag pipeline data</p>;
  }

  const chartData = {
    labels: data.map((d) => `${d.tag} › ${d.jobName}`),
    datasets: [
      {
        data: data.map((d) => d.avgDuration),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
    ],
  };

  return <Bar data={chartData} options={OPTIONS} />;
}
