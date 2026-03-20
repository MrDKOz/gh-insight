import { useState, useMemo } from 'react';
import type { TimelineItem } from './types';
import { MS, fmtDate } from './utils';

interface MilestoneMeta {
  number: number;
  title:  string;
  color:  string;
}

interface Props {
  items:      TimelineItem[];
  milestones: MilestoneMeta[];
}

type SortCol = 'type' | 'number' | 'title' | 'status' | 'milestone' | 'created' | 'closed' | 'days';
type SortDir = 'asc' | 'desc';

function itemEndDate(item: TimelineItem): string | null {
  return item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
}

function itemStatus(item: TimelineItem): 'Open' | 'Closed' | 'Merged' {
  if (item.type === 'issue') return item.closedAt ? 'Closed' : 'Open';
  if (item.mergedAt) return 'Merged';
  if (item.closedAt) return 'Closed';
  return 'Open';
}

export default function ItemList({ items, milestones }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>('number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const isMulti = milestones.length > 1;

  const milestoneMap = useMemo(
    () => new Map(milestones.map(m => [m.number, m])),
    [milestones],
  );

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'number':
          cmp = a.number - b.number;
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status':
          cmp = itemStatus(a).localeCompare(itemStatus(b));
          break;
        case 'milestone':
          cmp = (milestoneMap.get(a.milestoneNumber)?.title ?? '').localeCompare(
            milestoneMap.get(b.milestoneNumber)?.title ?? '',
          );
          break;
        case 'created':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'closed': {
          const ea = itemEndDate(a), eb = itemEndDate(b);
          if (!ea && !eb) cmp = 0;
          else if (!ea) cmp = 1;
          else if (!eb) cmp = -1;
          else cmp = new Date(ea).getTime() - new Date(eb).getTime();
          break;
        }
        case 'days': {
          const ea = itemEndDate(a), eb = itemEndDate(b);
          const da = ea ? (new Date(ea).getTime() - new Date(a.createdAt).getTime()) / MS : Infinity;
          const db = eb ? (new Date(eb).getTime() - new Date(b.createdAt).getTime()) / MS : Infinity;
          cmp = da - db;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortCol, sortDir, milestoneMap]);

  const Th = ({ col, label }: { col: SortCol; label: string }) => (
    <th
      className={`il-th${sortCol === col ? ' il-th--active' : ''}`}
      onClick={() => handleSort(col)}
    >
      {label}
      <span className="il-sort-icon" aria-hidden="true">
        {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⬍'}
      </span>
    </th>
  );

  return (
    <div className="il-wrap">
      <table className="il-table">
        <thead>
          <tr>
            <Th col="type"      label="Type"      />
            <Th col="number"    label="#"          />
            <Th col="title"     label="Title"      />
            <Th col="status"    label="Status"     />
            {isMulti && <Th col="milestone" label="Milestone" />}
            <Th col="created"   label="Created"    />
            <Th col="closed"    label="Closed"     />
            <Th col="days"      label="Days"       />
          </tr>
        </thead>
        <tbody>
          {sorted.map(item => {
            const end    = itemEndDate(item);
            const status = itemStatus(item);
            const days   = end
              ? Math.round((new Date(end).getTime() - new Date(item.createdAt).getTime()) / MS)
              : null;
            const isOpen     = status === 'Open';
            const isClosedPR = item.type === 'pr' && !item.mergedAt && !!item.closedAt;
            const badgeClass = item.type === 'issue'
              ? 'tl-badge tl-badge--issue'
              : isClosedPR ? 'tl-badge tl-badge--pr-closed'
              : 'tl-badge tl-badge--pr';
            const ms = milestoneMap.get(item.milestoneNumber);

            return (
              <tr key={`${item.type}-${item.number}`} className={isOpen ? 'il-row--open' : ''}>
                <td><span className={badgeClass}>{item.type.toUpperCase()}</span></td>
                <td>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`tl-num tl-num--${item.type}`}
                  >
                    #{item.number}
                  </a>
                </td>
                <td className="il-td-title">
                  <a href={item.url} target="_blank" rel="noreferrer" className="il-title-link">
                    {item.title}
                  </a>
                </td>
                <td>
                  <span className={`il-status il-status--${status.toLowerCase()}`}>{status}</span>
                </td>
                {isMulti && (
                  <td>
                    {ms && (
                      <span className="il-milestone">
                        <span className="il-milestone-dot" style={{ background: ms.color }} />
                        {ms.title}
                      </span>
                    )}
                  </td>
                )}
                <td className="il-td-date">{fmtDate(item.createdAt)}</td>
                <td className="il-td-date">
                  {end ? fmtDate(end) : <span className="il-empty">—</span>}
                </td>
                <td className="il-td-days">
                  {days !== null ? days : <span className="il-empty">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
