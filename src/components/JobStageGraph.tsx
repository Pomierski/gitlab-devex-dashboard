import { useState, useEffect } from 'react';
import { PipelineStatusBadge } from '@/components/PipelineStatusBadge';
import type { GitLabJob } from '@/types/gitlab';

interface Props {
  projectId: number;
  pipelineId: number;
}

// Group jobs by stage, preserving stage order
function groupByStage(jobs: GitLabJob[]): Map<string, GitLabJob[]> {
  const map = new Map<string, GitLabJob[]>();
  for (const job of jobs) {
    const list = map.get(job.stage) ?? [];
    list.push(job);
    map.set(job.stage, list);
  }
  return map;
}

export function JobStageGraph({ projectId, pipelineId }: Props) {
  const [jobs, setJobs] = useState<GitLabJob[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs?projectId=${projectId}&pipelineId=${pipelineId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setJobs)
      .catch(() => setError(true));
  }, [projectId, pipelineId]);

  if (error) return null;
  if (!jobs) {
    return (
      <div className="flex gap-1 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  const stages = groupByStage(jobs);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
      {Array.from(stages.entries()).map(([stage, stageJobs], idx) => (
        <div key={stage} className="flex items-center gap-1">
          {idx > 0 && <span className="text-muted-foreground text-xs">›</span>}
          <span className="text-xs text-muted-foreground mr-0.5">{stage}:</span>
          {stageJobs.map((job) => (
            <a
              key={job.id}
              href={job.web_url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${job.name} — ${job.status}`}
            >
              <PipelineStatusBadge status={job.status} label={job.name} compact />
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}
