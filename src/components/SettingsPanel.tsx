import { memo } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import type { Milestone } from "../types";
import { MilestonePicker } from "./MilestonePicker";

type Props = {
  token: string;
  onTokenChange: (v: string) => void;
  owner: string;
  onOwnerChange: (v: string) => void;
  repo: string;
  onRepoChange: (v: string) => void;
  canLoad: boolean;
  loadingList: boolean;
  onLoad: () => void;
  onDemo: () => void;
  milestones: Milestone[];
  selected: Milestone[];
  loadingNums: number[];
  isDemo: boolean;
  colorFor: (num: number) => string;
  onAdd: (ms: Milestone) => void;
  onRemove: (num: number) => void;
  onRefresh: () => void;
};

const SettingsPanel = memo<Props>(
  ({ token, onTokenChange, owner, onOwnerChange, repo, onRepoChange, canLoad, loadingList, onLoad, onDemo, milestones, selected, loadingNums, isDemo, colorFor, onAdd, onRemove, onRefresh }) => {
    return (
      <Paper sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.75 }}>
        <Stack direction="row" alignItems="flex-end" gap={2} flexWrap="wrap">
          <Box>
            <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              GitHub Token
            </Typography>
            <TextField
              type="password"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="ghp_... or fine-grained token"
              size="small"
              sx={{ width: 280 }}
              onKeyDown={(e) => e.key === "Enter" && onLoad()}
            />
          </Box>

          <Box>
            <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              Repository
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <TextField
                value={owner}
                onChange={(e) => onOwnerChange(e.target.value)}
                placeholder="owner"
                size="small"
                sx={{ width: 130 }}
                onKeyDown={(e) => e.key === "Enter" && onLoad()}
              />
              <Typography color="text.secondary" fontWeight={700}>
                /
              </Typography>
              <TextField
                value={repo}
                onChange={(e) => onRepoChange(e.target.value)}
                placeholder="repo"
                size="small"
                sx={{ width: 130 }}
                onKeyDown={(e) => e.key === "Enter" && onLoad()}
              />
            </Stack>
          </Box>

          <Button variant="contained" onClick={onLoad} disabled={!canLoad || loadingList}>
            {loadingList ? "Loading…" : "Load Milestones"}
          </Button>
          <Button variant="outlined" onClick={onDemo}>
            Load demo
          </Button>
        </Stack>

        {milestones.length > 0 && (
          <Stack direction="row" alignItems="flex-end" gap={2} flexWrap="wrap">
            <MilestonePicker
              milestones={milestones}
              selected={selected}
              loadingNums={loadingNums}
              colorFor={colorFor}
              onAdd={onAdd}
              onRemove={onRemove}
            />
            {selected.length > 0 && !isDemo && (
              <Button
                variant="outlined"
                onClick={onRefresh}
                disabled={loadingNums.length > 0}
                title="Refetch data for selected milestones"
              >
                ↻ Refresh
              </Button>
            )}
          </Stack>
        )}
      </Paper>
    );
  },
);

export { SettingsPanel };
