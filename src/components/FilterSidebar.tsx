import { Checkbox } from '@/components/ui/Checkbox';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { GitLabGroup, GitLabProject, PipelineFilters, PipelineStatus } from '@/types/gitlab';

const STATUSES: PipelineStatus[] = ['success', 'failed', 'running', 'pending', 'canceled'];
const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
] as const;

interface Props {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  filters: PipelineFilters;
  onChange: (patch: Partial<PipelineFilters>) => void;
}

function toggleStatus(statuses: PipelineStatus[], s: PipelineStatus): PipelineStatus[] {
  return statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s];
}

export function FilterSidebar({ groups, projects, filters, onChange }: Props) {
  return (
    <aside className="w-60 shrink-0 space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Date Range
        </h3>
        <Select
          value={filters.dateRange}
          onValueChange={(v) => onChange({ dateRange: v as PipelineFilters['dateRange'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </h3>
        <div className="space-y-2">
          {STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={filters.statuses.includes(s)}
                onCheckedChange={() => onChange({ statuses: toggleStatus(filters.statuses, s) })}
              />
              <span className="capitalize">{s}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tags Only
        </h3>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={filters.tagsOnly}
            onCheckedChange={(v) => onChange({ tagsOnly: Boolean(v) })}
          />
          <span>Tag pipelines only</span>
        </label>
      </section>

      {groups.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Groups
          </h3>
          <SearchableSelect
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            selected={filters.groupIds}
            onChange={(ids) => onChange({ groupIds: ids })}
            placeholder="Filter by group…"
          />
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </h3>
          <SearchableSelect
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            selected={filters.projectIds}
            onChange={(ids) => onChange({ projectIds: ids })}
            placeholder="Filter by project…"
          />
        </section>
      )}
    </aside>
  );
}
