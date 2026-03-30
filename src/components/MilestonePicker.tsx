import type { Milestone } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { pluralize } from "../utils/displayUtils";
import { DOT_SX } from "../utils/sxTokens";

type Props = {
  milestones: Milestone[];
  selected: Milestone[];
  loadingNums: number[];
  colorFor: (num: number) => string;
  onAdd: (milestone: Milestone) => void;
  onRemove: (num: number) => void;
};

const MilestonePicker: FunctionComponent<Props> = ({ milestones, selected, loadingNums, colorFor, onAdd, onRemove }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const unselected = milestones.filter((m) => !selected.find((s) => s.number === m.number));

  return (
    <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.75}>
      {selected.map((milestone) => (
        <Chip
          key={milestone.number}
          label={loadingNums.includes(milestone.number) ? "…" : milestone.title}
          onDelete={() => onRemove(milestone.number)}
          size="small"
          sx={{
            bgcolor: colorFor(milestone.number),
            color: "#fff",
            fontWeight: 500,
            "& .MuiChip-deleteIcon": {
              color: "rgba(255,255,255,0.7)",
              "&:hover": { color: "#fff" },
            },
          }}
        />
      ))}

      {unselected.length > 0 && (
        <>
          <Button
            variant="outlined"
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            disabled={loadingNums.length > 0}
          >
            {selected.length === 0 ? `Select milestone (${unselected.length})` : `+ Add (${unselected.length})`}
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            slotProps={{ paper: { sx: { maxHeight: 260, minWidth: 240, maxWidth: 340 } } }}
          >
            {unselected.map((milestone) => (
              <MenuItem
                key={milestone.number}
                onClick={() => {
                  onAdd(milestone);
                  setAnchorEl(null);
                }}
                dense
              >
                <Box
                  sx={{ ...DOT_SX, width: 9, height: 9, bgcolor: colorFor(milestone.number), mr: 1.5 }}
                />
                <Typography noWrap sx={{ flex: 1, fontSize: "0.8125rem" }}>
                  {milestone.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5, whiteSpace: "nowrap" }}>
                  {pluralize(milestone.openIssues + milestone.closedIssues, "issue")} ({milestone.state})
                </Typography>
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Stack>
  );
};

export { MilestonePicker };
