import type { FunctionComponent } from "react";
import type { Milestone, Repo } from "../types";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { memo } from "react";
import { MilestonePicker } from "./MilestonePicker";

type Props = {
  repos: Repo[];
  activeRepo: Repo | null;
  onRepoChange: (repo: Repo | null) => void;
  isDemo: boolean;
  milestones: Milestone[];
  selected: Milestone[];
  loadingList: boolean;
  loadingNums: number[];
  colorFor: (num: number) => string;
  onAdd: (ms: Milestone) => void;
  onRemove: (num: number) => void;
  onRefresh: () => void;
};

const LockIcon: FunctionComponent = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ContextBar: FunctionComponent<Props> = memo(({
  repos, activeRepo, onRepoChange, isDemo,
  milestones, selected, loadingList, loadingNums,
  colorFor, onAdd, onRemove, onRefresh,
}) => (
  <Box
    sx={{
      borderBottom: 1,
      borderColor: "divider",
      px: 3,
      py: 1.25,
      display: "flex",
      alignItems: "center",
      gap: 2,
      flexWrap: "wrap",
      bgcolor: "background.paper",
    }}
  >
    <Autocomplete<Repo>
      options={repos}
      value={activeRepo}
      onChange={(_, v) => onRepoChange(v)}
      getOptionLabel={(r) => r.fullName}
      isOptionEqualToValue={(a, b) => a.fullName === b.fullName}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            {option.private && <LockIcon />}
            <Typography variant="body2">{option.fullName}</Typography>
            {option.description && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                — {option.description}
              </Typography>
            )}
          </Stack>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Repository"
          size="small"
          placeholder="Search repos…"
        />
      )}
      sx={{ width: 300 }}
      noOptionsText={isDemo ? "No demo repos" : "No repositories found"}
    />

    {loadingList && (
      <Stack direction="row" alignItems="center" gap={1}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">Loading milestones…</Typography>
      </Stack>
    )}

    {milestones.length > 0 && (
      <MilestonePicker
        milestones={milestones}
        selected={selected}
        loadingNums={loadingNums}
        colorFor={colorFor}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    )}

    {selected.length > 0 && !isDemo && (
      <Button
        variant="outlined"
        size="small"
        onClick={onRefresh}
        disabled={loadingNums.length > 0}
        title="Refetch data for selected milestones"
        aria-label="Refresh milestone data"
        sx={{ ml: "auto" }}
      >
        ↻ Refresh
      </Button>
    )}
  </Box>
));

export { ContextBar };
