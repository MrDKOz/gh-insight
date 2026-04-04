import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { SortCol, SortDir } from "../utils/reviewWaitUtils";
import type { FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { memo, useMemo, useState } from "react";

import { useColumnResize } from "../hooks/useColumnResize";
import { COLORS, COLORS_CB, makeStatusChipSx } from "../utils/colorUtils";
import { fmtDate } from "../utils/dateUtils";
import { FS, buildMilestoneMap, safeUrl } from "../utils/displayUtils";
import { buildRows, sortRows } from "../utils/reviewWaitUtils";
import { RESIZE_HANDLE_SX, TABLE_HEADER_CELL_SX } from "../utils/sxTokens";
import { AuthorWithAssignees } from "./AuthorWithAssignees";
import { LabelBadge } from "./LabelBadge";
import { MilestonePill } from "./MilestonePill";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  colorblindMode: boolean;
};

// Default column widths (px): #, title, author, status, created, firstReview, wait, bar, total, [milestone]
const DEFAULTS_SINGLE = [60, 300, 160, 88, 92, 105, 76, 140, 76] as const;
const DEFAULTS_MULTI  = [60, 300, 160, 88, 92, 105, 76, 140, 76, 120] as const;

// Amber for review-wait segment, neutral/sky-blue for post-review segment
const BAR_WAIT    = COLORS.warningDark;
const BAR_DONE    = COLORS.chartBarDone;
const BAR_WAIT_CB = COLORS_CB.prClosed;
const BAR_DONE_CB = COLORS_CB.chartBarDone;

type ThProps = {
  col: SortCol;
  label: string;
  active: SortCol;
  dir: SortDir;
  onSort: (c: SortCol) => void;
  onResize: (e: MouseEvent) => void;
  align?: "left" | "right";
};

// Defined at module level to prevent remount during resize drags.
const Th: FunctionComponent<ThProps> = ({ col, label, active, dir, onSort, onResize, align = "left" }) => (
  <TableCell align={align} sx={TABLE_HEADER_CELL_SX}>
    <TableSortLabel
      active={active === col}
      direction={active === col ? dir : "asc"}
      onClick={() => onSort(col)}
    >
      {label}
    </TableSortLabel>
    <Box onMouseDown={onResize} sx={RESIZE_HANDLE_SX} />
  </TableCell>
);

