/**
 * Barrel re-export — preserves the public API so all existing imports
 * (`from '@/lib/gitlabService'`) continue to work unchanged.
 */
export { HttpError, isUnauthorized, fetchProjects, fetchGroups } from '@/lib/gitlabClient';
export type { RateLimitInfo } from '@/lib/gitlabClient';

export {
  fetchJobsForPipeline,
  fetchJobLog,
  fetchCiYaml,
  fetchPipelinesPaginated,
  fetchPipelineRows,
} from '@/lib/gitlabPipelines';

export { fetchAnalytics, fetchFlakyJobs } from '@/lib/gitlabAnalytics';
