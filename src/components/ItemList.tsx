import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
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
import { memo, useCallback, useMemo, useState } from "react";

import { useColumnResize } from "../hooks/useColumnResize";
import { COLORS, COLORS_CB } from "../utils/colorUtils";
import { MS_PER_DAY, fmtDate } from "../utils/dateUtils";
import { FS, buildMilestoneMap, itemEndDate, itemStatus, pluralize, safeUrl } from "../utils/displayUtils";
import { RESIZE_HANDLE_SX, TABLE_HEADER_CELL_SX, TABULAR_NUMS_SX } from "../utils/sxTokens";
import { AuthorWithAssignees } from "./AuthorWithAssignees";
import { LabelBadge } from "./LabelBadge";
import { MilestonePill } from "./MilestonePill";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  colorblindMode: boolean;
};

type SortCol = "type" | "number" | "title" | "author" | "status" | "milestone" | "changes" | "created" | "closed" | "days";
type SortDir = "asc" | "desc";

// Default column widths (px): type, #, title, author, status, [milestone,] changes, created, closed, days
const DEFAULTS_SINGLE = [56, 60, 320, 160, 88,      90, 92, 92, 62] as const;
const DEFAULTS_MULTI  = [56, 60, 320, 160, 88, 120, 90, 92, 92, 62] as const;

type ThProps = {
  col: SortCol;
  label: string;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
  onResize: (e: MouseEvent) => void;
};

// Defined outside ItemListInner so React doesn't see a new component type on
// every render (which would cause unnecessary unmount/remount during resize drags).
const Th: FunctionComponent<ThProps> = ({ col, label, sortCol, sortDir, onSort, onResize }) => (
  <TableCell
    sortDirection={sortCol === col ? sortDir : false}
    sx={TABLE_HEADER_CELL_SX}
  >
    <TableSortLabel
      active={sortCol === col}
      direction={sortCol === col ? sortDir : "asc"}
      onClick={() => onSort(col)}
    >
      {label}
    </TableSortLabel>
    <Box onMouseDown={onResize} sx={RESIZE_HANDLE_SX} />
  </TableCell>
);

