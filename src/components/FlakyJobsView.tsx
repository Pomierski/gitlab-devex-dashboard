import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { FlakyJob } from '@/types/gitlab';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const FlakyJobSchema = z.object({
  projectId: z.number(),
  projectName: z.string(),
  jobName: z.string(),
  stage: z.string(),
  ref: z.string(),
  totalRuns: z.number(),
  failedRuns: z.number(),
  flakeRate: z.number(),
  lastFailedAt: z.string(),
  lastSuccessAt: z.string(),
});

const FlakyJobsResponseSchema = z.array(FlakyJobSchema);

const CHART_OPTIONS = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { raw: unknown; dataset: { label?: string } }) => {
          const v = Number(ctx.raw);
          return `${ctx.dataset.label ?? ''}: ${(v * 100).toFixed(1)}%`;
        },
      },
    },
  },
  scales: {
    x: {
      min: 0,
      max: 1,
      ticks: { callback: (v: string | number) => `${Number(v) * 100}%` },
      title: { display: true, text: 'Flake rate' },
    },
  },
} as const;

function buildChartData(jobs: FlakyJob[]) {
  const top = jobs.slice(0, 10);
  return {
    labels: top.map((j) => `${j.projectName} · ${j.jobName} (${j.ref})`),
    datasets: [
      {
        label: 'Flake rate',
        data: top.map((j) => j.flakeRate),
        backgroundColor: top.map((j) =>
          j.flakeRate >= 0.5 ? '#ef4444' : j.flakeRate >= 0.25 ? '#f97316' : '#eab308',
        ),
        borderWidth: 0,
      },
    ],
  };
}

import { formatDistanceToNow } from 'date-fns';

function formatRelative(iso: string): string {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function FlakyJobsView() {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const {
    data: jobs,
    isLoading: loading,
    isError: error,
  } = useQuery<FlakyJob[]>({
    queryKey: ['flaky-jobs', days],
    queryFn: async () => {
      const res = await fetch(`/api/flaky-jobs?days=${days}`);
      if (res.status === 401) {
        window.location.href = '/auth/login';
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch');
      return FlakyJobsResponseSchema.parse(await res.json());
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Flaky jobs</h2>
          <p className="text-xs text-muted-foreground">
            Jobs that pass and fail on the same ref — the worst kind of CI noise.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Window:</span>
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 rounded border transition-colors ${
                days === d
                  ? 'bg-accent border-accent-foreground/20 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && !jobs && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">Failed to load flaky job data.</p>}

      {jobs && jobs.length === 0 && !loading && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No flaky jobs detected in the last {days} days. 🎉
          </p>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Top 10 by flake rate</h3>
            <div className="h-80">
              <Bar data={buildChartData(jobs)} options={CHART_OPTIONS} />
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Ref</th>
                  <th className="px-3 py-2 text-right">Flake rate</th>
                  <th className="px-3 py-2 text-right">Runs</th>
                  <th className="px-3 py-2 text-right">Last fail</th>
                  <th className="px-3 py-2 text-right">Last pass</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr
                    key={`${j.projectId}-${j.ref}-${j.jobName}`}
                    className="border-t border-border hover:bg-accent/30"
                  >
                    <td className="px-3 py-2">{j.projectName}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <span className="text-muted-foreground">{j.stage}:</span> {j.jobName}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{j.ref}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={
                          j.flakeRate >= 0.5
                            ? 'text-red-400'
                            : j.flakeRate >= 0.25
                              ? 'text-orange-400'
                              : 'text-yellow-500'
                        }
                      >
                        {(j.flakeRate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {j.failedRuns}/{j.totalRuns}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                      {formatRelative(j.lastFailedAt)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                      {formatRelative(j.lastSuccessAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
