'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardView } from '@/components/DashboardView';
import type { GitLabGroup, GitLabProject, AnalyticsSummary } from '@/types/gitlab';

interface Props {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  initialSummary: AnalyticsSummary;
  isPreview?: boolean;
  extraProjects?: string[];
}

/**
 * Single Astro hydration island for the whole dashboard. Wrapping inside a
 * React component (rather than nesting two `client:load` islands in the
 * .astro file) ensures the boundary is a real React parent of DashboardView
 * — Astro islands don't share a React tree across `client:` boundaries.
 */
export function App(props: Props) {
  return (
    <ErrorBoundary>
      <DashboardView {...props} />
    </ErrorBoundary>
  );
}
