import type { GitLabJob, PipelineStatus } from '@/types/gitlab';

export interface PipelineStageNode {
  stage: string;
  jobs: Array<{
    id: number;
    name: string;
    status: PipelineStatus;
    duration: number | null;
    webUrl: string;
    failureReason: string | null;
  }>;
  /** Aggregate status: failed if any job failed, running if any running, else success */
  status: PipelineStatus;
}

function aggregateStatus(jobs: PipelineStageNode['jobs']): PipelineStatus {
  if (jobs.some((j) => j.status === 'failed')) return 'failed';
  if (jobs.some((j) => j.status === 'running')) return 'running';
  if (jobs.some((j) => j.status === 'pending' || j.status === 'created')) return 'pending';
  if (jobs.every((j) => j.status === 'success')) return 'success';
  if (jobs.some((j) => j.status === 'canceled')) return 'canceled';
  return jobs[0]?.status ?? 'created';
}

export function toStageNodes(jobs: GitLabJob[]): PipelineStageNode[] {
  const stageMap = new Map<string, PipelineStageNode['jobs']>();

  for (const job of jobs) {
    const list = stageMap.get(job.stage) ?? [];
    list.push({
      id: job.id,
      name: job.name,
      status: job.status,
      duration: job.duration,
      webUrl: job.web_url,
      failureReason: job.failure_reason,
    });
    stageMap.set(job.stage, list);
  }

  return Array.from(stageMap.entries()).map(([stage, jobs]) => ({
    stage,
    jobs,
    status: aggregateStatus(jobs),
  }));
}
