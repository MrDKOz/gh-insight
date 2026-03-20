import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { TimelineItem } from './types';
import { MS, fmtDate } from './utils';
import { useOutsideClick } from './hooks';
import { exportCSV, exportMarkdown, exportPNG, exportPDF, exportXLSX } from './export';
import StatsBar from './StatsBar';
import FilterBar, { DEFAULT_FILTERS, applyFilters } from './FilterBar';
import type { Filters } from './FilterBar';
import Burndown from './Burndown';
import CycleTime from './CycleTime';
import Velocity from './Velocity';
import CumulativeFlow from './CumulativeFlow';
import ItemList from './ItemList';

interface MilestoneMeta {
  number: number;
  title: string;
  color: string;
}

interface Props {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
}

function durationDays(start: string, end: string | null): number | null {
  if (!end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / MS);
}

const ROW_HEIGHT = 31;

type ExportFormat = 'CSV' | 'XLSX' | 'Markdown' | 'PNG — Current view' | 'PNG — Full timeline' | 'PDF';
const EXPORT_FORMATS: ExportFormat[] = ['CSV', 'XLSX', 'Markdown', 'PNG — Current view', 'PNG — Full timeline', 'PDF'];

type View = 'Gantt' | 'Burndown' | 'Cycle Time' | 'Velocity' | 'Cumulative Flow' | 'List';
const VIEWS: View[] = ['Gantt', 'Burndown', 'Cycle Time', 'Velocity', 'Cumulative Flow', 'List'];

