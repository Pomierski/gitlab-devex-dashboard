import { useState, useCallback, useEffect, useRef } from 'react';
import type { PipelineFilters, PaginatedPipelines } from '@/types/gitlab';
import { DEFAULT_FILTERS } from '@/types/gitlab';

const POLL_INTERVAL_MS = 60_000;
const REFRESH_COOLDOWN_MS = 10_000;

function filtersToParams(f: PipelineFilters): string {
  const p = new URLSearchParams();
  if (f.groupIds.length) p.set('groupIds', f.groupIds.join(','));
  if (f.projectIds.length) p.set('projectIds', f.projectIds.join(','));
  if (f.statuses.length) p.set('statuses', f.statuses.join(','));
  if (f.refs.length) p.set('refs', f.refs.join(','));
  p.set('dateRange', f.dateRange);
  p.set('tagsOnly', String(f.tagsOnly));
  p.set('page', String(f.page));
  p.set('perPage', String(f.perPage));
  return p.toString();
}

export interface UsePipelineFiltersReturn {
  filters: PipelineFilters;
  setFilters: (patch: Partial<PipelineFilters>) => void;
  result: PaginatedPipelines | null;
  loading: boolean;
  lastRefreshed: Date | null;
  canRefresh: boolean;
  refresh: () => void;
}

export function usePipelineFilters(): UsePipelineFiltersReturn {
  const [filters, setFiltersState] = useState<PipelineFilters>(DEFAULT_FILTERS);
  const [result, setResult] = useState<PaginatedPipelines | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [canRefresh, setCanRefresh] = useState(true);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (f: PipelineFilters) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pipelines?${filtersToParams(f)}`);
      if (res.status === 401) {
        window.location.href = '/auth/login';
        return;
      }
      if (res.ok) {
        setResult(await res.json());
        setLastRefreshed(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const setFilters = useCallback(
    (patch: Partial<PipelineFilters>) => {
      setFiltersState((prev) => {
        // Reset to page 1 on any filter change except page itself
        const resetPage = !('page' in patch);
        const next = { ...prev, ...patch, ...(resetPage ? { page: 1 } : {}) };
        fetchData(next);
        return next;
      });
    },
    [fetchData],
  );

  const refresh = useCallback(() => {
    if (!canRefresh) return;
    setCanRefresh(false);
    fetchData(filters);
    cooldownRef.current = setTimeout(() => setCanRefresh(true), REFRESH_COOLDOWN_MS);
  }, [canRefresh, fetchData, filters]);

  // Initial fetch
  useEffect(() => {
    fetchData(filters);
  }, []); // intentionally run only on mount

  // Background polling
  useEffect(() => {
    const id = setInterval(() => fetchData(filters), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData, filters]);

  // Cleanup cooldown timer
  useEffect(
    () => () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    },
    [],
  );

  return { filters, setFilters, result, loading, lastRefreshed, canRefresh, refresh };
}
