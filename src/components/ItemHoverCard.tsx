import type { TimelineItem } from "../types/GitHubTypes";
import type { SxProps } from "@mui/material";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { COLORS, COLORS_CB } from "../utils/colorUtils";
import { FS, pluralize } from "../utils/displayUtils";
import { AuthorTag } from "./AuthorTag";
import { LabelBadge } from "./LabelBadge";

type ItemHoverCardProps = {
  item:            TimelineItem;
  dotColor:        string;
  /** Fully-formatted date range string, e.g. "Jan 15 → Jan 22" or "Mon Jan 15 → ongoing" */
  dateRange:       string;
  /** Pre-computed position style — use fixedItemCardPos() for Gantt, hoverCardPos() for SVG charts */
  positionSx:      SxProps;
  /** Override the default "PR" / "Issue" label, e.g. "PR (merged)" */
  typeLabel?:      string;
  /** Status shown right-aligned in the header, e.g. "Open" / "Merged" */
  statusWord?:     string;
  /** Open indicator dims the dot slightly */
  isOpen?:         boolean;
  /** Bottom metric line, e.g. "14 days" or "14 days cycle time" */
  metric?:         string;
  /** Review wait line shown for PRs when known */
  reviewWaitDays?: number | null;
  /** When provided the card renders as a clickable anchor */
  href?:           string;
  colorblindMode?: boolean;
};

/**
 * Calculates a fixed-position style for item cards that appear over scrollable
 * containers (e.g. the Gantt track column). Flips left/right and clamps to viewport.
 */
const fixedItemCardPos = (clientX: number, clientY: number): SxProps => {
  const cardW = 300;
  const cardH = 380;
  const rawLeft = clientX + 14 + cardW > window.innerWidth ? clientX - cardW - 14 : clientX + 14;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - cardW - 8));
  const top  = Math.max(8, Math.min(clientY - cardH / 2, window.innerHeight - cardH - 8));
  return { position: "fixed", left, top, zIndex: 200 };
};

const ItemHoverCard: FunctionComponent<ItemHoverCardProps> = ({
  item, dotColor, dateRange, positionSx,
  typeLabel, statusWord, isOpen, metric, reviewWaitDays, href, colorblindMode = false,
}) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;
  const label = typeLabel ?? (item.type === "pr" ? "PR" : "Issue");
  const isClickable = href !== undefined;

  return (
    <Paper
      elevation={2}
      {...(isClickable ? { component: "a", href, target: "_blank", rel: "noreferrer" } : {})}
      sx={{
        display: "flex", flexDirection: "column", gap: "6px",
        minWidth: 200, maxWidth: 280, px: 1.5, py: 1.25,
        ...(isClickable
          ? { cursor: "pointer", textDecoration: "none", color: "inherit", "&:hover": { borderColor: "primary.main", boxShadow: "0 4px 20px rgba(0,0,0,0.22)" } }
          : { pointerEvents: "none" }),
        ...positionSx,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: FS.sm, fontWeight: 600, color: "text.secondary" }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: dotColor, flexShrink: 0, opacity: isOpen ? 0.55 : 1 }} />
        {label} #{item.number}
        {item.type === "issue" && item.reopenedCount > 0 && (
          <Box component="span" aria-label={`Reopened ${pluralize(item.reopenedCount, "time")}`} sx={{ color: palette.warning, ml: "2px" }}>
            ↺{item.reopenedCount}
          </Box>
        )}
        {statusWord && <Box component="span" sx={{ ml: "auto", fontWeight: 500 }}>{statusWord}</Box>}
      </Box>
      <Typography sx={{ fontSize: FS.md, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.title}
      </Typography>
      <Box>
        <Typography sx={{ fontSize: FS.tiny, color: "text.disabled", fontWeight: 600, lineHeight: 1, mb: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Author</Typography>
        <AuthorTag login={item.author} prefix="@" />
      </Box>
      {item.assignees.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: FS.tiny, color: "text.disabled", fontWeight: 600, lineHeight: 1, mb: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Assignees</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {item.assignees.map((a) => <AuthorTag key={a} login={a} prefix="@" />)}
          </Box>
        </Box>
      )}
      {item.labels.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
          {item.labels.map((l) => <LabelBadge key={l.name} name={l.name} color={l.color} />)}
        </Box>
      )}
      {item.type === "pr" && item.linkedIssue != null && (
        <Box sx={{ fontSize: FS.sm, color: "text.secondary" }}>Closes #{item.linkedIssue}</Box>
      )}
      {item.type === "pr" && (item.reviewDecision || item.additions + item.deletions > 0) && (
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {item.reviewDecision && (
            <Box component="span" sx={{
              fontSize: FS.sm, fontWeight: 600,
              color: item.reviewDecision === "APPROVED"           ? "success.main"
                   : item.reviewDecision === "CHANGES_REQUESTED"  ? "error.main"
                   : "warning.main",
            }}>
              {item.reviewDecision === "APPROVED"          ? "✓ Approved"
                : item.reviewDecision === "CHANGES_REQUESTED" ? "Changes requested"
                : "Review required"}
            </Box>
          )}
          {item.additions + item.deletions > 0 && (
            <Box component="span" sx={{ fontSize: FS.sm, color: "text.secondary" }}>
              <Box component="span" sx={{ color: "success.main" }}>+{item.additions}</Box>
              {" / "}
              <Box component="span" sx={{ color: "error.main" }}>-{item.deletions}</Box>
            </Box>
          )}
        </Box>
      )}
      {reviewWaitDays != null && (
        <Box sx={{ fontSize: FS.sm, fontWeight: 500, color: "text.secondary" }}>
          ⏱ {reviewWaitDays}d to first review
        </Box>
      )}
      <Box sx={{ fontSize: FS.sm, color: "text.secondary" }}>{dateRange}</Box>
      {metric && <Box sx={{ fontSize: FS.md, fontWeight: 600 }}>{metric}</Box>}
    </Paper>
  );
};

export { ItemHoverCard, fixedItemCardPos };
export type { ItemHoverCardProps };
