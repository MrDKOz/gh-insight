import type { TimelineItem } from './types';

export interface Filters {
  startDate:        string;
  endDate:          string;
  showOpenIssues:   boolean;
  showClosedIssues: boolean;
  showOpenPRs:      boolean;
  showMergedPRs:    boolean;
  showClosedPRs:    boolean;
}

export const DEFAULT_FILTERS: Filters = {
  startDate:        '',
  endDate:          '',
  showOpenIssues:   true,
  showClosedIssues: true,
  showOpenPRs:      true,
  showMergedPRs:    true,
  showClosedPRs:    true,
};

export function applyFilters(items: TimelineItem[], filters: Filters): TimelineItem[] {
  return items.filter(item => {
    if (filters.startDate && item.createdAt.slice(0, 10) < filters.startDate) return false;
    if (filters.endDate   && item.createdAt.slice(0, 10) > filters.endDate)   return false;

    if (item.type === 'issue') {
      if (!item.closedAt && !filters.showOpenIssues)   return false;
      if ( item.closedAt && !filters.showClosedIssues) return false;
    } else {
      const isOpen = !item.mergedAt && !item.closedAt;
      if (isOpen                              && !filters.showOpenPRs)   return false;
      if (item.mergedAt                       && !filters.showMergedPRs) return false;
      if (!item.mergedAt && !!item.closedAt   && !filters.showClosedPRs) return false;
    }
    return true;
  });
}

interface Counts {
  openIssues:   number;
  closedIssues: number;
  openPRs:      number;
  mergedPRs:    number;
  closedPRs:    number;
}

interface Props {
  filters:  Filters;
  counts:   Counts;
  onChange: (f: Filters) => void;
}

export default function FilterBar({ filters, counts, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const hasDateFilter = !!filters.startDate || !!filters.endDate;
  const isActive = hasDateFilter
    || !filters.showOpenIssues || !filters.showClosedIssues
    || !filters.showOpenPRs   || !filters.showMergedPRs || !filters.showClosedPRs;

  const toggles: Array<{ key: keyof Filters; label: string; count: number; color: string }> = (
    [
      { key: 'showOpenIssues',   label: 'Open issues',   count: counts.openIssues,   color: '#0969da' },
      { key: 'showClosedIssues', label: 'Closed issues', count: counts.closedIssues, color: '#0969da' },
      { key: 'showOpenPRs',      label: 'Open PRs',      count: counts.openPRs,      color: '#8250df' },
      { key: 'showMergedPRs',    label: 'Merged PRs',    count: counts.mergedPRs,    color: '#8250df' },
      { key: 'showClosedPRs',    label: 'Closed PRs',    count: counts.closedPRs,    color: '#dc3545' },
    ] as Array<{ key: keyof Filters; label: string; count: number; color: string }>
  ).filter(t => t.count > 0);

  return (
    <div className={`filter-bar${isActive ? ' filter-bar--active' : ''}`}>
      <div className="filter-group">
        <span className="filter-label">Created</span>
        <input
          type="date"
          className="filter-date"
          value={filters.startDate}
          max={filters.endDate || undefined}
          onChange={e => set({ startDate: e.target.value })}
        />
        <span className="filter-sep">–</span>
        <input
          type="date"
          className="filter-date"
          value={filters.endDate}
          min={filters.startDate || undefined}
          onChange={e => set({ endDate: e.target.value })}
        />
        {hasDateFilter && (
          <button className="filter-clear" onClick={() => set({ startDate: '', endDate: '' })}>
            ✕
          </button>
        )}
      </div>

      <div className="filter-group">
        {toggles.map(({ key, label, count, color }) => (
          <button
            key={key}
            className={`filter-toggle${filters[key] ? '' : ' filter-toggle--off'}`}
            style={{ '--filter-color': color } as React.CSSProperties}
            onClick={() => set({ [key]: !filters[key] })}
            title={filters[key] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {label}
            <span className="filter-toggle-count">{count}</span>
          </button>
        ))}
      </div>

      {isActive && (
        <button className="filter-reset" onClick={() => onChange(DEFAULT_FILTERS)}>
          Reset
        </button>
      )}
    </div>
  );
}
