import { useMemo } from 'react';
import type { PipelineRow } from '@/types/gitlab';

export type AlertSeverity = 'warning' | 'critical';

export interface AnomalyAlert {
  id: string;
  severity: AlertSeverity;
  projectName: string;
  message: string;
}

const SPIKE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SPIKE_THRESHOLD = 3; // consecutive failures
const STUCK_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes

export function useAnomalyDetection(pipelines: PipelineRow[]): AnomalyAlert[] {
  return useMemo(() => {
    const alerts: AnomalyAlert[] = [];
    const now = Date.now();

    // Group by project
    const byProject = new Map<number, PipelineRow[]>();
    for (const p of pipelines) {
      const list = byProject.get(p.projectId) ?? [];
      list.push(p);
      byProject.set(p.projectId, list);
    }

    for (const [projectId, rows] of byProject) {
      const projectName = rows[0].projectName;

      // ── Spike detection ──────────────────────────────────────────────────
      const recentFailed = rows.filter(
        (r) => r.status === 'failed' && now - new Date(r.createdAt).getTime() < SPIKE_WINDOW_MS,
      );

      if (recentFailed.length >= SPIKE_THRESHOLD) {
        alerts.push({
          id: `spike-${projectId}`,
          severity: 'critical',
          projectName,
          message: `${recentFailed.length} pipelines failed in the last 15 minutes.`,
        });
      }

      // ── Stuck job detection ──────────────────────────────────────────────
      const stuck = rows.filter((r) => {
        if (r.status !== 'running' && r.status !== 'pending') return false;
        return now - new Date(r.createdAt).getTime() > STUCK_THRESHOLD_MS;
      });

      if (stuck.length > 0) {
        alerts.push({
          id: `stuck-${projectId}`,
          severity: 'warning',
          projectName,
          message: `${stuck.length} pipeline${stuck.length > 1 ? 's' : ''} stuck in ${stuck[0].status} for >45 min.`,
        });
      }
    }

    return alerts;
  }, [pipelines]);
}
