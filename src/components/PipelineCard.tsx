import { useState } from 'react';
import { GitBranch, Clock, ExternalLink, FileCode, ScrollText, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PipelineStatusBadge } from '@/components/PipelineStatusBadge';
import { PipelineStageGraph } from '@/components/PipelineStageGraph';
import { LogViewerSheet } from '@/components/LogViewerSheet';
import { YamlPreviewModal } from '@/components/YamlPreviewModal';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';
import type { PipelineRow } from '@/types/gitlab';

function formatDuration(s: number | null) {
  if (s == null) return '—';
  const sec = Math.max(0, Math.round(s));
  const m = Math.floor(sec / 60);
  return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`;
}

function formatRelative(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function PipelineCard({ pipeline }: { pipeline: PipelineRow }) {
  const [logOpen, setLogOpen] = useState(false);
  const [yamlOpen, setYamlOpen] = useState(false);

  return (
    <>
      <div className="rounded-lg border bg-card p-4 shadow-sm hover:border-border/80 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm truncate">{pipeline.projectName}</span>
              <PipelineStatusBadge status={pipeline.status} />
              {pipeline.isTag && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                  <Tag className="h-2.5 w-2.5" />
                  {pipeline.ref}
                </span>
              )}
            </div>

            {/* Commit */}
            <p className="text-sm text-muted-foreground truncate mb-2">{pipeline.commitTitle}</p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {!pipeline.isTag && (
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {pipeline.ref}
                </span>
              )}
              {pipeline.triggeredByAvatar ? (
                <span className="flex items-center gap-1">
                  <img
                    src={pipeline.triggeredByAvatar}
                    alt={pipeline.triggeredBy}
                    className="h-4 w-4 rounded-full"
                  />
                  {pipeline.triggeredBy}
                </span>
              ) : (
                <span>{pipeline.triggeredBy}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {pipeline.status === 'running' || pipeline.status === 'pending' ? (
                  <span className="text-blue-400">Running</span>
                ) : (
                  formatDuration(pipeline.duration)
                )}
              </span>
              <span>{formatRelative(pipeline.createdAt)}</span>
            </div>

            {/* Stage graph */}
            <PipelineStageGraph projectId={pipeline.projectId} pipelineId={pipeline.id} />
          </div>

          {/* Tooltip-wrapped action buttons */}
          <TooltipProvider>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Tooltip label="Open natively in GitLab">
                <a
                  href={pipeline.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open in GitLab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Tooltip>

              <Tooltip label="Inspect .gitlab-ci.yml">
                <button
                  onClick={() => setYamlOpen(true)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Preview CI YAML"
                >
                  <FileCode className="h-4 w-4" />
                </button>
              </Tooltip>

              {pipeline.status === 'failed' && (
                <Tooltip label="View raw execution logs">
                  <button
                    onClick={() => setLogOpen(true)}
                    className="text-red-400 hover:text-red-300"
                    aria-label="Inspect job logs"
                  >
                    <ScrollText className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>
      </div>

      {logOpen && (
        <LogViewerSheet
          projectId={pipeline.projectId}
          jobId={pipeline.id}
          jobName={`Pipeline #${pipeline.id}`}
          jobWebUrl={pipeline.webUrl}
          open={logOpen}
          onClose={() => setLogOpen(false)}
        />
      )}

      <YamlPreviewModal
        projectId={pipeline.projectId}
        projectName={pipeline.projectName}
        open={yamlOpen}
        onClose={() => setYamlOpen(false)}
      />
    </>
  );
}
