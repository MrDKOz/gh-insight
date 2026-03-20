import type { TimelineItem } from './types';

export interface Filters {
  createdStart:     string;
  createdEnd:       string;
  closedStart:      string;
  closedEnd:        string;
  showOpenIssues:   boolean;
  showClosedIssues: boolean;
  showOpenPRs:      boolean;
  showMergedPRs:    boolean;
  showClosedPRs:    boolean;
}

export const DEFAULT_FILTERS: Filters = {
  createdStart:     '',
  createdEnd:       '',
  closedStart:      '',
  closedEnd:        '',
  showOpenIssues:   true,
  showClosedIssues: true,
  showOpenPRs:      true,
  showMergedPRs:    true,
  showClosedPRs:    true,
};

export function applyFilters(items: TimelineItem[], filters: Filters): TimelineItem[] {
  return items.filter(item => {
    if (filters.createdStart && item.createdAt.slice(0, 10) < filters.createdStart) return false;
    if (filters.createdEnd   && item.createdAt.slice(0, 10) > filters.createdEnd)   return false;

    const end = item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
    if (filters.closedStart || filters.closedEnd) {
      if (!end) return false; // open items have no close date — exclude when filtering by closed
      if (filters.closedStart && end.slice(0, 10) < filters.closedStart) return false;
      if (filters.closedEnd   && end.slice(0, 10) > filters.closedEnd)   return false;
    }

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

const IconX = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" />
    <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" />
  </svg>
);

const IconReset = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 6.5a4.5 4.5 0 1 1-1.5-3.3" />
    <polyline points="9.5 1 9.5 3.5 12 3.5" />
  </svg>
);

interface DateFieldProps {
  value:    string;
  min?:     string;
  max?:     string;
  onChange: (v: string) => void;
  onClear:  () => void;
}

const DateField = ({ value, min, max, onChange, onClear }: DateFieldProps) => (
  <div className="filter-date-wrap">
    <input
      type="date"
      className="filter-date"
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(e.target.value)}
    />
    {value && (
      <button className="filter-date-clear" onClick={onClear} title="Clear date">
        <IconX />
      </button>
    )}
  </div>
);

export default function FilterBar({ filters, counts, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const isActive = !!filters.createdStart || !!filters.createdEnd
    || !!filters.closedStart  || !!filters.closedEnd
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
        <DateField
          value={filters.createdStart}
          max={filters.createdEnd || undefined}
          onChange={v => set({ createdStart: v })}
          onClear={() => set({ createdStart: '' })}
        />
        <span className="filter-sep">–</span>
        <DateField
          value={filters.createdEnd}
          min={filters.createdStart || undefined}
          onChange={v => set({ createdEnd: v })}
          onClear={() => set({ createdEnd: '' })}
        />
      </div>

      <div className="filter-group">
        <span className="filter-label">Closed</span>
        <DateField
          value={filters.closedStart}
          max={filters.closedEnd || undefined}
          onChange={v => set({ closedStart: v })}
          onClear={() => set({ closedStart: '' })}
        />
        <span className="filter-sep">–</span>
        <DateField
          value={filters.closedEnd}
          min={filters.closedStart || undefined}
          onChange={v => set({ closedEnd: v })}
          onClear={() => set({ closedEnd: '' })}
        />
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
        <button className="filter-reset" onClick={() => onChange(DEFAULT_FILTERS)} title="Reset all filters">
          <IconReset />
        </button>
      )}
    </div>
  );
}
