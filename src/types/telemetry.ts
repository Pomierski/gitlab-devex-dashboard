// Worker protocol + derived telemetry types.
// Kept separate from `gitlab.ts` so the worker bundle does not pull in UI types
// and so the dependency graph reflects worker boundary clearly.

import type { PipelineRow } from '@/types/gitlab';

export interface RunnerBottleneck {
  projectId: number;
  projectName: string;
  avgPendingMs: number;
  pendingCount: number;
}

export interface LogFingerprint {
  pattern: string; // extracted error signature
  count: number;
  affectedProjects: string[];
  severity: 'warning' | 'critical';
}

// ── Worker message protocol ───────────────────────────────────────────────────

export type WorkerInMessage =
  | { type: 'DETECT_BOTTLENECKS'; pipelines: PipelineRow[] }
  | { type: 'FINGERPRINT_LOGS'; logs: Array<{ projectName: string; log: string }> };

export type WorkerOutMessage =
  | { type: 'BOTTLENECKS'; data: RunnerBottleneck[] }
  | { type: 'FINGERPRINTS'; data: LogFingerprint[] };