const ReviewWaitListInner: FunctionComponent<Props> = ({ items, milestones, colorblindMode }) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;
  const statusChipSx = makeStatusChipSx(colorblindMode);
  const [sortCol, setSortCol] = useState<SortCol>("wait");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const isMulti = milestones.length > 1;
  const milestoneMap = useMemo(() => buildMilestoneMap(milestones), [milestones]);

  const barWait = colorblindMode ? BAR_WAIT_CB : BAR_WAIT;
  const barDone = colorblindMode ? BAR_DONE_CB : BAR_DONE;

  const defaultWidths = isMulti ? [...DEFAULTS_MULTI] : [...DEFAULTS_SINGLE];
  const { widths: colWidths, startResize } = useColumnResize(defaultWidths);
  const widths = colWidths.length === defaultWidths.length ? colWidths : defaultWidths;

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {setSortDir((d) => (d === "asc" ? "desc" : "asc"));}
    else { setSortCol(col); setSortDir(col === "wait" ? "desc" : "asc"); }
  };

  const rows = useMemo(() => buildRows(items), [items]);
  const sorted = useMemo(() => sortRows(rows, sortCol, sortDir), [rows, sortCol, sortDir]);

  // Scale all bars against the longest PR so widths are comparable across rows.
  const maxTotal = useMemo(
    () => Math.max(1, ...rows.map((r) => r.totalDays ?? 0)),
    [rows],
  );

  // Pre-compute all per-row display values so the render loop stays thin
  const displayRows = useMemo(() => sorted.map((row) => {
    const waitPct = row.reviewWaitDays !== null
      ? Math.min(100, (row.reviewWaitDays / maxTotal) * 100)
      : 0;
    const donePct = row.totalDays !== null && row.totalDays > 0
      ? Math.min(100 - waitPct, ((row.totalDays - (row.reviewWaitDays ?? 0)) / maxTotal) * 100)
      : 0;
    return {
      row,
      milestoneMeta: isMulti ? milestoneMap.get(row.milestoneNumber) : undefined,
      waitPct,
      donePct,
      isOpen:     row.status === "Open",
      waitLabel:  row.reviewWaitDays === null ? "—" : row.reviewWaitDays === 0 ? "same day" : `${row.reviewWaitDays}d`,
      totalLabel: row.totalDays === null ? "open" : row.totalDays === 0 ? "same day" : `${row.totalDays}d`,
    };
  }), [sorted, maxTotal, isMulti, milestoneMap]);

  // Helper to build the onResize handler for a given column index.
  const resize = (i: number) => (e: MouseEvent) => startResize(i, e, widths[i] ?? 0);

  // Column indices: #=0, title=1, author=2, status=3, created=4, firstReview=5, wait=6, bar=7, total=8, [milestone=9]
  const COLUMN_INDICES = { num: 0, title: 1, author: 2, status: 3, created: 4, firstReview: 5, wait: 6, bar: 7, total: 8, milestone: 9 };

  if (rows.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        No pull requests found in the selected items.
      </Typography>
    );
  }

  return (
    <>
    <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflowX: "auto" }}>
      <Table size="small" aria-label="Review wait time per pull request" sx={{ tableLayout: "fixed", minWidth: widths.reduce((sum, w) => sum + w, 0) }}>
        <colgroup>
          {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <TableHead>
          <TableRow>
            <Th col="number"      label="#"                  active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.num)} />
            <Th col="title"       label="Pull Request"       active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.title)} />
            <Th col="author"      label="Author / Assignees" active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.author)} />
            <Th col="status"      label="Status"             active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.status)} />
            <Th col="created"     label="Created"            active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.created)} />
            <Th col="firstReview" label="First Review"       active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.firstReview)} />
            <Th col="wait"        label="Wait"               active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.wait)} align="right" />
            <TableCell sx={TABLE_HEADER_CELL_SX}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                Wait vs Total
                <Tooltip
                  title={
                    <Box component="span" sx={{ display: "block", maxWidth: 260 }}>
                      Each bar is split into two segments:<br />
                      <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: 0.5, bgcolor: barWait, mr: 0.5, verticalAlign: "middle" }} />
                      <strong>Amber</strong> — days waiting for first review<br />
                      <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: 0.5, bgcolor: barDone, mr: 0.5, verticalAlign: "middle" }} />
                      <strong>Grey</strong> — days from first review to close<br /><br />
                      Bar width is proportional to the longest PR in the current view, so you can compare durations at a glance.
                    </Box>
                  }
                  placement="bottom-start"
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 14, height: 14, borderRadius: "50%",
                      border: 1, borderColor: "text.disabled",
                      fontSize: 9, fontWeight: 700, color: "text.disabled",
                      cursor: "default", flexShrink: 0, lineHeight: 1,
                    }}
                    aria-label="Bar column explanation"
                  >
                    ?
                  </Box>
                </Tooltip>
              </Box>
              <Box onMouseDown={resize(COLUMN_INDICES.bar)} sx={RESIZE_HANDLE_SX} />
            </TableCell>
            <Th col="total"       label="Total"              active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(COLUMN_INDICES.total)} align="right" />
            {isMulti && (
              <TableCell sx={TABLE_HEADER_CELL_SX}>
                Milestone
                <Box onMouseDown={resize(COLUMN_INDICES.milestone)} sx={RESIZE_HANDLE_SX} />
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {displayRows.map(({ row, milestoneMeta, waitPct, donePct, isOpen, waitLabel, totalLabel }) => (
              <TableRow
                key={row.number}
                sx={{ opacity: isOpen ? 0.65 : 1, "&:hover": { opacity: 1, bgcolor: "action.hover" }, "&:last-child td": { borderBottom: 0 } }}
              >
                {/* # */}
                <TableCell sx={{ fontSize: FS.base, overflow: "hidden" }}>
                  <Link
                    href={safeUrl(row.url)}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={{ color: row.status === "Merged" ? palette.prMerged : row.status === "Closed" ? palette.prClosed : palette.prMerged, fontWeight: 700, fontSize: FS.base }}
                  >
                    #{row.number}
                  </Link>
                </TableCell>

                {/* Title */}
                <TableCell sx={{ fontSize: FS.md, overflow: "hidden" }}>
                  <Link
                    href={safeUrl(row.url)}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    color="text.primary"
                    sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {row.title}
                  </Link>
                  {row.labels.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px", mt: "3px" }}>
                      {row.labels.map((l) => (
                        <LabelBadge key={l.name} name={l.name} color={l.color} />
                      ))}
                    </Box>
                  )}
                </TableCell>

                {/* Author + assignees */}
                <TableCell sx={{ overflow: "hidden" }}>
                  <AuthorWithAssignees author={row.author} assignees={row.assignees} />
                </TableCell>

                {/* Status */}
                <TableCell sx={{ overflow: "hidden" }}>
                  <Chip
                    label={row.status}
                    size="small"
                    sx={{ ...statusChipSx[row.status.toLowerCase()], fontSize: FS.sm, fontWeight: 600, height: 22 }}
                  />
                </TableCell>

                {/* Created */}
                <TableCell sx={{ fontSize: FS.base, color: "text.secondary", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {fmtDate(row.createdAt)}
                </TableCell>

                {/* First review */}
                <TableCell sx={{ fontSize: FS.base, overflow: "hidden", whiteSpace: "nowrap" }}>
                  {row.firstReviewAt ? (
                    fmtDate(row.firstReviewAt)
                  ) : (
                    <Typography component="span" sx={{ fontSize: FS.base, color: "text.disabled", fontStyle: "italic" }}>
                      {isOpen ? "Awaiting review" : "Not reviewed"}
                    </Typography>
                  )}
                </TableCell>

                {/* Wait days */}
                <TableCell align="right" sx={{ fontSize: FS.md, fontWeight: row.reviewWaitDays !== null ? 600 : 400, overflow: "hidden", whiteSpace: "nowrap", color: row.reviewWaitDays === null ? "text.disabled" : "text.primary" }}>
                  {waitLabel}
                </TableCell>

                {/* Bar */}
                <TableCell sx={{ py: 1, overflow: "hidden" }}>
                  {row.reviewWaitDays !== null ? (
                    <Tooltip
                      title={
                        row.totalDays !== null
                          ? `${row.reviewWaitDays}d waiting for review · ${row.totalDays - row.reviewWaitDays}d post-review`
                          : `${row.reviewWaitDays}d waiting for review · PR still open`
                      }
                    >
                      <Box
                        sx={{ display: "flex", height: 8, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover", cursor: "default" }}
                        role="img"
                        aria-label={
                          row.totalDays !== null
                            ? `Review wait ${row.reviewWaitDays} days out of ${row.totalDays} total`
                            : `Review wait ${row.reviewWaitDays} days, PR still open`
                        }
                      >
                        <Box sx={{ width: `${waitPct}%`, bgcolor: barWait, flexShrink: 0 }} />
                        {donePct > 0 && (
                          <Box sx={{ width: `${donePct}%`, bgcolor: barDone, flexShrink: 0 }} />
                        )}
                        {isOpen && (
                          <Box sx={{ flex: 1, bgcolor: "action.disabledBackground" }} />
                        )}
                      </Box>
                    </Tooltip>
                  ) : (
                    <Box sx={{ height: 8, borderRadius: 1, bgcolor: "action.hover" }} role="presentation" />
                  )}
                </TableCell>

                {/* Total */}
                <TableCell align="right" sx={{ fontSize: FS.md, fontWeight: row.totalDays !== null ? 600 : 400, overflow: "hidden", whiteSpace: "nowrap", color: row.totalDays === null ? "text.secondary" : "text.primary" }}>
                  {totalLabel}
                </TableCell>

                {/* Milestone (multi only) */}
                {isMulti && (
                  <TableCell sx={{ fontSize: FS.base, overflow: "hidden", whiteSpace: "nowrap" }}>
                    {milestoneMeta && <MilestonePill color={milestoneMeta.color} title={milestoneMeta.title} size={10} />}
                  </TableCell>
                )}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
    <Box sx={{ display: "flex", gap: 2.5, px: 0.5, pt: 1, alignItems: "center", flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: barWait, flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary">Waiting for first review</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: barDone, flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary">Post-review</Typography>
      </Box>
      <Typography variant="caption" color="text.disabled">Bar width proportional to longest PR</Typography>
    </Box>
    </>
  );
};

const ReviewWaitList = memo(ReviewWaitListInner);
export { ReviewWaitList };
