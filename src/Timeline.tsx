import { useState, useRef, useEffect } from 'react';
import type { TimelineItem } from './types';
import { exportCSV, exportMarkdown, exportPNG, exportPDF, exportXLSX } from './export';
import Burndown from './Burndown';
import CycleTime from './CycleTime';
import Velocity from './Velocity';
import CumulativeFlow from './CumulativeFlow';

interface Props {
  items: TimelineItem[];
  title: string;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function durationDays(start: string, end: string | null): number | null {
  if (!end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
}

const ROW_HEIGHT = 31;

type ExportFormat = 'CSV' | 'XLSX' | 'Markdown' | 'PNG — Current view' | 'PNG — Full timeline' | 'PDF';
const EXPORT_FORMATS: ExportFormat[] = ['CSV', 'XLSX', 'Markdown', 'PNG — Current view', 'PNG — Full timeline', 'PDF'];

type View = 'Gantt' | 'Burndown' | 'Cycle Time' | 'Velocity' | 'Cumulative Flow';
const VIEWS: View[] = ['Gantt', 'Burndown', 'Cycle Time', 'Velocity', 'Cumulative Flow'];

export default function Timeline({ items, title }: Props) {
  const [labelWidth, setLabelWidth] = useState(320);
  const [pixelsPerDay, setPixelsPerDay] = useState(30);
  const [axisHeight, setAxisHeight] = useState(36);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [view, setView] = useState<View>('Gantt');
  const [viewOpen, setViewOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackColRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ pixelsPerDay, totalDays: 0, trackWidth: 0 });
  const pendingScrollRef = useRef<number | null>(null);

  // Derived item sets
  const completedItems = items.filter((item) => {
    if (item.type === 'issue') return !!item.closedAt;
    return !!(item.mergedAt || item.closedAt);
  });

  const issueItems = items.filter((i) => i.type === 'issue');
  const prItems = items.filter((i) => i.type === 'pr');
  const closedIssues = issueItems.filter((i) => i.closedAt);
  const openIssues = issueItems.filter((i) => !i.closedAt);
  const mergedPRs = prItems.filter((i) => i.mergedAt);
  const closedPRs = prItems.filter((i) => !i.mergedAt && i.closedAt);

  // Cycle time stats (closed issues only)
  const cycleTimes = closedIssues.map((i) =>
    Math.round(
      (new Date(i.closedAt!).getTime() - new Date(i.createdAt).getTime()) / 86_400_000,
    ),
  );
  const avgCycle =
    cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
      : null;
  const fastestCycle = cycleTimes.length > 0 ? Math.min(...cycleTimes) : null;
  const slowestCycle = cycleTimes.length > 0 ? Math.max(...cycleTimes) : null;

  // Measure rendered date axis height so label spacer stays aligned
  useEffect(() => {
    if (!axisRef.current) return;
    const { height } = axisRef.current.getBoundingClientRect();
    const marginBottom = parseFloat(getComputedStyle(axisRef.current).marginBottom) || 0;
    setAxisHeight(height + marginBottom);
  }, [view]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  // Close view dropdown on outside click
  useEffect(() => {
    if (!viewOpen) return;
    const handler = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [viewOpen]);

  // "PNG — Current view" only makes sense for the Gantt where you may be zoomed
  // in to a particular scroll position. All other views are fully visible, so
  // only "PNG — Full timeline" is offered there.
  const disabledExports: Partial<Record<ExportFormat, string>> =
    view !== 'Gantt'
      ? { 'PNG — Current view': 'No scroll position in this view — use PNG — Full timeline' }
      : {};
  const hasLimitedExports = Object.keys(disabledExports).length > 0;

  const handleExport = async (fmt: ExportFormat) => {
    if (disabledExports[fmt]) return;
    setExportOpen(false);
    setExporting(fmt);
    try {
      if (fmt === 'CSV') exportCSV(completedItems, title);
      else if (fmt === 'Markdown') exportMarkdown(completedItems, title);
      else if (fmt === 'PNG — Current view')
        await exportPNG(wrapperRef.current!, trackColRef.current, title, 'current');
      else if (fmt === 'PNG — Full timeline')
        await exportPNG(wrapperRef.current!, trackColRef.current, title, 'full');
      else if (fmt === 'PDF') await exportPDF(completedItems, title);
      else if (fmt === 'XLSX') await exportXLSX(completedItems, title);
    } catch (e) {
      console.error(`Export ${fmt} failed:`, e);
    } finally {
      setExporting(null);
    }
  };

  // Reset zoom when new data loads
  useEffect(() => {
    setPixelsPerDay(30);
  }, [items]);

  // Non-passive wheel listener — cursor-centred zoom, horizontal swipe pans normally
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

  if (items.length === 0) {
    return (
      <div className="tl-wrapper">
        <div className="tl-header">
          <h2>{title}</h2>
        </div>
        <p className="tl-empty">No items found in this milestone.</p>
      </div>
    );
  }

  const todayMs = Date.now();

  // Time range — include today so open bars reach the right edge
  const allTimestamps = items.flatMap((item) => {
    const ts = [new Date(item.createdAt).getTime()];
    if (item.type === 'issue') {
      if (item.closedAt) ts.push(new Date(item.closedAt).getTime());
    } else {
      const end = item.mergedAt ?? item.closedAt;
      if (end) ts.push(new Date(end).getTime());
    }
    return ts;
  });

  const minTime = Math.min(...allTimestamps);
  const maxTime = Math.max(Math.max(...allTimestamps), todayMs);
  const totalMs = maxTime - minTime || 1;
  const totalDays = totalMs / 86_400_000;
  const trackWidth = Math.max(500, Math.round(totalDays * pixelsPerDay));
  stateRef.current = { pixelsPerDay, totalDays, trackWidth };

  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday = todayMs >= minTime;

  const sortedItems = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const dateLabels = Array.from({ length: 9 }, (_, i) =>
    formatDate(new Date(minTime + (totalMs * i) / 8).toISOString()),
  );

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = labelWidth;
    const onMove = (ev: MouseEvent) =>
      setLabelWidth(Math.max(150, startWidth + (ev.clientX - startX)));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="tl-wrapper" ref={wrapperRef}>
      {/* ── Header ── */}
      <div className="tl-header">
        <div>
          <h2>{title}</h2>
          <p className="tl-subtitle">
            {issueItems.length} issue{issueItems.length !== 1 ? 's' : ''} ({closedIssues.length}{' '}
            closed), {prItems.length} PR{prItems.length !== 1 ? 's' : ''} ({mergedPRs.length}{' '}
            merged)
          </p>
        </div>

        <div className="tl-header-actions" data-export-exclude>
          {/* View switcher */}
          <div className="view-menu" ref={viewMenuRef}>
            <button className="btn-view" onClick={() => setViewOpen((o) => !o)}>
              {view}
              <span aria-hidden> ▾</span>
            </button>
            {viewOpen && (
              <div className="view-dropdown">
                {VIEWS.map((v) => (
                  <button
                    key={v}
                    className={`view-option${v === view ? ' view-option--active' : ''}`}
                    onClick={() => {
                      setView(v);
                      setViewOpen(false);
                    }}
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
              onClick={() => setExportOpen((o) => !o)}
              disabled={exporting !== null}
            >
              {exporting ? `Exporting ${exporting}…` : 'Export'}
              <span aria-hidden> ▾</span>
            </button>
            {exportOpen && (
              <div className="export-dropdown">
                {EXPORT_FORMATS.map((fmt) => {
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

      {/* ── Stats bar ── */}
      <div className="stats-bar">
        <div className="stat" title="Number of issues that have been closed in this milestone">
          <span className="stat-value">{closedIssues.length}</span>
          <span className="stat-label">Issues closed</span>
        </div>
        {openIssues.length > 0 && (
          <div className="stat" title="Number of issues still open in this milestone">
            <span className="stat-value stat-value--open">{openIssues.length}</span>
            <span className="stat-label">Issues open</span>
          </div>
        )}
        <div className="stat" title="Number of pull requests that have been merged">
          <span className="stat-value stat-value--pr">{mergedPRs.length}</span>
          <span className="stat-label">PRs merged</span>
        </div>
        {closedPRs.length > 0 && (
          <div className="stat" title="Number of pull requests closed without being merged">
            <span className="stat-value stat-value--closed">{closedPRs.length}</span>
            <span className="stat-label">PRs closed</span>
          </div>
        )}
        {avgCycle !== null && (
          <>
            <div className="stat-divider" />
            <div className="stat" title="Average days from issue creation to close, across all closed issues">
              <span className="stat-value">{avgCycle}d</span>
              <span className="stat-label">Avg cycle</span>
            </div>
            <div className="stat" title={`Fastest issue closed in ${fastestCycle} day${fastestCycle !== 1 ? 's' : ''} (creation to close)`}>
              <span className="stat-value stat-value--fast">{fastestCycle}d</span>
              <span className="stat-label">Fastest</span>
            </div>
            <div className="stat" title={`Slowest issue took ${slowestCycle} day${slowestCycle !== 1 ? 's' : ''} to close (creation to close)`}>
              <span className="stat-value stat-value--slow">{slowestCycle}d</span>
              <span className="stat-label">Slowest</span>
            </div>
          </>
        )}
      </div>

      {/* ── Non-Gantt views ── */}
      {view === 'Burndown'        && <Burndown items={items} />}
      {view === 'Cycle Time'      && <CycleTime items={items} />}
      {view === 'Velocity'        && <Velocity items={items} />}
      {view === 'Cumulative Flow' && <CumulativeFlow items={items} />}

      {/* ── Gantt view ── */}
      {view === 'Gantt' && (
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

          <p className="tl-hint">
            Click issue/PR numbers to open in GitHub &nbsp;·&nbsp; Drag handle to resize labels
            &nbsp;·&nbsp; Scroll wheel to zoom
          </p>

          <div className="tl-body">
            {/* ── Label column (fixed, never scrolls) ── */}
            <div className="tl-label-col" style={{ width: labelWidth }}>
              <div style={{ height: axisHeight, flexShrink: 0 }} />

              {sortedItems.map((item) => {
                const isOpen =
                  item.type === 'issue' ? !item.closedAt : !(item.mergedAt || item.closedAt);
                const isClosedPR = item.type === 'pr' && !item.mergedAt && !!item.closedAt;
                const badgeClass =
                  item.type === 'issue'
                    ? 'tl-badge tl-badge--issue'
                    : isClosedPR
                      ? 'tl-badge tl-badge--pr-closed'
                      : 'tl-badge tl-badge--pr';
                return (
                  <div
                    key={`lbl-${item.type}-${item.number}`}
                    className="tl-label"
                    style={{ height: ROW_HEIGHT, opacity: isOpen ? 0.75 : 1 }}
                  >
                    <span className={badgeClass}>{item.type.toUpperCase()}</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`tl-num tl-num--${item.type}`}
                    >
                      #{item.number}
                    </a>
                    <span className="tl-title" title={item.title}>
                      {item.title}
                    </span>
                    <div className="tl-resize-handle" onMouseDown={handleResizeStart} />
                  </div>
                );
              })}
            </div>

            {/* ── Track column (scrolls horizontally) ── */}
            <div className="tl-track-col" ref={trackColRef}>
              <div className="tl-date-axis" ref={axisRef} style={{ width: trackWidth }}>
                {dateLabels.map((label, i) => (
                  <span key={i} className="tl-date-label">
                    {label}
                  </span>
                ))}
              </div>

              {sortedItems.map((item) => {
                const isOpen =
                  item.type === 'issue' ? !item.closedAt : !(item.mergedAt || item.closedAt);
                const startMs = new Date(item.createdAt).getTime();
                const endDate = isOpen
                  ? null
                  : item.type === 'issue'
                    ? item.closedAt
                    : (item.mergedAt ?? item.closedAt);
                const endMs = isOpen ? todayMs : new Date(endDate!).getTime();

                const leftPct = ((startMs - minTime) / totalMs) * 100;
                const widthPct = Math.max(((endMs - startMs) / totalMs) * 100, 0.3);

                const duration = durationDays(item.createdAt, isOpen ? null : (endDate ?? null));
                const durationText =
                  duration === null
                    ? 'ongoing'
                    : duration === 0
                      ? 'Same day'
                      : duration === 1
                        ? '1 day'
                        : `${duration} days`;

                const isMergedPR = item.type === 'pr' && !!item.mergedAt;

                const barClass = [
                  'tl-bar',
                  isOpen
                    ? item.type === 'issue'
                      ? 'tl-bar--issue-open'
                      : 'tl-bar--pr-open'
                    : item.type === 'issue'
                      ? 'tl-bar--issue'
                      : isMergedPR
                        ? 'tl-bar--pr-merged'
                        : 'tl-bar--pr-closed',
                ].join(' ');

                const barLabel = isOpen
                  ? `${formatDate(item.createdAt)} → today (${durationText})`
                  : duration !== null && duration <= 2
                    ? durationText
                    : `${formatDate(item.createdAt)} → ${formatDate(endDate)} (${durationText})`;

                const statusWord = isOpen
                  ? 'Open'
                  : item.type === 'pr'
                    ? item.mergedAt
                      ? 'Merged'
                      : 'Closed'
                    : 'Closed';

                const tooltip = [
                  `${item.type === 'pr' ? 'PR' : 'Issue'} #${item.number}: ${item.title}`,
                  item.type === 'pr' && item.linkedIssue ? `Closes #${item.linkedIssue}` : '',
                  `Opened: ${formatDate(item.createdAt)}`,
                  isOpen ? 'Status: Open' : `${statusWord}: ${formatDate(endDate)}`,
                  `Duration: ${durationText}`,
                ]
                  .filter(Boolean)
                  .join('\n');

                return (
                  <div
                    key={`trk-${item.type}-${item.number}`}
                    className="tl-track-row"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="tl-track" style={{ width: trackWidth }}>
                      {showToday && (
                        <div
                          className="tl-today-marker"
                          style={{ left: `${todayLeftPct}%` }}
                        />
                      )}
                      <div
                        className={barClass}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={tooltip}
                      >
                        {barLabel}
                      </div>
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
