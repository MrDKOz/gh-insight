import type { View } from "../types/AppTypes";
import type { Epic, Milestone, Repo } from "../types/GitHubTypes";
import type { FunctionComponent, HTMLAttributes, Key } from "react";
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

import { VIEWS } from "../types/AppTypes";
import { EpicPicker } from "./EpicPicker";
import { MilestonePicker } from "./MilestonePicker";
import { ShareImportSplitButton } from "./ShareImportSplitButton";

type Props = {
  repos: Repo[];
  activeRepo: Repo | null;
  onRepoChange: (repo: Repo | null) => void;
  isDemo: boolean;
  milestones: Milestone[];
  selected: Milestone[];
  loadingList: boolean;
  loadingNums: number[];
  milestonesHasMore: boolean;
  loadingMoreMilestones: boolean;
  colorFor: (num: number) => string;
  onAdd: (milestone: Milestone) => void;
  onRemove: (num: number) => void;
  onRefresh: () => void;
  onLoadMoreMilestones: () => void;
  epics: Epic[];
  selectedEpics: Epic[];
  loadingEpicList: boolean;
  loadingEpicNums: number[];
  epicsHasMore: boolean;
  loadingMoreEpics: boolean;
  epicColorFor: (num: number) => string;
  onAddEpic: (epic: Epic) => void;
  onRemoveEpic: (num: number) => void;
  onLoadMoreEpics: () => void;
  view: View;
  onViewChange: (v: View) => void;
  hasItems: boolean;
  onImportCode: (code: string) => Promise<void>;
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
  milestonesHasMore, loadingMoreMilestones,
  colorFor, onAdd, onRemove, onRefresh, onLoadMoreMilestones,
  epics, selectedEpics, loadingEpicList, loadingEpicNums,
  epicsHasMore, loadingMoreEpics,
  epicColorFor, onAddEpic, onRemoveEpic, onLoadMoreEpics,
  view, onViewChange, hasItems, onImportCode,
}) => (
  <Box sx={{ bgcolor: "background.paper" }}>

    {/* Row 1: workspace controls — hidden when the token has no repo access */}
    {(repos.length > 0 || isDemo) && <Box sx={{
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
      <Autocomplete<Repo, false, false, true>
        freeSolo
        forcePopupIcon="auto"
        options={repos}
        value={activeRepo}
        onChange={(_, v) => {
          if (!v) { onRepoChange(null); return; }
          if (typeof v === "string") {
            const slash = v.indexOf("/");
            if (slash > 0) {
              onRepoChange({ id: -1, owner: v.slice(0, slash), name: v.slice(slash + 1), fullName: v, private: false, description: null });
            }
            return;
          }
          onRepoChange(v);
        }}
        getOptionLabel={(r) => (typeof r === "string" ? r : r.fullName)}
        // noinspection SuspiciousTypeOfGuard — freeSolo passes strings at runtime even though TS types a/b as Repo
        isOptionEqualToValue={(a, b) => (typeof a === "string" || typeof b === "string" ? false : a.fullName === b.fullName)}
        filterOptions={(options, { inputValue }) => {
          const query = inputValue.toLowerCase();
          return query ? options.filter((r) => r.fullName.toLowerCase().includes(query)) : options;
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props as typeof props & { key: Key };
          return (
          <Box key={key} component="li" {...rest} sx={{ ...(rest as HTMLAttributes<HTMLLIElement>).style, width: "100%" }}>
            <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, width: "100%" }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                {option.private && <LockIcon />}
                <Typography variant="body2" noWrap>{option.fullName}</Typography>
              </Stack>
              {option.description && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ opacity: 0.8 }}>
                  {option.description}
                </Typography>
              )}
            </Box>
          </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder={repos.length === 0 ? "owner/repo" : "Search repos…"}
          />
        )}
        sx={{ width: 300, flexShrink: 0 }}
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
          hasMore={milestonesHasMore}
          loadingMore={loadingMoreMilestones}
          colorFor={colorFor}
          onAdd={onAdd}
          onRemove={onRemove}
          onLoadMore={onLoadMoreMilestones}
        />
      )}

      {/* Epic area */}
      {loadingEpicList && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">Loading epics…</Typography>
        </Stack>
      )}

      {!loadingEpicList && epics.length > 0 && (
        <EpicPicker
          epics={epics}
          selected={selectedEpics}
          loadingNums={loadingEpicNums}
          hasMore={epicsHasMore}
          loadingMore={loadingMoreEpics}
          colorFor={epicColorFor}
          onAdd={onAddEpic}
          onRemove={onRemoveEpic}
          onLoadMore={onLoadMoreEpics}
        />
      )}

      {/* Refresh — lives next to milestones, not at the far end */}
      {selected.length > 0 && !isDemo && (
        <Button
          variant="text"
          size="small"
          onClick={onRefresh}
          disabled={loadingNums.length > 0}
          title="Refetch data"
          aria-label="Refresh data"
          sx={{ flexShrink: 0, color: "text.secondary", minWidth: "auto", px: 0.75 }}
        >
          ↻ Refresh
        </Button>
      )}

      {/* Share / Import — always visible once connected */}
      <Box sx={{ flex: 1 }} />
      <ShareImportSplitButton onImportCode={onImportCode} />

      {/* Portal target — Timeline renders Export button here when items are loaded */}
      <Box id="timeline-toolbar" sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }} />
    </Box>}

    {/* Row 2: view tabs + gantt legend slot + filter toggle slot */}
    {hasItems && (
      <Box sx={{ display: "flex", alignItems: "center", borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={view}
          onChange={(_, v: View) => onViewChange(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            px: 2,
            minHeight: 40,
            "& .MuiTab-root": { minHeight: 40, py: 0.5, fontSize: "0.8125rem" },
          }}
        >
          {VIEWS.map((v) => (
            <Tab key={v} label={v} value={v} />
          ))}
        </Tabs>
        {/* Gantt legend portals here when Gantt view is active */}
        <Box id="gantt-legend-slot" sx={{ display: "flex", alignItems: "center" }} />
        {/* Filter toggle button portals here from MilestoneView */}
        <Box id="view-controls-slot" sx={{ display: "flex", alignItems: "center", px: 1.5 }} />
      </Box>
    )}

    {/* Row 3: filter bar — portaled from Timeline when data is loaded */}
    {hasItems && (
      <Box id="filter-bar-slot" />
    )}
  </Box>
));

export { ContextBar };
