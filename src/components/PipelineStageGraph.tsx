import { useState, useEffect, useRef } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';
import { toStageNodes, type PipelineStageNode } from '@/lib/stageTransformer';
import type { GitLabJob, PipelineStatus } from '@/types/gitlab';

const STATUS_COLOR: Record<PipelineStatus, string> = {
  success: 'border-green-500 bg-green-500/10 text-green-400',
  failed: 'border-red-500 bg-red-500/10 text-red-400',
  running: 'border-blue-500 bg-blue-500/10 text-blue-400',
  pending: 'border-yellow-500 bg-yellow-500/10 text-yellow-400',
  canceled: 'border-zinc-500 bg-zinc-500/10 text-zinc-400',
  created: 'border-zinc-600 bg-zinc-600/10 text-zinc-400',
  waiting_for_resource: 'border-zinc-600 bg-zinc-600/10 text-zinc-400',
  preparing: 'border-zinc-600 bg-zinc-600/10 text-zinc-400',
  skipped: 'border-zinc-600 bg-zinc-600/10 text-zinc-400',
  manual: 'border-purple-500 bg-purple-500/10 text-purple-400',
  scheduled: 'border-purple-500 bg-purple-500/10 text-purple-400',
};

function formatDur(s: number | null): string | null {
  if (!s) return null;
  const sec = Math.max(0, Math.round(s));
  const m = Math.floor(sec / 60);
  return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`;
}

function JobNode({ job }: { job: PipelineStageNode['jobs'][number] }) {
  const dur = formatDur(job.duration);

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-semibold text-white">{job.name}</div>
      <div className="text-white/70 text-[11px]">
        Status: {job.status}
        {dur && <> · Duration: {dur}</>}
      </div>
      {job.failureReason && (
        <>
          <div className="my-1.5 border-t border-white/10" />
          <div className="text-[11px] uppercase tracking-wide text-red-300/80">Failure reason</div>
          <div className="text-red-300">{job.failureReason}</div>
        </>
      )}
    </div>
  );

  return (
    <Tooltip label={tooltipContent} side="top">
      <a
        href={job.webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex flex-col items-stretch rounded border px-2 py-1 max-w-[140px] hover:opacity-80 transition-opacity ${STATUS_COLOR[job.status]}`}
      >
        <div className="flex items-center gap-1">
          {job.status === 'failed' && <AlertCircle className="h-2.5 w-2.5 shrink-0" />}
          {job.status === 'running' && <Clock className="h-2.5 w-2.5 shrink-0 animate-pulse" />}
          <span className="truncate text-[11px] font-medium">{job.name}</span>
        </div>
        {dur && <span className="text-[9px] opacity-60 leading-none mt-0.5">{dur}</span>}
      </a>
    </Tooltip>
  );
}

function StageColumn({ node }: { node: PipelineStageNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${STATUS_COLOR[node.status].split(' ')[2]}`}
      >
        {node.stage}
      </span>
      {node.jobs.map((job) => (
        <JobNode key={job.id} job={job} />
      ))}
    </div>
  );
}

interface Props {
  projectId: number;
  pipelineId: number;
}

export function PipelineStageGraph({ projectId, pipelineId }: Props) {
  const [stages, setStages] = useState<PipelineStageNode[] | null>(null);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Defer fetching until the card scrolls near the viewport. With 20 rows
  // visible, eager fetch was ~20 background requests on mount; this defers
  // off-screen ones entirely.
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' }, // start when ~200px away from viewport
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetch(`/api/jobs?projectId=${projectId}&pipelineId=${pipelineId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((jobs: GitLabJob[]) => {
        if (!cancelled) setStages(toStageNodes(jobs));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, projectId, pipelineId]);

  if (error) return null;

  // Skeleton: shown both before visibility AND while fetching after visible
  if (!stages) {
    return (
      <div ref={ref} className="mt-3 flex gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 w-24 animate-pulse rounded border border-muted bg-muted/40"
          />
        ))}
      </div>
    );
  }

  if (stages.length === 0) return null;

  return (
    <TooltipProvider>
      <div ref={ref} className="mt-3 flex items-start gap-0 overflow-x-auto pb-1 max-h-28 sm:max-h-none overflow-y-hidden">
        {stages.map((node, idx) => (
          <div key={node.stage} className="flex items-start">
            {idx > 0 && (
              <div className="flex items-center self-center mx-1 mt-3">
                {/* Connector arrow */}
                <div className="h-px w-4 bg-border" />
                <div className="border-t border-r border-border w-1.5 h-1.5 rotate-45 -ml-1" />
              </div>
            )}
            <StageColumn node={node} />
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
