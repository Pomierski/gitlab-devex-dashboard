import { useState } from 'react';
import { RotateCcw, XCircle, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { BulkActionType, BulkActionProgress, PipelineRow } from '@/types/gitlab';

interface Props {
  selected: PipelineRow[];
  onClear: () => void;
}

const IDLE: BulkActionProgress = { total: 0, done: 0, failed: 0, errors: [], running: false };

export function BulkActionBar({ selected, onClear }: Props) {
  const [progress, setProgress] = useState<BulkActionProgress>(IDLE);

  if (selected.length === 0) return null;

  async function execute(action: BulkActionType) {
    setProgress({ total: selected.length, done: 0, failed: 0, errors: [], running: true });

    const res = await fetch('/api/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        pipelineIds: selected.map((p) => ({ projectId: p.projectId, pipelineId: p.id })),
      }),
    });

    if (res.ok) {
      const result = await res.json();
      setProgress({ ...result, running: false });
      if (result.failed > 0) toast.error(`${result.failed} pipeline(s) failed to ${action}.`);
      else
        toast.success(`${result.done} pipeline(s) ${action === 'retry' ? 'retried' : 'canceled'}.`);
    } else {
      setProgress((p) => ({
        ...p,
        running: false,
        failed: p.total,
        errors: [`HTTP ${res.status}`],
      }));
      toast.error(`Bulk action failed: HTTP ${res.status}`);
    }

    setTimeout(() => {
      setProgress(IDLE);
      onClear();
    }, 3000);
  }

  const isDone = !progress.running && progress.total > 0;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-2xl">
      <span className="text-sm font-medium">
        {selected.length} pipeline{selected.length > 1 ? 's' : ''} selected
      </span>

      {progress.running ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Processing…
        </div>
      ) : isDone ? (
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-green-400" />
            <span className="text-green-400">{progress.done} done</span>
            {progress.failed > 0 && (
              <span className="text-red-400 ml-1">{progress.failed} failed</span>
            )}
          </div>
          {progress.errors[0] && (
            <span className="text-red-400/80 text-[11px]">{progress.errors[0]}</span>
          )}
        </div>
      ) : (
        <>
          <button
            onClick={() => execute('retry')}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry All
          </button>
          <button
            onClick={() => execute('cancel')}
            className="flex items-center gap-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel All
          </button>
        </>
      )}

      <button
        onClick={onClear}
        className="ml-1 text-muted-foreground hover:text-foreground text-xs underline"
      >
        Deselect
      </button>

      {/* Progress bar */}
      {progress.running && (
        <div
          className="absolute bottom-0 left-0 h-0.5 rounded-b-xl bg-primary transition-all"
          style={{ width: `${(progress.done / progress.total) * 100}%` }}
        />
      )}
    </div>
  );
}
