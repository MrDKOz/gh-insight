import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { TimelineItem, MilestoneMeta } from './types';
import { MS, itemEndDate } from './utils';
import { exportCSV, exportMarkdown, exportPNG, exportPDF, exportXLSX } from './export';
import StatsBar from './StatsBar';
import FilterBar, { DEFAULT_FILTERS, applyFilters } from './FilterBar';
import type { Filters } from './FilterBar';
import Burndown from './Burndown';
import CycleTime from './CycleTime';
import Velocity from './Velocity';
import CumulativeFlow from './CumulativeFlow';
import ItemList from './ItemList';
import GanttView from './GanttView';

interface Props {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
}


type ExportFormat = 'CSV' | 'XLSX' | 'Markdown' | 'PNG — Current view' | 'PNG — Full timeline' | 'PDF';
const EXPORT_FORMATS: ExportFormat[] = ['CSV', 'XLSX', 'Markdown', 'PNG — Current view', 'PNG — Full timeline', 'PDF'];

type View = 'Gantt' | 'Burndown' | 'Cycle Time' | 'Velocity' | 'Cumulative Flow' | 'List';
const VIEWS: View[] = ['Gantt', 'Burndown', 'Cycle Time', 'Velocity', 'Cumulative Flow', 'List'];

export default function Timeline({ items, milestones }: Props) {
  const [labelWidth, setLabelWidth]   = useState(400);
  const [pixelsPerDay, setPixelsPerDay] = useState(30);
  const [axisHeight, setAxisHeight]   = useState(36);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting]       = useState<ExportFormat | null>(null);
  const [view, setView]                 = useState<View>('Gantt');
  const [viewAnchor, setViewAnchor]     = useState<HTMLElement | null>(null);
  const [filters, setFilters]           = useState<Filters>(DEFAULT_FILTERS);

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const trackColRef = useRef<HTMLDivElement>(null);
  const axisRef     = useRef<HTMLDivElement>(null);
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


  // ── Export ─────────────────────────────────────────────────────────────────

  // "PNG — Current view" only makes sense for Gantt (scroll-position matters).
  const disabledExports = useMemo<Partial<Record<ExportFormat, string>>>(
    () => view !== 'Gantt'
      ? { 'PNG — Current view': 'No scroll position in this view — use PNG — Full timeline' }
      : {},
    [view],
  );
  const hasLimitedExports = Object.keys(disabledExports).length > 0;

  const handleExport = useCallback(async (fmt: ExportFormat) => {
    if (disabledExports[fmt]) return;
    setExportAnchor(null);
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
  }, [filteredCompletedItems, title, disabledExports]);

  // ── Gantt layout ───────────────────────────────────────────────────────────

  const allTimestamps = useMemo(
    () => filteredItems.flatMap(item => {
      const end = itemEndDate(item);
      const ts  = [new Date(item.createdAt).getTime()];
      if (end) ts.push(new Date(end).getTime());
      return ts;
    }),
    [filteredItems],
  );

  const { todayMs, minTime, totalMs, totalDays, trackWidth } = useMemo(() => {
    const now = Date.now();
    if (allTimestamps.length === 0) {
      return { todayMs: now, minTime: now, totalMs: 1, totalDays: 1, trackWidth: 500 };
    }
    const min      = Math.min(...allTimestamps);
    const max      = Math.max(...allTimestamps, now);
    const totalMs  = max - min || 1;
    const totalDays = totalMs / MS;
    return {
      todayMs:    now,
      minTime:    min,
      totalMs,
      totalDays,
      trackWidth: Math.max(500, Math.round(totalDays * pixelsPerDay)),
    };
  }, [allTimestamps, pixelsPerDay]);

  // Keep ref values current for the wheel-zoom handler without adding them to its deps
  useLayoutEffect(() => {
    stateRef.current = { pixelsPerDay, totalDays, trackWidth };
  }, [pixelsPerDay, totalDays, trackWidth]);

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

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>No items found in this milestone.</Typography>
      </Paper>
    );
  }

  const noFilteredItems = filteredItems.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }} ref={wrapperRef}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {issueItems.length} issue{issueItems.length !== 1 ? 's' : ''} ({closedIssues.length} closed),{' '}
            {prItems.length} PR{prItems.length !== 1 ? 's' : ''} ({mergedPRs.length} merged)
          </Typography>
        </Box>

        <Stack direction="row" gap={1} alignItems="center" flexShrink={0} data-export-exclude>
          {/* View switcher */}
          <Button variant="outlined" size="small" onClick={e => setViewAnchor(e.currentTarget)}>
            {view} ▾
          </Button>
          <Menu anchorEl={viewAnchor} open={Boolean(viewAnchor)} onClose={() => setViewAnchor(null)}>
            {VIEWS.map(v => (
              <MenuItem key={v} selected={v === view} dense onClick={() => { setView(v); setViewAnchor(null); }}>
                {v}
              </MenuItem>
            ))}
          </Menu>

          {/* Export */}
          <Badge color="warning" variant="dot" invisible={!hasLimitedExports} title={hasLimitedExports ? 'Some export formats are not available in this view' : undefined}>
            <Button
              variant="outlined"
              size="small"
              onClick={e => setExportAnchor(e.currentTarget)}
              disabled={exporting !== null}
            >
              {exporting ? `Exporting ${exporting}…` : 'Export ▾'}
            </Button>
          </Badge>
          <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
            {EXPORT_FORMATS.map(fmt => {
              const reason = disabledExports[fmt];
              return (
                <MenuItem key={fmt} disabled={!!reason} dense onClick={() => handleExport(fmt)} title={reason}>
                  {fmt}
                </MenuItem>
              );
            })}
          </Menu>
        </Stack>
      </Stack>

      {/* Stats bar */}
      <StatsBar items={filteredItems} />

      {/* Filter bar */}
      <FilterBar filters={filters} counts={counts} onChange={setFilters} />

      {/* Non-Gantt views */}
      {noFilteredItems && <Typography color="text.secondary" sx={{ py: 2 }}>No items match the current filters.</Typography>}
      {!noFilteredItems && view === 'Burndown'        && <Burndown items={filteredItems} />}
      {!noFilteredItems && view === 'Cycle Time'      && <CycleTime items={filteredItems} />}
      {!noFilteredItems && view === 'Velocity'        && <Velocity items={filteredItems} />}
      {!noFilteredItems && view === 'Cumulative Flow' && <CumulativeFlow items={filteredItems} />}
      {!noFilteredItems && view === 'List'            && <ItemList items={filteredItems} milestones={milestones} />}

      {/* Gantt view */}
      {!noFilteredItems && view === 'Gantt' && (
        <GanttView
          sortedItems={sortedItems}
          milestones={milestones}
          isMultiMilestone={isMultiMilestone}
          milestoneColorMap={milestoneColorMap}
          hasOpenIssues={openIssues.length > 0}
          labelWidth={labelWidth}
          axisHeight={axisHeight}
          trackWidth={trackWidth}
          minTime={minTime}
          totalMs={totalMs}
          todayMs={todayMs}
          trackColRef={trackColRef}
          axisRef={axisRef}
          onResizeStart={handleResizeStart}
        />
      )}
    </Paper>
  );
}
