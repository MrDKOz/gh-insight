import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
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
import { MS, fmtDate } from "../utils/dateUtils";
import { FS, itemStatus, safeUrl } from "../utils/displayUtils";
import { RESIZE_HANDLE_SX } from "../utils/sxTokens";
import { AuthorWithAssignees } from "./AuthorWithAssignees";
import { LabelBadge } from "./LabelBadge";
import { MilestonePill } from "./MilestonePill";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  colorblindMode: boolean;
};

type SortCol = "number" | "title" | "author" | "status" | "created" | "firstReview" | "wait" | "total";
type SortDir = "asc" | "desc";

type PRRow = {
  number: number;
  title: string;
  url: string;
  author: string;
  assignees: string[];
  labels: { name: string; color: string }[];
  status: "Open" | "Merged" | "Closed";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  firstReviewAt: string | null;
  /** Days from creation to first review, or null if no review yet */
  reviewWaitDays: number | null;
  /** Days from creation to merge/close, or null if still open */
  totalDays: number | null;
  milestoneNumber: number;
};

// Default column widths (px): #, title, author, status, created, firstReview, wait, bar, total, [milestone]
const DEFAULTS_SINGLE = [60, 300, 160, 88, 92, 105, 76, 140, 76] as const;
const DEFAULTS_MULTI  = [60, 300, 160, 88, 92, 105, 76, 140, 76, 120] as const;

const toDays = (ms: number): number => Math.round(ms / MS);

const buildRows = (items: TimelineItem[]): PRRow[] => items
    .filter((i): i is Extract<TimelineItem, { type: "pr" }> => i.type === "pr")
    .map((pr) => {
      const createdMs = new Date(pr.createdAt).getTime();
      const endMs = pr.mergedAt
        ? new Date(pr.mergedAt).getTime()
        : pr.closedAt
          ? new Date(pr.closedAt).getTime()
          : null;
      const reviewMs = pr.firstReviewAt ? new Date(pr.firstReviewAt).getTime() : null;

      return {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        author: pr.author,
        assignees: pr.assignees,
        labels: pr.labels,
        status: itemStatus(pr),
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
        closedAt: pr.closedAt,
        firstReviewAt: pr.firstReviewAt,
        reviewWaitDays: reviewMs !== null ? Math.max(0, toDays(reviewMs - createdMs)) : null,
        totalDays: endMs !== null ? Math.max(0, toDays(endMs - createdMs)) : null,
        milestoneNumber: pr.milestoneNumber,
      };
    });

const sortRows = (rows: PRRow[], col: SortCol, dir: SortDir): PRRow[] => {
  const asc = dir === "asc";
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "number":   cmp = a.number - b.number; break;
      case "title":    cmp = a.title.localeCompare(b.title); break;
      case "author":   cmp = a.author.localeCompare(b.author); break;
      case "status":   cmp = a.status.localeCompare(b.status); break;
      case "created":  cmp = a.createdAt.localeCompare(b.createdAt); break;
      case "firstReview":
        // Nulls always last regardless of direction
        if (a.firstReviewAt === null && b.firstReviewAt === null) {cmp = 0;}
        else if (a.firstReviewAt === null) {return 1;}
        else if (b.firstReviewAt === null) {return -1;}
        else {cmp = a.firstReviewAt.localeCompare(b.firstReviewAt);}
        break;
      case "wait":
        if (a.reviewWaitDays === null && b.reviewWaitDays === null) {cmp = 0;}
        else if (a.reviewWaitDays === null) {return 1;}
        else if (b.reviewWaitDays === null) {return -1;}
        else {cmp = a.reviewWaitDays - b.reviewWaitDays;}
        break;
      case "total":
        if (a.totalDays === null && b.totalDays === null) {cmp = 0;}
        else if (a.totalDays === null) {return 1;}
        else if (b.totalDays === null) {return -1;}
        else {cmp = a.totalDays - b.totalDays;}
        break;
    }
    return asc ? cmp : -cmp;
  });
};

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
  onResize: (e: React.MouseEvent) => void;
  align?: "left" | "right";
};

