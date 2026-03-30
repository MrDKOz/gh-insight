import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { COLORS, COLORS_CB } from "../utils/colorUtils";
import { FS } from "../utils/displayUtils";

type GanttLegendProps = {
  hasOpenIssues: boolean;
  colorblindMode: boolean;
  snapMode: "day" | "hour";
  onSnapModeChange: (mode: "day" | "hour") => void;
  onFitToScreen: () => void;
};

const GanttLegend: FunctionComponent<GanttLegendProps> = ({ hasOpenIssues, colorblindMode, snapMode, onSnapModeChange, onFitToScreen }) => {
  const p = colorblindMode ? COLORS_CB : COLORS;
  // 0x73 hex ≈ 0.45 alpha — used for the open-issue dashed bar fill
  const issueClosed = `linear-gradient(135deg, ${p.issue} 0%, ${p.issueDark} 100%)`;
  const issueOpen   = `linear-gradient(135deg, ${p.issue}73 0%, ${p.issueDark}73 100%)`;
  const prMergedBg  = `linear-gradient(135deg, ${p.prMerged} 0%, ${p.prMergedDark} 100%)`;
  const prClosedBg  = `linear-gradient(135deg, ${p.prClosed} 0%, ${p.prClosedDark} 100%)`;
  return (
  <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", flex: 1 }}>
        {[
          { bg: issueClosed, label: "Issues (closed)" },
          ...(hasOpenIssues
            ? [{ bg: issueOpen, label: "Issues (open)", dashed: true, borderColor: p.issue }]
            : []),
          { bg: prMergedBg, label: "PRs (merged)" },
          { bg: prClosedBg, label: "PRs (closed)" },
        ].map(({ bg, label, dashed, borderColor }) => (
          <Box key={label} sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: FS.md }}>
            <Box sx={{ width: 20, height: 14, borderRadius: "3px", flexShrink: 0, background: bg, ...(dashed ? { border: `1.5px dashed ${borderColor ?? COLORS.issue}` } : {}) }} />
            {label}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Button size="small" variant="outlined" onClick={onFitToScreen} aria-label="Fit timeline to screen width">
          Fit to screen
        </Button>
        <ToggleButtonGroup
          value={snapMode}
          exclusive
          size="small"
          onChange={(_, newSnapMode: "day" | "hour" | null) => { if (newSnapMode) { onSnapModeChange(newSnapMode); } }}
          aria-label="Bar snap granularity"
        >
          <ToggleButton value="day"  aria-label="Snap bars to day boundaries">Day</ToggleButton>
          <ToggleButton value="hour" aria-label="Snap bars to hour boundaries">Hour</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};

export { GanttLegend };
export type { GanttLegendProps };
