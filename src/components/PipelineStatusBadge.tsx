import { Badge } from '@/components/ui/Badge';
import type { PipelineStatus } from '@/types/gitlab';

const STATUS_VARIANT: Record<
  PipelineStatus,
  'success' | 'failed' | 'running' | 'pending' | 'canceled' | 'outline'
> = {
  success: 'success',
  failed: 'failed',
  running: 'running',
  pending: 'pending',
  canceled: 'canceled',
  created: 'pending',
  waiting_for_resource: 'pending',
  preparing: 'pending',
  skipped: 'canceled',
  manual: 'outline',
  scheduled: 'outline',
};

interface Props {
  status: PipelineStatus;
  /** When true, show only a coloured dot instead of text */
  compact?: boolean;
  /** Override display text (defaults to status name) */
  label?: string;
}

export function PipelineStatusBadge({ status, compact = false, label }: Props) {
  if (compact) {
    return (
      <Badge
        variant={STATUS_VARIANT[status]}
        className="px-1.5 py-0 text-[10px] max-w-[80px] truncate"
        title={label ?? status}
      >
        {label ?? status}
      </Badge>
    );
  }
  return <Badge variant={STATUS_VARIANT[status]}>{label ?? status}</Badge>;
}
