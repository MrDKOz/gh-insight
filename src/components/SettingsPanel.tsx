import type { Milestone } from "../types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { memo } from "react";
import { MilestonePicker } from "./MilestonePicker";

type Props = {
  token: string;
  onTokenChange: (v: string) => void;
  onTokenBlur: (v: string) => void;
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

// GitHub owner names: alphanumeric + hyphens only, max 39 chars
const sanitizeOwner = (value: string): string =>
  value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 39);

// GitHub repo names: alphanumeric + hyphens + dots + underscores, max 100 chars
const sanitizeRepo = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 100);

const SettingsPanel = memo<Props>(
  ({ token, onTokenChange, onTokenBlur, owner, onOwnerChange, repo, onRepoChange, canLoad, loadingList, onLoad, onDemo, milestones, selected, loadingNums, isDemo, colorFor, onAdd, onRemove, onRefresh }) => (
      <Paper sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.75 }}>
        <Stack direction="row" alignItems="flex-end" gap={2} flexWrap="wrap">
          <Box>
            <TextField
              type="password"
              label="GitHub Token"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              onBlur={(e) => onTokenBlur(e.target.value)}
              placeholder="ghp_... or fine-grained token"
              size="small"
              sx={{ width: 280 }}
              onKeyDown={(e) => e.key === "Enter" && onLoad()}
            />
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <TextField
                value={owner}
                label="Owner"
                onChange={(e) => onOwnerChange(sanitizeOwner(e.target.value))}
                placeholder="owner"
                size="small"
                sx={{ width: 130 }}
                onKeyDown={(e) => e.key === "Enter" && onLoad()}
                slotProps={{ htmlInput: { maxLength: 39 } }}
              />
              <Typography color="text.secondary" fontWeight={700} aria-hidden="true">
                /
              </Typography>
              <TextField
                value={repo}
                label="Repository"
                onChange={(e) => onRepoChange(sanitizeRepo(e.target.value))}
                placeholder="repo"
                size="small"
                sx={{ width: 130 }}
                onKeyDown={(e) => e.key === "Enter" && onLoad()}
                slotProps={{ htmlInput: { maxLength: 100 } }}
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
                aria-label="Refresh milestone data"
              >
                ↻ Refresh
              </Button>
            )}
          </Stack>
        )}
      </Paper>
    ),
);

export { SettingsPanel };
