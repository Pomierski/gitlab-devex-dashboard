/// <reference lib="webworker" />
import type { PipelineRow } from '@/types/gitlab';
import type {
  WorkerInMessage,
  WorkerOutMessage,
  RunnerBottleneck,
  LogFingerprint,
} from '@/types/telemetry';

// ── Bottleneck detection ──────────────────────────────────────────────────────
// Correlates pending pipelines across projects to surface shared runner starvation.

const PENDING_SPIKE_THRESHOLD = 3;

function detectBottlenecks(pipelines: PipelineRow[]): RunnerBottleneck[] {
  const byProject = new Map<number, { name: string; pendingMs: number[]; count: number }>();

  const now = Date.now();
  for (const p of pipelines) {
    if (p.status !== 'pending' && p.status !== 'waiting_for_resource') continue;
    const pendingMs = now - new Date(p.createdAt).getTime();
    const entry = byProject.get(p.projectId) ?? { name: p.projectName, pendingMs: [], count: 0 };
    entry.pendingMs.push(pendingMs);
    entry.count++;
    byProject.set(p.projectId, entry);
  }

  const bottlenecks: RunnerBottleneck[] = [];
  for (const [projectId, { name, pendingMs, count }] of byProject) {
    if (count < PENDING_SPIKE_THRESHOLD) continue;
    const avg = pendingMs.reduce((s, v) => s + v, 0) / pendingMs.length;
    bottlenecks.push({
      projectId,
      projectName: name,
      avgPendingMs: Math.round(avg),
      pendingCount: count,
    });
  }

  return bottlenecks.sort((a, b) => b.avgPendingMs - a.avgPendingMs);
}

// ── Log fingerprinting ────────────────────────────────────────────────────────
// Extracts error signatures from raw logs and groups identical patterns.

const ERROR_PATTERNS: Array<{ re: RegExp; label: string; severity: LogFingerprint['severity'] }> = [
  { re: /EAI_AGAIN|ENOTFOUND|getaddrinfo/i, label: 'DNS resolution failure', severity: 'critical' },
  { re: /connection refused|ECONNREFUSED/i, label: 'Connection refused', severity: 'critical' },
  {
    re: /401 unauthorized|authentication required/i,
    label: '401 Unauthorized (registry/API)',
    severity: 'critical',
  },
  { re: /403 forbidden/i, label: '403 Forbidden', severity: 'warning' },
  { re: /timeout|ETIMEDOUT/i, label: 'Network timeout', severity: 'warning' },
  { re: /no space left on device/i, label: 'Disk full on runner', severity: 'critical' },
  {
    re: /pull access denied|manifest unknown/i,
    label: 'Docker image pull failure',
    severity: 'critical',
  },
  { re: /exit code [1-9]\d*/i, label: 'Non-zero exit code', severity: 'warning' },
];

function fingerprintLogs(logs: Array<{ projectName: string; log: string }>): LogFingerprint[] {
  const acc = new Map<
    string,
    { count: number; projects: Set<string>; severity: LogFingerprint['severity'] }
  >();

  for (const { projectName, log } of logs) {
    for (const { re, label, severity } of ERROR_PATTERNS) {
      if (!re.test(log)) continue;
      const entry = acc.get(label) ?? { count: 0, projects: new Set(), severity };
      entry.count++;
      entry.projects.add(projectName);
      acc.set(label, entry);
    }
  }

  return Array.from(acc.entries())
    .map(([pattern, { count, projects, severity }]) => ({
      pattern,
      count,
      affectedProjects: Array.from(projects),
      severity,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  let out: WorkerOutMessage;

  if (msg.type === 'DETECT_BOTTLENECKS') {
    out = { type: 'BOTTLENECKS', data: detectBottlenecks(msg.pipelines) };
  } else {
    out = { type: 'FINGERPRINTS', data: fingerprintLogs(msg.logs) };
  }

  self.postMessage(out);
};
