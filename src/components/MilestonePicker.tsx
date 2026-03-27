import type { Milestone } from "../types";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { pluralize } from "../utils/utils";

type Props = {
  milestones: Milestone[];
  selected: Milestone[];
  loadingNums: number[];
  colorFor: (num: number) => string;
  onAdd: (ms: Milestone) => void;
  onRemove: (num: number) => void;
};

const MilestonePicker: FunctionComponent<Props> = ({ milestones, selected, loadingNums, colorFor, onAdd, onRemove }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const unselected = milestones.filter((m) => !selected.find((s) => s.number === m.number));

  return (
    <Box>
      <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
        Milestones
      </Typography>
      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.75} sx={{ minHeight: 40 }}>
        {selected.map((ms) => (
          <Chip
            key={ms.number}
            label={loadingNums.includes(ms.number) ? "…" : ms.title}
            onDelete={() => onRemove(ms.number)}
            size="small"
            sx={{
              bgcolor: colorFor(ms.number),
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
              {unselected.map((ms) => (
                <MenuItem
                  key={ms.number}
                  onClick={() => {
                    onAdd(ms);
                    setAnchorEl(null);
                  }}
                  dense
                >
                  <Box
                    sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: colorFor(ms.number), mr: 1.5, flexShrink: 0 }}
                  />
                  <Typography noWrap sx={{ flex: 1, fontSize: "0.8125rem" }}>
                    {ms.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5, whiteSpace: "nowrap" }}>
                    {pluralize(ms.openIssues + ms.closedIssues, "issue")} ({ms.state})
                  </Typography>
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Stack>
    </Box>
  );
};

export { MilestonePicker };
