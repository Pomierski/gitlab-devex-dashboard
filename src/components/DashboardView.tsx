'use client';

import { useState, lazy, Suspense } from 'react';
import { RefreshCw } from 'lucide-react';
import { FilterSidebar } from '@/components/FilterSidebar';
import { PipelineCard } from '@/components/PipelineCard';
import { AlertPanel } from '@/components/AlertPanel';
import { HealthMatrix } from '@/components/HealthMatrix';
import { RunnerTelemetry } from '@/components/RunnerTelemetry';
import { BulkActionBar } from '@/components/BulkActionBar';
import { CiDriftView } from '@/components/CiDriftView';
import { usePipelineFilters } from '@/hooks/usePipelineFilters';
import { useAnomalyDetection } from '@/hooks/useAnomalyDetection';
import { Providers } from '@/components/Providers';
import { useTelemetryWorker } from '@/hooks/useTelemetryWorker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type {
  GitLabGroup,
  GitLabProject,
  AnalyticsSummary,
  PipelineFilters,
  PipelineRow,
} from '@/types/gitlab';

const AnalyticsView = lazy(() =>
  import('@/components/AnalyticsView').then((m) => ({ default: m.AnalyticsView })),
);
const FlakyJobsView = lazy(() =>
  import('@/components/FlakyJobsView').then((m) => ({ default: m.FlakyJobsView })),
);

type Tab = 'pipelines' | 'analytics' | 'health' | 'telemetry' | 'drift' | 'flaky';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'health', label: 'Health' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'drift', label: 'CI Drift' },
  { id: 'flaky', label: 'Flaky Jobs' },
];

interface Props {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  initialSummary: AnalyticsSummary;
  isPreview?: boolean;
  extraProjects?: string[];
}

