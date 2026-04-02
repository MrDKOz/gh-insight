import type { Filters, PeopleRole } from "../types/FilterTypes";
import type { TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { DEFAULT_FILTERS } from "../types/FilterTypes";
import { COLORS, COLORS_CB, labelTextColor } from "../utils/colorUtils";
import { FS } from "../utils/displayUtils";
import { DateRangeFilter, IconReset } from "./DateRangeFilter";

type Counts = {
  openIssues: number;
  closedIssues: number;
  openPRs: number;
  mergedPRs: number;
  closedPRs: number;
};

type Props = {
  items: TimelineItem[];
  filters: Filters;
  counts: Counts;
  onChange: (f: Filters) => void;
  colorblindMode: boolean;
  variant?: "toolbar";
};

const FILTER_BTN_SX = (active: boolean) => ({
  fontSize: FS.sm,
  height: 26,
  borderColor: active ? "primary.main" : undefined,
  color: active ? "primary.main" : "text.secondary",
  fontWeight: active ? 700 : 500,
});

const FilterBar: FunctionComponent<Props> = ({ items, filters, counts, onChange, colorblindMode, variant }) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;
  const patchFilters = useCallback((patch: Partial<Filters>) => onChange({ ...filters, ...patch }), [onChange, filters]);

  const [createdAnchor, setCreatedAnchor] = useState<HTMLElement | null>(null);
  const [closedAnchor,  setClosedAnchor]  = useState<HTMLElement | null>(null);
  const [labelsAnchor,  setLabelsAnchor]  = useState<HTMLElement | null>(null);
  const [labelsSearch,  setLabelsSearch]  = useState("");
  const [peopleAnchor,  setPeopleAnchor]  = useState<HTMLElement | null>(null);
  const [peopleSearch,  setPeopleSearch]  = useState("");

  // Derive unique labels and people (authors + assignees) from the full (unfiltered) item list
  const { labelMap, allPeople } = useMemo(() => {
    const lm = new Map<string, string>(); // name → color
    const peopleSet = new Set<string>();
    for (const item of items) {
      for (const l of item.labels) {lm.set(l.name, l.color);}
      peopleSet.add(item.author);
      for (const a of item.assignees) {peopleSet.add(a);}
    }
    return { labelMap: lm, allPeople: [...peopleSet].sort() };
  }, [items]);

  const isActive =
    !!filters.createdStart ||
    !!filters.createdEnd ||
    !!filters.closedStart ||
    !!filters.closedEnd ||
    !filters.showOpenIssues ||
    !filters.showClosedIssues ||
    !filters.showOpenPRs ||
    !filters.showMergedPRs ||
    !filters.showClosedPRs ||
    filters.activeLabels.length > 0 ||
    filters.activePeople.length > 0;

  const hasCreated = !!filters.createdStart || !!filters.createdEnd;
  const hasClosed  = !!filters.closedStart  || !!filters.closedEnd;

  const toggles: Array<{ key: keyof Filters; label: string; count: number; color: string }> = (
    [
      { key: "showOpenIssues",   label: "Open issues",   count: counts.openIssues,   color: palette.issue    },
      { key: "showClosedIssues", label: "Closed issues", count: counts.closedIssues, color: palette.issue    },
      { key: "showOpenPRs",      label: "Open PRs",      count: counts.openPRs,      color: palette.prMerged },
      { key: "showMergedPRs",    label: "Merged PRs",    count: counts.mergedPRs,    color: palette.prMerged },
      { key: "showClosedPRs",    label: "Closed PRs",    count: counts.closedPRs,    color: palette.prClosed },
    ] as Array<{ key: keyof Filters; label: string; count: number; color: string }>
  ).filter((t) => t.count > 0);

  const toggleLabel = (name: string) => {
    const next = filters.activeLabels.includes(name)
      ? filters.activeLabels.filter((l) => l !== name)
      : [...filters.activeLabels, name];
    patchFilters({ activeLabels: next });
  };

  const togglePerson = (login: string) => {
    const next = filters.activePeople.includes(login)
      ? filters.activePeople.filter((p) => p !== login)
      : [...filters.activePeople, login];
    patchFilters({ activePeople: next });
  };

  const ROLE_OPTIONS: Array<{ value: PeopleRole; label: string; title: string }> = [
    { value: "author",    label: "Author",    title: "Match selected people as issue/PR authors" },
    { value: "assignees", label: "Assignees", title: "Match selected people as assignees" },
    { value: "either",    label: "Either",    title: "Match selected people in either role" },
  ];

  const isToolbar = variant === "toolbar";

  return (
    <Box
      sx={isToolbar ? {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        px: 2,
        py: 0.75,
        borderBottom: 1,
        borderColor: isActive ? "primary.light" : "divider",
        bgcolor: "background.paper",
      } : {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        px: 1.5,
        py: 1,
        border: 1,
        borderRadius: 1,
        borderColor: isActive ? "primary.light" : "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* ── Date range filters (button → popover) ──────────────────────── */}
      <Button variant="outlined" size="small"
        onClick={(e) => setCreatedAnchor(e.currentTarget)}
        sx={FILTER_BTN_SX(hasCreated)}
      >
        Created{hasCreated ? " ·" : ""} ▾
      </Button>
      <Popover
        open={Boolean(createdAnchor)}
        anchorEl={createdAnchor}
        onClose={() => setCreatedAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 1.5, display: "flex", flexDirection: "column", gap: 1 } } }}
      >
        <DateRangeFilter
          label="Created"
          startValue={filters.createdStart}
          endValue={filters.createdEnd}
          onStartChange={(v) => patchFilters({ createdStart: v })}
          onStartClear={() => patchFilters({ createdStart: "" })}
          onEndChange={(v) => patchFilters({ createdEnd: v })}
          onEndClear={() => patchFilters({ createdEnd: "" })}
        />
        {hasCreated && (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" sx={{ fontSize: FS.sm }} onClick={() => patchFilters({ createdStart: "", createdEnd: "" })}>
              Clear
            </Button>
          </Box>
        )}
      </Popover>

      <Button variant="outlined" size="small"
        onClick={(e) => setClosedAnchor(e.currentTarget)}
        sx={FILTER_BTN_SX(hasClosed)}
      >
        Closed{hasClosed ? " ·" : ""} ▾
      </Button>
      <Popover
        open={Boolean(closedAnchor)}
        anchorEl={closedAnchor}
        onClose={() => setClosedAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 1.5, display: "flex", flexDirection: "column", gap: 1 } } }}
      >
        <DateRangeFilter
          label="Closed"
          startValue={filters.closedStart}
          endValue={filters.closedEnd}
          onStartChange={(v) => patchFilters({ closedStart: v })}
          onStartClear={() => patchFilters({ closedStart: "" })}
          onEndChange={(v) => patchFilters({ closedEnd: v })}
          onEndClear={() => patchFilters({ closedEnd: "" })}
        />
        {hasClosed && (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" sx={{ fontSize: FS.sm }} onClick={() => patchFilters({ closedStart: "", closedEnd: "" })}>
              Clear
            </Button>
          </Box>
        )}
      </Popover>

      <Divider orientation="vertical" flexItem />

      {/* ── Type toggles ───────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
        {toggles.map(({ key, label, count, color }) => (
          <Chip
            key={key}
            label={
              <Stack component="span" direction="row" alignItems="center" gap={0.5}>
                {label}
                <Box component="span" sx={{ fontSize: FS.xs, opacity: 0.7 }}>
                  {count}
                </Box>
              </Stack>
            }
            size="small"
            onClick={() => patchFilters({ [key]: !filters[key] })}
            title={filters[key] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            sx={{
              height: 26,
              cursor: "pointer",
              color: filters[key] ? color : "text.secondary",
              bgcolor: `${color}1a`,
              border: "1px solid",
              borderColor: `${color}55`,
              opacity: filters[key] ? 1 : 0.35,
              fontWeight: 500,
              fontSize: FS.sm,
              "&:hover": { bgcolor: `${color}2e`, opacity: 1 },
            }}
          />
        ))}
      </Stack>

      <Divider orientation="vertical" flexItem />

      {/* ── Labels ─────────────────────────────────────────────────────── */}
      {labelMap.size > 0 && (() => {
        const activeCount = filters.activeLabels.length;
        const query = labelsSearch.trim().toLowerCase();
        const filtered = [...labelMap.entries()].filter(([name]) =>
          !query || name.toLowerCase().includes(query),
        );
        return (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => setLabelsAnchor(e.currentTarget)}
              aria-haspopup="true"
              aria-expanded={Boolean(labelsAnchor)}
              sx={FILTER_BTN_SX(activeCount > 0)}
            >
              Labels{activeCount > 0 ? ` (${activeCount})` : ""} ▾
            </Button>

            <Popover
              open={Boolean(labelsAnchor)}
              anchorEl={labelsAnchor}
              onClose={() => { setLabelsAnchor(null); setLabelsSearch(""); }}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              slotProps={{ paper: { sx: { width: 280, display: "flex", flexDirection: "column" } } }}
            >
              <Box sx={{ p: 1 }}>
                <TextField
                  size="small"
                  placeholder="Search labels…"
                  value={labelsSearch}
                  onChange={(e) => setLabelsSearch(e.target.value)}
                  autoFocus
                  fullWidth
                  slotProps={{ htmlInput: { "aria-label": "Search labels" } }}
                  sx={{ "& .MuiInputBase-input": { fontSize: FS.md, py: 0.625 } }}
                />
              </Box>
              <Divider />
              <Box sx={{ p: 1, maxHeight: 260, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {filtered.length === 0 ? (
                  <Typography variant="caption" color="text.disabled" sx={{ p: 0.5 }}>
                    No labels match
                  </Typography>
                ) : filtered.map(([name, color]) => {
                  const active = filters.activeLabels.includes(name);
                  const textCol = labelTextColor(color);
                  return (
                    <Chip
                      key={name}
                      label={name}
                      size="small"
                      onClick={() => toggleLabel(name)}
                      aria-pressed={active}
                      sx={{
                        height: 22,
                        cursor: "pointer",
                        bgcolor: active ? color : `${color}33`,
                        color: active ? textCol : "text.secondary",
                        border: "1px solid",
                        borderColor: `${color}99`,
                        fontWeight: 500,
                        fontSize: FS.xs,
                        opacity: active ? 1 : 0.65,
                        "&:hover": { bgcolor: color, color: textCol, opacity: 1 },
                      }}
                    />
                  );
                })}
              </Box>
              {activeCount > 0 && (
                <>
                  <Divider />
                  <Box sx={{ p: 0.75, display: "flex", justifyContent: "flex-end" }}>
                    <Button size="small" sx={{ fontSize: FS.sm }} onClick={() => patchFilters({ activeLabels: [] })}>
                      Clear
                    </Button>
                  </Box>
                </>
              )}
            </Popover>
          </>
        );
      })()}

      {/* ── People ─────────────────────────────────────────────────────── */}
      {allPeople.length > 0 && (() => {
        const activeCount = filters.activePeople.length;
        const query = peopleSearch.trim().toLowerCase();
        const filteredPeople = allPeople.filter((p) => !query || p.toLowerCase().includes(query));
        return (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => setPeopleAnchor(e.currentTarget)}
              aria-haspopup="true"
              aria-expanded={Boolean(peopleAnchor)}
              sx={FILTER_BTN_SX(activeCount > 0)}
            >
              People{activeCount > 0 ? ` (${activeCount})` : ""} ▾
            </Button>

            <Popover
              open={Boolean(peopleAnchor)}
              anchorEl={peopleAnchor}
              onClose={() => { setPeopleAnchor(null); setPeopleSearch(""); }}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              slotProps={{ paper: { sx: { width: 280, display: "flex", flexDirection: "column" } } }}
            >
              {/* Role toggle */}
              <Box sx={{ p: 1 }}>
                <Box
                  sx={{ display: "flex", border: 1, borderColor: "divider", borderRadius: 0.75, overflow: "hidden" }}
                  role="group"
                  aria-label="Match people by role"
                >
                  {ROLE_OPTIONS.map(({ value, label, title }, i) => (
                    <Box
                      key={value}
                      component="button"
                      onClick={() => patchFilters({ peopleRole: value })}
                      title={title}
                      aria-pressed={filters.peopleRole === value}
                      sx={{
                        flex: 1, px: 1, py: 0.5,
                        fontSize: FS.sm, fontWeight: 500, lineHeight: 1.4,
                        border: "none",
                        borderRight: i < ROLE_OPTIONS.length - 1 ? 1 : 0,
                        borderColor: "divider",
                        cursor: "pointer",
                        bgcolor: filters.peopleRole === value ? "primary.main" : "transparent",
                        color: filters.peopleRole === value ? "primary.contrastText" : "text.secondary",
                        transition: "background-color 0.15s, color 0.15s",
                        "&:hover": {
                          bgcolor: filters.peopleRole === value ? "primary.dark" : "action.hover",
                          color: filters.peopleRole === value ? "primary.contrastText" : "text.primary",
                        },
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Divider />
              <Box sx={{ p: 1 }}>
                <TextField
                  size="small"
                  placeholder="Search people…"
                  value={peopleSearch}
                  onChange={(e) => setPeopleSearch(e.target.value)}
                  autoFocus
                  fullWidth
                  slotProps={{ htmlInput: { "aria-label": "Search people" } }}
                  sx={{ "& .MuiInputBase-input": { fontSize: FS.md, py: 0.625 } }}
                />
              </Box>
              <Divider />
              <Box sx={{ p: 1, maxHeight: 220, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {filteredPeople.length === 0 ? (
                  <Typography variant="caption" color="text.disabled" sx={{ p: 0.5 }}>
                    No people match
                  </Typography>
                ) : filteredPeople.map((login) => {
                  const active = filters.activePeople.includes(login);
                  return (
                    <Chip
                      key={login}
                      label={login}
                      size="small"
                      onClick={() => togglePerson(login)}
                      aria-pressed={active}
                      sx={{
                        height: 22,
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: FS.xs,
                        opacity: active ? 1 : 0.6,
                        "&:hover": { opacity: 1 },
                      }}
                    />
                  );
                })}
              </Box>
              {activeCount > 0 && (
                <>
                  <Divider />
                  <Box sx={{ p: 0.75, display: "flex", justifyContent: "flex-end" }}>
                    <Button size="small" sx={{ fontSize: FS.sm }} onClick={() => patchFilters({ activePeople: [] })}>
                      Clear
                    </Button>
                  </Box>
                </>
              )}
            </Popover>
          </>
        );
      })()}

      {isActive && (
        <IconButton size="small" onClick={() => onChange(DEFAULT_FILTERS)} title="Reset all filters" aria-label="Reset all filters" sx={{ ml: "auto" }}>
          <IconReset />
        </IconButton>
      )}
    </Box>
  );
};

export { FilterBar };
export { DEFAULT_FILTERS, applyFilters } from "../types/FilterTypes";
export type { Filters } from "../types/FilterTypes";
