import type { ChartData } from 'chart.js';
import type { AnalyticsSummary } from '@/types/gitlab';

export function buildDurationChartData(
  summary: AnalyticsSummary,
): ChartData<'line', number[], string> {
  return {
    labels: summary.durationTrend.map((d) => d.date),
    datasets: [
      {
        label: 'Avg Duration (min)',
        data: summary.durationTrend.map((d) => +(d.avgDuration / 60).toFixed(1)),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };
}

export function buildFailureChartData(
  summary: AnalyticsSummary,
): ChartData<'doughnut', number[], string> {
  return {
    labels: summary.topFailingJobs.map((j) => `${j.stage}: ${j.jobName}`),
    datasets: [
      {
        data: summary.topFailingJobs.map((j) => j.count),
        backgroundColor: [
          '#ef4444',
          '#f97316',
          '#eab308',
          '#22c55e',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#14b8a6',
          '#f59e0b',
          '#6366f1',
        ],
        borderWidth: 1,
      },
    ],
  };
}

export function buildSuccessRatioChartData(
  summary: AnalyticsSummary,
): ChartData<'doughnut', number[], string> {
  const items = [
    { label: 'Success', count: summary.success, color: '#22c55e' },
    { label: 'Failed', count: summary.failed, color: '#ef4444' },
    { label: 'Canceled', count: summary.canceled, color: '#9ca3af' },
    { label: 'Running', count: summary.running, color: '#3b82f6' },
  ];
  return {
    labels: items.map((i) => `${i.label} (${i.count})`),
    datasets: [
      {
        data: items.map((i) => i.count),
        backgroundColor: items.map((i) => i.color),
        borderWidth: 0,
      },
    ],
  };
}