const ItemListInner: FunctionComponent<Props> = ({ items, milestones, colorblindMode }) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;
  const [sortCol, setSortCol] = useState<SortCol>("number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const isMulti = milestones.length > 1;
  const milestoneMap = useMemo(() => buildMilestoneMap(milestones), [milestones]);

  const defaultWidths = isMulti ? [...DEFAULTS_MULTI] : [...DEFAULTS_SINGLE];
  const { widths: colWidths, startResize } = useColumnResize(defaultWidths);
  // Guard: if isMulti changed since mount the lengths won't match — fall back to defaults.
  const widths = colWidths.length === defaultWidths.length ? colWidths : defaultWidths;

  const handleSort = useCallback((col: SortCol) => {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }, [sortCol]);

  const sorted = useMemo(() => {
    const now = Date.now();
    // Parse each item's timestamps once up-front; comparators then work on numbers only.
    const enriched = items.map((item) => {
      const end       = itemEndDate(item);
      const status    = itemStatus(item);
      const createdMs = new Date(item.createdAt).getTime();
      const updatedMs = new Date(item.updatedAt).getTime();
      const endMs     = end ? new Date(end).getTime() : null;
      return { item, end, status, createdMs, updatedMs, endMs };
    });
    return enriched.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "type":
          cmp = a.item.type.localeCompare(b.item.type);
          break;
        case "number":
          cmp = a.item.number - b.item.number;
          break;
        case "title":
          cmp = a.item.title.localeCompare(b.item.title);
          break;
        case "author":
          cmp = a.item.author.localeCompare(b.item.author);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "milestone":
          cmp = (milestoneMap.get(a.item.milestoneNumber)?.title ?? "").localeCompare(
            milestoneMap.get(b.item.milestoneNumber)?.title ?? "",
          );
          break;
        case "changes": {
          const ca = a.item.type === "pr" ? a.item.additions + a.item.deletions : 0;
          const cb = b.item.type === "pr" ? b.item.additions + b.item.deletions : 0;
          cmp = ca - cb;
          break;
        }
        case "created":
          cmp = a.createdMs - b.createdMs;
          break;
        case "closed": {
          if (a.endMs === null && b.endMs === null) {cmp = 0;}
          else if (a.endMs === null) {cmp = 1;}
          else if (b.endMs === null) {cmp = -1;}
          else {cmp = a.endMs - b.endMs;}
          break;
        }
        case "days": {
          const da = a.endMs !== null ? (a.endMs - a.createdMs) / MS_PER_DAY : (now - a.createdMs) / MS_PER_DAY;
          const db = b.endMs !== null ? (b.endMs - b.createdMs) / MS_PER_DAY : (now - b.createdMs) / MS_PER_DAY;
          cmp = da - db;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    }).map(({ item, end, status, createdMs, updatedMs, endMs }) => {
      const isOpen     = status === "Open";
      const isClosedPR = item.type === "pr" && !item.mergedAt && !!item.closedAt;
      const days       = endMs !== null ? Math.round((endMs - createdMs) / MS_PER_DAY) : null;
      const age        = Math.floor((now - createdMs) / MS_PER_DAY);
      const staleDays  = Math.floor((now - updatedMs) / MS_PER_DAY);
      return {
        item, end, status, isOpen, days, age, staleDays,
        badgeKey: item.type === "issue" ? "issue" : isClosedPR ? "pr-closed" : "pr",
        milestoneMeta: milestoneMap.get(item.milestoneNumber),
        isStale:  isOpen && staleDays > 7,
      } as const;
    });
  }, [items, sortCol, sortDir, milestoneMap]);

  const typeBadgeSx = useMemo((): Record<string, object> => ({
    issue:       { bgcolor: palette.issue,    color: "#fff" },
    pr:          { bgcolor: palette.prMerged, color: "#fff" },
    "pr-closed": { bgcolor: palette.prClosed, color: colorblindMode ? "#000" : "#fff" },
  }), [palette, colorblindMode]);

  const statusColor: Record<string, string> = {
    open:   palette.warning,
    closed: palette.prClosed,
    merged: palette.prMerged,
  };

  // Helper to build the onResize handler for a given column index.
  const resize = useCallback((i: number) => (e: MouseEvent) => startResize(i, e, widths[i] ?? 0), [startResize, widths]);

  // Column indices shift when milestone is visible.
  const columnIndices = isMulti
    ? { type: 0, num: 1, title: 2, author: 3, status: 4, milestone: 5, changes: 6, created: 7, closed: 8, days: 9 }
    : { type: 0, num: 1, title: 2, author: 3, status: 4, milestone: -1, changes: 5, created: 6, closed: 7, days: 8 };

  return (
    <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflowX: "auto" }}>
      <Table size="small" sx={{ tableLayout: "fixed", minWidth: widths.reduce((sum, w) => sum + w, 0) }}>
        <colgroup>
          {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <TableHead>
          <TableRow>
            <Th col="type"      label="Type"               sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.type)} />
            <Th col="number"    label="#"                  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.num)} />
            <Th col="title"     label="Title"              sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.title)} />
            <Th col="author"    label="Author / Assignees" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.author)} />
            <Th col="status"    label="Status"             sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.status)} />
            {isMulti && <Th col="milestone" label="Milestone" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.milestone)} />}
            <Th col="changes"   label="+/−"                sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.changes)} />
            <Th col="created"   label="Created"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.created)} />
            <Th col="closed"    label="Closed"             sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.closed)} />
            <Th col="days"      label="Days"               sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onResize={resize(columnIndices.days)} />
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map(({ item, end, status, isOpen, days, age, staleDays, badgeKey, milestoneMeta, isStale }) => (
              <TableRow
                key={`${item.type}-${item.number}`}
                sx={{ opacity: isOpen ? 0.65 : 1, "&:hover": { opacity: 1, bgcolor: "action.hover" } }}
              >
                <TableCell sx={{ overflow: "hidden" }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px", alignItems: "center" }}>
                    <Chip
                      label={item.type.toUpperCase()}
                      size="small"
                      sx={{
                        ...typeBadgeSx[badgeKey],
                        fontSize: FS.tiny,
                        fontWeight: 700,
                        height: 18,
                        letterSpacing: 0.3,
                        borderRadius: 0.5,
                      }}
                    />
                    {item.type === "pr" && item.isDraft && (
                      <Chip
                        label="DRAFT"
                        size="small"
                        sx={{
                          bgcolor: "action.selected",
                          color: "text.secondary",
                          fontSize: FS.tiny,
                          fontWeight: 700,
                          height: 18,
                          letterSpacing: 0.3,
                          borderRadius: 0.5,
                        }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ overflow: "hidden" }}>
                  <Link
                    href={safeUrl(item.url)}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    aria-label={`${item.type === "pr" ? "PR" : "Issue"} #${item.number}: ${item.title}`}
                    sx={{
                      color: item.type === "issue" ? palette.issue : palette.prMerged,
                      fontWeight: 700,
                      fontSize: FS.base,
                    }}
                  >
                    #{item.number}
                  </Link>
                </TableCell>
                <TableCell sx={{ overflow: "hidden" }}>
                  <Link
                    href={safeUrl(item.url)}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    color="text.primary"
                    // Include stale/reopened state in the link's accessible name so
                    // keyboard/screen-reader users get that context on focus — the
                    // indicator Tooltips only fire on mouse hover.
                    aria-label={[
                      item.title,
                      isStale ? `no activity for ${staleDays} days` : null,
                      item.type === "issue" && item.reopenedCount > 0 ? `reopened ${pluralize(item.reopenedCount, "time")}` : null,
                    ].filter(Boolean).join(" — ")}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: FS.md,
                    }}
                  >
                    {isStale && (
                      <Tooltip title={`No activity for ${staleDays} days`} disableInteractive>
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{
                            display: "inline-block",
                            flexShrink: 0,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: palette.warning,
                            mr: "5px",
                          }}
                        />
                      </Tooltip>
                    )}
                    {item.type === "issue" && item.reopenedCount > 0 && (
                      <Tooltip title={`Reopened ${pluralize(item.reopenedCount, "time")}`} disableInteractive>
                        <Box component="span" aria-hidden="true" sx={{ color: palette.warning, mr: "4px", fontSize: FS.base, flexShrink: 0 }}>↺</Box>
                      </Tooltip>
                    )}
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </Box>
                  </Link>
                  {item.labels.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px", mt: "3px" }}>
                      {item.labels.map((l) => (
                        <LabelBadge key={l.name} name={l.name} color={l.color} />
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ overflow: "hidden", color: "text.secondary", fontSize: FS.base }}>
                  <AuthorWithAssignees author={item.author} assignees={item.assignees} />
                </TableCell>
                <TableCell sx={{ overflow: "hidden" }}>
                  <Box component="span" sx={{ fontSize: FS.base, fontWeight: 600, color: statusColor[status.toLowerCase()] }}>
                    {status}
                    {item.type === "pr" && item.reviewDecision === "APPROVED" && ", approved"}
                    {item.type === "pr" && item.reviewDecision === "CHANGES_REQUESTED" && ", changes requested"}
                    {item.type === "pr" && item.reviewDecision === "REVIEW_REQUIRED" && ", awaiting review"}
                  </Box>
                </TableCell>
                {isMulti && (
                  <TableCell sx={{ overflow: "hidden" }}>
                    {milestoneMeta && <MilestonePill color={milestoneMeta.color} title={milestoneMeta.title} />}
                  </TableCell>
                )}
                <TableCell sx={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                  {item.type === "pr" ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <Box component="span" sx={{ ...TABULAR_NUMS_SX, color: palette.success, fontSize: FS.base, fontWeight: 500 }}>+{item.additions}</Box>
                      <Box component="span" sx={{ ...TABULAR_NUMS_SX, color: palette.prClosed, fontSize: FS.base, fontWeight: 500 }}>−{item.deletions}</Box>
                    </Box>
                  ) : (
                    <Typography component="span" color="divider">—</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ overflow: "hidden", whiteSpace: "nowrap", color: "text.secondary", fontSize: FS.base }}>
                  {fmtDate(item.createdAt)}
                </TableCell>
                <TableCell sx={{ overflow: "hidden", whiteSpace: "nowrap", color: "text.secondary", fontSize: FS.base }}>
                  {end ? fmtDate(end) : <Typography component="span" color="divider">—</Typography>}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ ...TABULAR_NUMS_SX, overflow: "hidden", whiteSpace: "nowrap", color: "text.secondary", fontSize: FS.base }}
                >
                  {isOpen ? age : days}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ItemList = memo(ItemListInner);

export { ItemList };