export default function Timeline({ items, milestones }: Props) {
  const [labelWidth, setLabelWidth]   = useState(400);
  const [pixelsPerDay, setPixelsPerDay] = useState(30);
  const [axisHeight, setAxisHeight]   = useState(36);
  const [exportOpen, setExportOpen]   = useState(false);
  const [exporting, setExporting]     = useState<ExportFormat | null>(null);
  const [view, setView]               = useState<View>('Gantt');
  const [viewOpen, setViewOpen]       = useState(false);
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS);

  const wrapperRef    = useRef<HTMLDivElement>(null);
  const trackColRef   = useRef<HTMLDivElement>(null);
  const axisRef       = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef   = useRef<HTMLDivElement>(null);
  const stateRef      = useRef({ pixelsPerDay, totalDays: 0, trackWidth: 0 });
  const pendingScrollRef = useRef<number | null>(null);
  // Holds cleanup for the window mousemove/mouseup drag listeners so they're
  // removed if the component unmounts while the user is mid-drag.
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // ── Derived data (memoised so Timeline only re-renders when items change) ──

  const milestoneColorMap = useMemo(
    () => new Map(milestones.map(m => [m.number, m.color])),
    [milestones],
  );
  const isMultiMilestone = milestones.length > 1;
  const title =
    milestones.length === 0 ? 'Milestone'
    : milestones.length === 1 ? milestones[0].title
    : milestones.length === 2 ? `${milestones[0].title} + ${milestones[1].title}`
    : `${milestones.length} milestones`;

  const { issueItems, closedIssues, openIssues, prItems, mergedPRs } =
    useMemo(() => {
      const issueItems     = items.filter(i => i.type === 'issue');
      const prItems        = items.filter(i => i.type === 'pr');
      const closedIssues   = issueItems.filter(i => i.closedAt);
      const openIssues     = issueItems.filter(i => !i.closedAt);
      const mergedPRs      = prItems.filter(i => i.mergedAt);
      return { issueItems, prItems, closedIssues, openIssues, mergedPRs };
    }, [items]);

  const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);

  const counts = useMemo(() => ({
    openIssues:   openIssues.length,
    closedIssues: closedIssues.length,
    openPRs:      prItems.filter(i => !i.mergedAt && !i.closedAt).length,
    mergedPRs:    mergedPRs.length,
    closedPRs:    prItems.filter(i => !i.mergedAt && !!i.closedAt).length,
  }), [openIssues, closedIssues, prItems, mergedPRs]);

  const filteredCompletedItems = useMemo(
    () => filteredItems.filter(i => i.type === 'issue' ? !!i.closedAt : !!(i.mergedAt || i.closedAt)),
    [filteredItems],
  );

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [filteredItems],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  // Remove any lingering drag listeners if the component unmounts mid-drag
  useEffect(() => () => { dragCleanupRef.current?.(); }, []);

  // Measure rendered date axis height so label column spacer stays aligned
  useEffect(() => {
    if (!axisRef.current) return;
    const { height } = axisRef.current.getBoundingClientRect();
    const marginBottom = parseFloat(getComputedStyle(axisRef.current).marginBottom) || 0;
    setAxisHeight(height + marginBottom);
  }, [view]);

  // Reset zoom when new data loads
  useEffect(() => { setPixelsPerDay(30); }, [items]);

  // Non-passive wheel listener: cursor-centred zoom, horizontal swipe pans normally
  useEffect(() => {
    const el = trackColRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const { pixelsPerDay: ppd, totalDays: td, trackWidth: tw } = stateRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newPpd = Math.min(200, Math.max(3, ppd * factor));
      const newTrackWidth = Math.max(500, Math.round(td * newPpd));
      const cursorX = e.clientX - el.getBoundingClientRect().left;
      const fraction = tw > 0 ? (cursorX + el.scrollLeft) / tw : 0;
      pendingScrollRef.current = Math.max(0, fraction * newTrackWidth - cursorX);
      setPixelsPerDay(newPpd);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view]);

  // Apply cursor-centred scroll after DOM updates with the new track width
  useEffect(() => {
    if (pendingScrollRef.current !== null && trackColRef.current) {
      trackColRef.current.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [pixelsPerDay]);

  // Close dropdowns on outside click
  const closeExport = useCallback(() => setExportOpen(false), []);
  const closeView   = useCallback(() => setViewOpen(false),   []);
  useOutsideClick(exportMenuRef, exportOpen, closeExport);
  useOutsideClick(viewMenuRef,   viewOpen,   closeView);

  // ── Export ─────────────────────────────────────────────────────────────────

  // "PNG — Current view" only makes sense for Gantt (scroll-position matters).
  const disabledExports: Partial<Record<ExportFormat, string>> =
    view !== 'Gantt'
      ? { 'PNG — Current view': 'No scroll position in this view — use PNG — Full timeline' }
      : {};
  const hasLimitedExports = Object.keys(disabledExports).length > 0;

  const handleExport = useCallback(async (fmt: ExportFormat) => {
    if (disabledExports[fmt]) return;
    setExportOpen(false);
    setExporting(fmt);
    try {
      if (fmt === 'CSV')                    exportCSV(filteredCompletedItems, title);
      else if (fmt === 'Markdown')          exportMarkdown(filteredCompletedItems, title);
      else if (fmt === 'PNG — Current view')
        await exportPNG(wrapperRef.current!, trackColRef.current, title, 'current');
      else if (fmt === 'PNG — Full timeline')
        await exportPNG(wrapperRef.current!, trackColRef.current, title, 'full');
      else if (fmt === 'PDF')               await exportPDF(filteredCompletedItems, title);
      else if (fmt === 'XLSX')              await exportXLSX(filteredCompletedItems, title);
    } catch (e) {
      console.error(`Export ${fmt} failed:`, e);
    } finally {
      setExporting(null);
    }
  }, [filteredCompletedItems, title, disabledExports]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gantt layout ───────────────────────────────────────────────────────────

  const todayMs = Date.now();
  const allTimestamps = useMemo(() => filteredItems.flatMap(item => {
    const ts = [new Date(item.createdAt).getTime()];
    if (item.type === 'issue') {
      if (item.closedAt) ts.push(new Date(item.closedAt).getTime());
    } else {
      const end = item.mergedAt ?? item.closedAt;
      if (end) ts.push(new Date(end).getTime());
    }
    return ts;
  }), [filteredItems]);

  if (items.length === 0) {
    return (
      <div className="tl-wrapper">
        <div className="tl-header"><h2>{title}</h2></div>
        <p className="tl-empty">No items found in this milestone.</p>
      </div>
    );
  }

  const noFilteredItems = filteredItems.length === 0;

  const minTime    = allTimestamps.length > 0 ? Math.min(...allTimestamps) : todayMs;
  const maxTime    = allTimestamps.length > 0 ? Math.max(Math.max(...allTimestamps), todayMs) : todayMs;
  const totalMs    = maxTime - minTime || 1;
  const totalDays  = totalMs / MS;
  const trackWidth = Math.max(500, Math.round(totalDays * pixelsPerDay));
  stateRef.current = { pixelsPerDay, totalDays, trackWidth };

  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday    = todayMs >= minTime;

  const numDateLabels = Math.max(4, Math.min(24, Math.floor(trackWidth / 110)));
  const dateLabels = Array.from({ length: numDateLabels }, (_, i) =>
    fmtDate(new Date(minTime + (totalMs * i) / (numDateLabels - 1)).toISOString()),
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX     = e.clientX;
    const startWidth = labelWidth;
    const onMove = (ev: MouseEvent) =>
      setLabelWidth(Math.max(200, startWidth + (ev.clientX - startX)));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dragCleanupRef.current = null;
    };
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [labelWidth]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tl-wrapper" ref={wrapperRef}>
      {/* Header */}
      <div className="tl-header">
        <div>
          <h2>{title}</h2>
          <p className="tl-subtitle">
            {issueItems.length} issue{issueItems.length !== 1 ? 's' : ''} ({closedIssues.length} closed),{' '}
            {prItems.length} PR{prItems.length !== 1 ? 's' : ''} ({mergedPRs.length} merged)
          </p>
        </div>

        <div className="tl-header-actions" data-export-exclude>
          {/* View switcher */}
          <div className="view-menu" ref={viewMenuRef}>
            <button className="btn-view" onClick={() => setViewOpen(o => !o)}>
              {view}<span aria-hidden> ▾</span>
            </button>
            {viewOpen && (
              <div className="view-dropdown">
                {VIEWS.map(v => (
                  <button
                    key={v}
                    className={`view-option${v === view ? ' view-option--active' : ''}`}
                    onClick={() => { setView(v); setViewOpen(false); }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="export-menu" ref={exportMenuRef}>
            {hasLimitedExports && (
              <span
                className="export-limit-badge"
                title="Some export formats are not available in this view"
                aria-label="Some formats unavailable"
              />
            )}
            <button
              className="btn-export"
              onClick={() => setExportOpen(o => !o)}
              disabled={exporting !== null}
            >
              {exporting ? `Exporting ${exporting}…` : 'Export'}<span aria-hidden> ▾</span>
            </button>
            {exportOpen && (
              <div className="export-dropdown">
                {EXPORT_FORMATS.map(fmt => {
                  const reason = disabledExports[fmt];
                  return (
                    <button
                      key={fmt}
                      className={`export-option${reason ? ' export-option--disabled' : ''}`}
                      onClick={() => handleExport(fmt)}
                      disabled={!!reason}
                      title={reason}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar items={filteredItems} />

      {/* Filter bar */}
      <FilterBar filters={filters} counts={counts} onChange={setFilters} />

      {/* Non-Gantt views */}
      {noFilteredItems && <p className="tl-empty">No items match the current filters.</p>}
      {!noFilteredItems && view === 'Burndown'        && <Burndown items={filteredItems} />}
      {!noFilteredItems && view === 'Cycle Time'      && <CycleTime items={filteredItems} />}
      {!noFilteredItems && view === 'Velocity'        && <Velocity items={filteredItems} />}
      {!noFilteredItems && view === 'Cumulative Flow' && <CumulativeFlow items={filteredItems} />}
      {!noFilteredItems && view === 'List'            && <ItemList items={filteredItems} milestones={milestones} />}

      {/* Gantt view */}
      {!noFilteredItems && view === 'Gantt' && (
        <>
          <div className="tl-legend">
            <div className="tl-legend-item">
              <span className="tl-swatch tl-swatch--issue" />
              <span>Issues (closed)</span>
            </div>
            {openIssues.length > 0 && (
              <div className="tl-legend-item">
                <span className="tl-swatch tl-swatch--issue-open" />
                <span>Issues (open)</span>
              </div>
            )}
            <div className="tl-legend-item">
              <span className="tl-swatch tl-swatch--pr-merged" />
              <span>PRs (merged)</span>
            </div>
            <div className="tl-legend-item">
              <span className="tl-swatch tl-swatch--pr-closed" />
              <span>PRs (closed)</span>
            </div>
          </div>

          {isMultiMilestone && (
            <div className="tl-milestone-legend">
              {milestones.map(m => (
                <div key={m.number} className="tl-milestone-legend-item">
                  <span className="tl-milestone-swatch" style={{ background: m.color }} />
                  <span>{m.title}</span>
                </div>
              ))}
            </div>
          )}

          <p className="tl-hint">
            Click issue/PR numbers to open in GitHub &nbsp;·&nbsp; Drag handle to resize labels
            &nbsp;·&nbsp; Scroll wheel to zoom
          </p>

          <div className="tl-body">
            {/* Label column (fixed, never scrolls) */}
            <div className="tl-label-col" style={{ width: labelWidth }}>
              <div style={{ height: axisHeight, flexShrink: 0 }} />
              {sortedItems.map(item => {
                const isOpen    = item.type === 'issue' ? !item.closedAt : !(item.mergedAt || item.closedAt);
                const isClosedPR = item.type === 'pr' && !item.mergedAt && !!item.closedAt;
                const badgeClass =
                  item.type === 'issue' ? 'tl-badge tl-badge--issue'
                  : isClosedPR          ? 'tl-badge tl-badge--pr-closed'
                                        : 'tl-badge tl-badge--pr';
                return (
                  <div
                    key={`lbl-${item.type}-${item.number}`}
                    className="tl-label"
                    style={{
                      height: ROW_HEIGHT,
                      opacity: isOpen ? 0.75 : 1,
                      boxShadow: isMultiMilestone
                        ? `inset 3px 0 0 ${milestoneColorMap.get(item.milestoneNumber) ?? '#57606a'}`
                        : undefined,
                    }}
                  >
                    <span className={badgeClass}>{item.type.toUpperCase()}</span>
                    <a href={item.url} target="_blank" rel="noreferrer" className={`tl-num tl-num--${item.type}`}>
                      #{item.number}
                    </a>
                    <span className="tl-title" title={item.title}>{item.title}</span>
                    <div className="tl-resize-handle" onMouseDown={handleResizeStart} />
                  </div>
                );
              })}
            </div>

            {/* Track column (scrolls horizontally) */}
            <div className="tl-track-col" ref={trackColRef}>
              <div className="tl-date-axis" ref={axisRef} style={{ width: trackWidth }}>
                {dateLabels.map((label, i) => (
                  <span key={i} className="tl-date-label">{label}</span>
                ))}
              </div>
              {sortedItems.map(item => {
                const isOpen  = item.type === 'issue' ? !item.closedAt : !(item.mergedAt || item.closedAt);
                const startMs = new Date(item.createdAt).getTime();
                const endDate = isOpen ? null
                  : item.type === 'issue' ? item.closedAt
                  : (item.mergedAt ?? item.closedAt);
                const endMs   = isOpen ? todayMs : new Date(endDate!).getTime();

                const leftPct  = ((startMs - minTime) / totalMs) * 100;
                const widthPct = Math.max(((endMs - startMs) / totalMs) * 100, 0.3);

                const duration = durationDays(item.createdAt, isOpen ? null : (endDate ?? null));
                const durationText =
                  duration === null  ? 'ongoing'
                  : duration === 0   ? 'Same day'
                  : duration === 1   ? '1 day'
                                     : `${duration} days`;

                const isMergedPR = item.type === 'pr' && !!item.mergedAt;
                const barClass   = [
                  'tl-bar',
                  isOpen
                    ? item.type === 'issue' ? 'tl-bar--issue-open' : 'tl-bar--pr-open'
                    : item.type === 'issue' ? 'tl-bar--issue'
                    : isMergedPR            ? 'tl-bar--pr-merged'
                                            : 'tl-bar--pr-closed',
                ].join(' ');

                const barWidthPx = (widthPct / 100) * trackWidth;
                const barLabel = barWidthPx < 40 ? '' : isOpen
                  ? `${fmtDate(item.createdAt)} → today (${durationText})`
                  : duration !== null && duration <= 2
                    ? durationText
                    : `${fmtDate(item.createdAt)} → ${fmtDate(endDate)} (${durationText})`;

                const statusWord = isOpen ? 'Open'
                  : item.type === 'pr' ? (item.mergedAt ? 'Merged' : 'Closed')
                  : 'Closed';

                const tooltip = [
                  `${item.type === 'pr' ? 'PR' : 'Issue'} #${item.number}: ${item.title}`,
                  item.type === 'pr' && item.linkedIssue ? `Closes #${item.linkedIssue}` : '',
                  `Opened: ${fmtDate(item.createdAt)}`,
                  isOpen ? 'Status: Open' : `${statusWord}: ${fmtDate(endDate)}`,
                  `Duration: ${durationText}`,
                ].filter(Boolean).join('\n');

                return (
                  <div
                    key={`trk-${item.type}-${item.number}`}
                    className="tl-track-row"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="tl-track" style={{ width: trackWidth }}>
                      {showToday && (
                        <div className="tl-today-marker" style={{ left: `${todayLeftPct}%` }} />
                      )}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className={barClass}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={tooltip}
                      >
                        {barLabel}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
