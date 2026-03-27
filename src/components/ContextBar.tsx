import type { FunctionComponent } from "react";
import type { Milestone, Repo } from "../types";
import type { View } from "./Timeline";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { memo } from "react";
import { VIEWS } from "./Timeline";
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
  view: View;
  onViewChange: (v: View) => void;
  hasItems: boolean;
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
  view, onViewChange, hasItems,
}) => (
  <Box sx={{ bgcolor: "background.paper" }}>

    {/* Row 1: workspace controls */}
    <Box sx={{
      px: 2,
      py: 1,
      minHeight: 52,
      display: "flex",
      alignItems: "center",
      gap: 1,
      borderBottom: hasItems ? 0 : 1,
      borderColor: "divider",
    }}>

      {/* Repo selector */}
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
          <TextField {...params} label="Repository" size="small" placeholder="Search repos…" />
        )}
        sx={{ width: 280, flexShrink: 0 }}
        noOptionsText={isDemo ? "No demo repos" : "No repositories found"}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Milestone area */}
      {loadingList && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">Loading milestones…</Typography>
        </Stack>
      )}

      {!loadingList && milestones.length > 0 && (
        <MilestonePicker
          milestones={milestones}
          selected={selected}
          loadingNums={loadingNums}
          colorFor={colorFor}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      )}

      {/* Refresh — lives next to milestones, not at the far end */}
      {selected.length > 0 && !isDemo && (
        <Button
          variant="text"
          size="small"
          onClick={onRefresh}
          disabled={loadingNums.length > 0}
          title="Refetch data for selected milestones"
          aria-label="Refresh milestone data"
          sx={{ flexShrink: 0, color: "text.secondary", minWidth: "auto", px: 0.75 }}
        >
          ↻ Refresh
        </Button>
      )}

      {/* Portal target — Timeline renders Export + Share buttons here */}
      <Box id="timeline-toolbar" sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }} />
    </Box>

    {/* Row 2: view tabs — only shown when data is loaded */}
    {hasItems && (
      <Tabs
        value={view}
        onChange={(_, v: View) => onViewChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 2,
          minHeight: 40,
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { minHeight: 40, py: 0.5, fontSize: "0.8125rem" },
        }}
      >
        {VIEWS.map((v) => (
          <Tab key={v} label={v} value={v} />
        ))}
      </Tabs>
    )}
  </Box>
));

export { ContextBar };