// Defined at module level to prevent remount during resize drags.
const Th: FunctionComponent<ThProps> = ({ col, label, active, dir, onSort, onResize, align = "left" }) => (
  <TableCell align={align} sx={{ fontWeight: 600, fontSize: FS.sm, whiteSpace: "nowrap", py: 1, position: "relative", overflow: "hidden", userSelect: "none" }}>
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
  const milestoneMap = useMemo(() => new Map(milestones.map((m) => [m.number, m])), [milestones]);

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

  const maxWait = useMemo(
    () => Math.max(1, ...rows.map((r) => r.reviewWaitDays ?? 0)),
    [rows],
  );

  // Helper to build the onResize handler for a given column index.
  const resize = (i: number) => (e: React.MouseEvent) => startResize(i, e, widths[i] ?? 0);

  // Column indices: #=0, title=1, author=2, status=3, created=4, firstReview=5, wait=6, bar=7, total=8, [milestone=9]
  const CI = { num: 0, title: 1, author: 2, status: 3, created: 4, firstReview: 5, wait: 6, bar: 7, total: 8, milestone: 9 };

  if (rows.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        No pull requests found in the selected milestone{milestones.length !== 1 ? "s" : ""}.
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflowX: "auto" }}>
      <Table size="small" aria-label="Review wait time per pull request" sx={{ tableLayout: "fixed", minWidth: widths.reduce((s, w) => s + w, 0) }}>
        <colgroup>
          {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <TableHead>
          <TableRow>
            <Th col="number"      label="#"                  active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.num)} />
            <Th col="title"       label="Pull Request"       active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.title)} />
            <Th col="author"      label="Author / Assignees" active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.author)} />
            <Th col="status"      label="Status"             active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.status)} />
            <Th col="created"     label="Created"            active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.created)} />
            <Th col="firstReview" label="First Review"       active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.firstReview)} />
            <Th col="wait"        label="Wait"               active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.wait)} align="right" />
            <TableCell sx={{ fontWeight: 600, fontSize: FS.sm, py: 1, position: "relative", overflow: "hidden", userSelect: "none" }}>
              Wait vs Total
              <Box onMouseDown={resize(CI.bar)} sx={RESIZE_HANDLE_SX} />
            </TableCell>
            <Th col="total"       label="Total"              active={sortCol} dir={sortDir} onSort={handleSort} onResize={resize(CI.total)} align="right" />
            {isMulti && (
              <TableCell sx={{ fontWeight: 600, fontSize: FS.sm, py: 1, position: "relative", overflow: "hidden", userSelect: "none" }}>
                Milestone
                <Box onMouseDown={resize(CI.milestone)} sx={RESIZE_HANDLE_SX} />
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row) => {
            const ms = isMulti ? milestoneMap.get(row.milestoneNumber) : null;

            // Bar proportions
            const waitPct =
              row.reviewWaitDays !== null && row.totalDays !== null && row.totalDays > 0
                ? Math.min(100, (row.reviewWaitDays / row.totalDays) * 100)
                : row.reviewWaitDays !== null
                  ? Math.min(100, (row.reviewWaitDays / maxWait) * 100) // open PR: scale to max wait
                  : 0;
            const donePct = row.totalDays !== null && row.totalDays > 0
              ? Math.max(0, 100 - waitPct)
              : 0;
            const isOpen = row.status === "Open";

            const waitLabel =
              row.reviewWaitDays === null
                ? "—"
                : row.reviewWaitDays === 0
                  ? "same day"
                  : `${row.reviewWaitDays}d`;

            const totalLabel =
              row.totalDays === null
                ? "open"
                : row.totalDays === 0
                  ? "same day"
                  : `${row.totalDays}d`;

            return (
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
                    {ms && <MilestonePill color={ms.color} title={ms.title} size={10} />}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ReviewWaitList = memo(ReviewWaitListInner);
export { ReviewWaitList };
