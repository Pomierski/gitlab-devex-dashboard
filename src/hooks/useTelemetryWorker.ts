import { useEffect, useRef, useState, useCallback } from 'react';
import type { PipelineRow } from '@/types/gitlab';
import type { RunnerBottleneck, LogFingerprint, WorkerOutMessage } from '@/types/telemetry';

export interface TelemetryState {
  bottlenecks: RunnerBottleneck[];
  fingerprints: LogFingerprint[];
}

export function useTelemetryWorker(pipelines: PipelineRow[]): {
  telemetry: TelemetryState;
  submitLogs: (logs: Array<{ projectName: string; log: string }>) => void;
} {
  const workerRef = useRef<Worker | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryState>({ bottlenecks: [], fingerprints: [] });

  // Initialise worker once on mount (client-only)
  useEffect(() => {
    const worker = new Worker(new URL('../workers/telemetry.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'BOTTLENECKS') {
        setTelemetry((prev) => ({ ...prev, bottlenecks: msg.data }));
      } else if (msg.type === 'FINGERPRINTS') {
        setTelemetry((prev) => ({ ...prev, fingerprints: msg.data }));
      }
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Re-run bottleneck detection whenever pipelines change
  useEffect(() => {
    workerRef.current?.postMessage({ type: 'DETECT_BOTTLENECKS', pipelines });
  }, [pipelines]);

  const submitLogs = useCallback((logs: Array<{ projectName: string; log: string }>) => {
    workerRef.current?.postMessage({ type: 'FINGERPRINT_LOGS', logs });
  }, []);

  return { telemetry, submitLogs };
}
