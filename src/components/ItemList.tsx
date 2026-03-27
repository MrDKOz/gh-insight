import type { MilestoneMeta, TimelineItem } from "../types";
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
import Typography from "@mui/material/Typography";
import { memo, useMemo, useState } from "react";
import { COLORS, COLORS_CB, MS, fmtDate, itemEndDate, itemStatus, makeStatusChipSx, pluralize, safeUrl } from "../utils/utils";
import { AuthorWithAssignees } from "./AuthorWithAssignees";
import { LabelBadge } from "./LabelBadge";
import { MilestonePill } from "./MilestonePill";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  colorblindMode: boolean;
};

type SortCol = "type" | "number" | "title" | "author" | "status" | "milestone" | "created" | "closed" | "days";
type SortDir = "asc" | "desc";


const ItemListInner: FunctionComponent<Props> = ({ items, milestones, colorblindMode }) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;
  const [sortCol, setSortCol] = useState<SortCol>("number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const isMulti = milestones.length > 1;

  const milestoneMap = useMemo(() => new Map(milestones.map((m) => [m.number, m])), [milestones]);

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "number":
          cmp = a.number - b.number;
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "author":
          cmp = a.author.localeCompare(b.author);
          break;
        case "status":
          cmp = itemStatus(a).localeCompare(itemStatus(b));
          break;
        case "milestone":
          cmp = (milestoneMap.get(a.milestoneNumber)?.title ?? "").localeCompare(
            milestoneMap.get(b.milestoneNumber)?.title ?? "",
          );
          break;
        case "created":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "closed": {
          const ea = itemEndDate(a),
            eb = itemEndDate(b);
          if (!ea && !eb) {cmp = 0;}
          else if (!ea) {cmp = 1;}
          else if (!eb) {cmp = -1;}
          else {cmp = new Date(ea).getTime() - new Date(eb).getTime();}
          break;
        }
        case "days": {
          const ea = itemEndDate(a),
            eb = itemEndDate(b);
          const da = ea ? (new Date(ea).getTime() - new Date(a.createdAt).getTime()) / MS : Infinity;
          const db = eb ? (new Date(eb).getTime() - new Date(b.createdAt).getTime()) / MS : Infinity;
          cmp = da - db;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    }), [items, sortCol, sortDir, milestoneMap]);

  const typeBadgeSx: Record<string, object> = {
    issue: { bgcolor: palette.issue, color: "#fff" },
    pr: { bgcolor: palette.prMerged, color: "#fff" },
    "pr-closed": { bgcolor: palette.prClosed, color: colorblindMode ? "#000" : "#fff" },
  };

  const statusChipSx = makeStatusChipSx(colorblindMode);

  const Th: FunctionComponent<{ col: SortCol; label: string }> = ({ col, label }) => (
    <TableCell
      sortDirection={sortCol === col ? sortDir : false}
      sx={{ fontWeight: 600, fontSize: "0.6875rem", py: 1, whiteSpace: "nowrap" }}
    >
      <TableSortLabel
        active={sortCol === col}
        direction={sortCol === col ? sortDir : "asc"}
        onClick={() => handleSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <Th col="type" label="Type" />
            <Th col="number" label="#" />
            <Th col="title" label="Title" />
            <Th col="author" label="Author / Assignees" />
            <Th col="status" label="Status" />
            {isMulti && <Th col="milestone" label="Milestone" />}
            <Th col="created" label="Created" />
            <Th col="closed" label="Closed" />
            <Th col="days" label="Days" />
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((item) => {
            const end = itemEndDate(item);
            const status = itemStatus(item);
            const days = end
              ? Math.round((new Date(end).getTime() - new Date(item.createdAt).getTime()) / MS)
              : null;
            const isOpen = status === "Open";
            const isClosedPR = item.type === "pr" && !item.mergedAt && !!item.closedAt;
            const badgeKey = item.type === "issue" ? "issue" : isClosedPR ? "pr-closed" : "pr";
            const ms = milestoneMap.get(item.milestoneNumber);

            return (
              <TableRow
                key={`${item.type}-${item.number}`}
                sx={{ opacity: isOpen ? 0.65 : 1, "&:hover": { opacity: 1, bgcolor: "action.hover" } }}
              >
                <TableCell>
                  <Chip
                    label={item.type.toUpperCase()}
                    size="small"
                    sx={{
                      ...typeBadgeSx[badgeKey],
                      fontSize: "0.5625rem",
                      fontWeight: 700,
                      height: 18,
                      letterSpacing: 0.3,
                      borderRadius: 0.5,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={safeUrl(item.url)}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    aria-label={`${item.type === "pr" ? "PR" : "Issue"} #${item.number}: ${item.title}`}
                    sx={{
                      color: item.type === "issue" ? palette.issue : palette.prMerged,
                      fontWeight: 700,
                      fontSize: "0.75rem",
                    }}
                  >
                    #{item.number}
                  </Link>
                </TableCell>
                <TableCell sx={{ maxWidth: 380 }}>
                  <Link
                    href={safeUrl(item.url)}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    color="text.primary"
                    sx={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {item.type === "issue" && item.reopenedCount > 0 && (
                      <Box component="span" title={`Reopened ${pluralize(item.reopenedCount, "time")}`} sx={{ color: "#d97706", mr: "4px", fontSize: "0.75rem" }}>↺</Box>
                    )}
                    {item.title}
                  </Link>
                  {item.labels.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px", mt: "3px" }}>
                      {item.labels.map((l) => (
                        <LabelBadge key={l.name} name={l.name} color={l.color} fontSize="0.5rem" />
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: "0.75rem" }}>
                  <AuthorWithAssignees author={item.author} assignees={item.assignees} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={status}
                    size="small"
                    sx={{ ...statusChipSx[status.toLowerCase()], fontSize: "0.6875rem", fontWeight: 600, height: 22 }}
                  />
                </TableCell>
                {isMulti && (
                  <TableCell>
                    {ms && <MilestonePill color={ms.color} title={ms.title} />}
                  </TableCell>
                )}
                <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: "0.75rem" }}>
                  {fmtDate(item.createdAt)}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: "0.75rem" }}>
                  {end ? fmtDate(end) : <Typography component="span" color="divider">—</Typography>}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}
                >
                  {days !== null ? days : <Typography component="span" color="divider">—</Typography>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ItemList = memo(ItemListInner);

export { ItemList };