function RefreshHeader({
  lastRefreshed,
  canRefresh,
  loading,
  onRefresh,
}: {
  lastRefreshed: Date | null;
  canRefresh: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  const timeStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>Last refreshed: {timeStr}</span>
      <button
        onClick={onRefresh}
        disabled={!canRefresh || loading}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}
function PreviewBanner({ extraProjects }: { extraProjects: string[] }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addProject(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = input.trim();
    if (!/^[\w.-]+(\/[\w.-]+)+$/.test(value)) {
      setError('Use the format group/project (e.g. inkscape/inkscape).');
      return;
    }
    if (extraProjects.includes(value)) {
      setError('Already added.');
      return;
    }
    const next = [...extraProjects, value].join(',');
    document.cookie = `gl_preview_projects=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    window.location.reload();
  }

  function removeProject(path: string) {
    const next = extraProjects.filter((p) => p !== path).join(',');
    if (next) {
      document.cookie = `gl_preview_projects=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    } else {
      document.cookie = 'gl_preview_projects=; path=/; max-age=0';
    }
    window.location.reload();
  }

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <p className="text-sm font-medium text-blue-300">Preview mode</p>
          <p className="text-xs text-muted-foreground">
            Read-only against curated public GitLab.com projects.{' '}
            <a href="/auth/exit-preview" className="text-blue-300 underline hover:text-blue-200">
              Sign in
            </a>{' '}
            to see your own.
          </p>
        </div>

        <form onSubmit={addProject} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="group/project"
            className="rounded border border-border bg-background px-2 py-1 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}

      {extraProjects.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {extraProjects.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px]"
            >
              {p}
              <button
                onClick={() => removeProject(p)}
                className="text-muted-foreground hover:text-red-400"
                aria-label={`Remove ${p}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  perPage,
  loading = false,
  onPageChange,
  onPerPageChange,
}: {
  page: number;
  totalPages: number;
  perPage: PipelineFilters['perPage'];
  loading?: boolean;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: PipelineFilters['perPage']) => void;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Rows per page:</span>
        <Select
          value={String(perPage)}
          onValueChange={(v) => onPerPageChange(Number(v) as PipelineFilters['perPage'])}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {([20, 50, 100] as const).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1}
          className="px-2 py-1 text-xs rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        <span className="px-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
          {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
          {page} / {totalPages || 1}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page >= totalPages}
          className="px-2 py-1 text-xs rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export function DashboardView({
  groups,
  projects,
  initialSummary,
  isPreview = false,
  extraProjects = [],
}: Props) {
  const { filters, setFilters, result, loading, lastRefreshed, canRefresh, refresh } =
    usePipelineFilters();
  const [tab, setTab] = useState<Tab>('pipelines');
  const [selected, setSelected] = useState<PipelineRow[]>([]);

  const pipelines = result?.rows ?? [];
  const alerts = useAnomalyDetection(pipelines);
  const { telemetry } = useTelemetryWorker(pipelines);

  function toggleSelect(p: PipelineRow) {
    setSelected((prev) =>
      prev.some((s) => s.id === p.id && s.projectId === p.projectId)
        ? prev.filter((s) => !(s.id === p.id && s.projectId === p.projectId))
        : [...prev, p],
    );
  }

  return (
    <Providers>
      <div className="flex gap-4">
        <div className="hidden lg:block">
          <FilterSidebar
            groups={groups}
            projects={projects}
            filters={filters}
            onChange={setFilters}
          />
        </div>

        <main className="flex-1 min-w-0 space-y-4">
          {isPreview && <PreviewBanner extraProjects={extraProjects} />}

          {/* Refresh meta — own row so tabs never wrap fighting for space */}
          <div className="flex justify-end">
            <RefreshHeader
              lastRefreshed={lastRefreshed}
              canRefresh={canRefresh}
              loading={loading}
              onRefresh={refresh}
            />
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 flex-wrap border-b border-border pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'pipelines' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {result ? `${result.total} total pipelines` : 'Loading…'}
                </p>
                {selected.length > 0 && (
                  <p className="text-xs text-primary">{selected.length} selected</p>
                )}
              </div>

              {loading && pipelines.length === 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : pipelines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  No pipelines match the current filters.
                </p>
              ) : (
                <div
                  className={`space-y-3 transition-opacity ${
                    loading ? 'opacity-50 pointer-events-none' : 'opacity-100'
                  }`}
                  aria-busy={loading}
                >
                  {pipelines.map((p) => (
                    <div
                      key={`${p.projectId}-${p.id}`}
                      className={`relative rounded-lg transition-colors ${
                        selected.some((s) => s.id === p.id) ? 'ring-1 ring-primary' : ''
                      }`}
                    >
                      {/* Checkbox overlay — only when bulk actions are enabled (not preview) */}
                      {!isPreview && (
                        <input
                          type="checkbox"
                          checked={selected.some((s) => s.id === p.id)}
                          onChange={() => toggleSelect(p)}
                          className="absolute left-2 top-4 z-10 h-3.5 w-3.5 cursor-pointer accent-primary"
                          aria-label={`Select pipeline ${p.id}`}
                        />
                      )}
                      <div className={isPreview ? '' : 'pl-6'}>
                        <PipelineCard pipeline={p} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Pagination
                page={filters.page}
                totalPages={result?.totalPages ?? 1}
                perPage={filters.perPage}
                loading={loading}
                onPageChange={(p) => setFilters({ page: p })}
                onPerPageChange={(n) => setFilters({ perPage: n })}
              />
            </>
          )}

          {tab === 'analytics' && (
            <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
              <AnalyticsView summary={initialSummary} />
            </Suspense>
          )}

          {tab === 'health' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Global Health Matrix</h2>
              <HealthMatrix />
            </div>
          )}

          {tab === 'telemetry' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Infrastructure Telemetry</h2>
              <RunnerTelemetry telemetry={telemetry} />
            </div>
          )}

          {tab === 'drift' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">CI/CD Config Drift</h2>
              <CiDriftView />
            </div>
          )}

          {tab === 'flaky' && (
            <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
              <FlakyJobsView />
            </Suspense>
          )}
        </main>

        <div className="hidden lg:block">
          <AlertPanel alerts={alerts} />
        </div>

        {/* Floating bulk action bar — only in authed mode */}
        {!isPreview && <BulkActionBar selected={selected} onClear={() => setSelected([])} />}
      </div>
    </Providers>
  );
}
