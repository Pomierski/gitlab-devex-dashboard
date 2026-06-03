import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { ExternalLink } from 'lucide-react';

interface Props {
  projectId: number;
  jobId: number;
  jobName: string;
  jobWebUrl: string;
  open: boolean;
  onClose: () => void;
}

export function LogViewerSheet({ projectId, jobId, jobName, jobWebUrl, open, onClose }: Props) {
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLog(null);
    setError(false);
    fetch(`/api/job-log?projectId=${projectId}&jobId=${jobId}`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then(setLog)
      .catch(() => setError(true));
  }, [open, projectId, jobId]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-2xl flex-col bg-[#0d1117] shadow-2xl outline-none">
          {/* Drag handle */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <Drawer.Title className="text-sm font-semibold text-white">
                Job Log: {jobName}
              </Drawer.Title>
              <Drawer.Description className="text-xs text-white/50">
                Raw execution output
              </Drawer.Description>
            </div>
            <a
              href={jobWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white"
              title="Open in GitLab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-red-400 text-sm">Could not load log.</p>
                <a
                  href={jobWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline text-sm"
                >
                  View in GitLab ↗
                </a>
              </div>
            ) : log === null ? (
              <div className="space-y-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3 animate-pulse rounded bg-white/10"
                    style={{ width: `${40 + Math.random() * 55}%` }}
                  />
                ))}
              </div>
            ) : (
              <pre className="font-mono text-xs text-green-300 whitespace-pre-wrap break-all leading-5">
                {log}
              </pre>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
