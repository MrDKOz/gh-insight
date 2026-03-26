import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import type { TimelineItem } from "../types";
import { itemEndDate, COLORS } from "../utils/utils";

type Filters = {
  createdStart: string;
  createdEnd: string;
  closedStart: string;
  closedEnd: string;
  showOpenIssues: boolean;
  showClosedIssues: boolean;
  showOpenPRs: boolean;
  showMergedPRs: boolean;
  showClosedPRs: boolean;
};

const DEFAULT_FILTERS: Filters = {
  createdStart: "",
  createdEnd: "",
  closedStart: "",
  closedEnd: "",
  showOpenIssues: true,
  showClosedIssues: true,
  showOpenPRs: true,
  showMergedPRs: true,
  showClosedPRs: true,
};

function applyFilters(items: TimelineItem[], filters: Filters): TimelineItem[] {
  return items.filter((item) => {
    if (filters.createdStart && item.createdAt.slice(0, 10) < filters.createdStart) return false;
    if (filters.createdEnd && item.createdAt.slice(0, 10) > filters.createdEnd) return false;

    const end = itemEndDate(item);
    if (filters.closedStart || filters.closedEnd) {
      if (!end) return false; // open items have no close date — exclude when filtering by closed
      if (filters.closedStart && end.slice(0, 10) < filters.closedStart) return false;
      if (filters.closedEnd && end.slice(0, 10) > filters.closedEnd) return false;
    }

    if (item.type === "issue") {
      if (!item.closedAt && !filters.showOpenIssues) return false;
      if (item.closedAt && !filters.showClosedIssues) return false;
    } else {
      const isMerged = !!item.mergedAt;
      const isClosed = !item.mergedAt && !!item.closedAt;
      const isOpen   = !item.mergedAt && !item.closedAt;
      if (isOpen   && !filters.showOpenPRs)   return false;
      if (isMerged && !filters.showMergedPRs) return false;
      if (isClosed && !filters.showClosedPRs) return false;
    }
    return true;
  });
}

type Counts = {
  openIssues: number;
  closedIssues: number;
  openPRs: number;
  mergedPRs: number;
  closedPRs: number;
};

type Props = {
  filters: Filters;
  counts: Counts;
  onChange: (f: Filters) => void;
};

const IconX = () => (
  <svg
    width="8"
    height="8"
    viewBox="0 0 8 8"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" />
    <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" />
  </svg>
);

const IconReset = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 13 13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M11 6.5a4.5 4.5 0 1 1-1.5-3.3" />
    <polyline points="9.5 1 9.5 3.5 12 3.5" />
  </svg>
);

type DateFieldProps = {
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
  onClear: () => void;
};

const DateField: FunctionComponent<DateFieldProps> = ({ value, min, max, onChange, onClear }) => (
  <TextField
    type="date"
    size="small"
    value={value}
    slotProps={{
      htmlInput: { min, max },
      input: {
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={onClear} title="Clear date" sx={{ p: 0.25 }}>
              <IconX />
            </IconButton>
          </InputAdornment>
        ) : null,
      },
    }}
    onChange={(e) => onChange(e.target.value)}
    sx={{ "& .MuiInputBase-input": { fontSize: "0.8125rem", py: 0.625 } }}
  />
);

const FilterBar: FunctionComponent<Props> = ({ filters, counts, onChange }) => {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const isActive =
    !!filters.createdStart ||
    !!filters.createdEnd ||
    !!filters.closedStart ||
    !!filters.closedEnd ||
    !filters.showOpenIssues ||
    !filters.showClosedIssues ||
    !filters.showOpenPRs ||
    !filters.showMergedPRs ||
    !filters.showClosedPRs;

  const toggles: Array<{ key: keyof Filters; label: string; count: number; color: string }> = (
    [
      { key: "showOpenIssues", label: "Open issues", count: counts.openIssues, color: COLORS.issue },
      { key: "showClosedIssues", label: "Closed issues", count: counts.closedIssues, color: COLORS.issue },
      { key: "showOpenPRs", label: "Open PRs", count: counts.openPRs, color: COLORS.prMerged },
      { key: "showMergedPRs", label: "Merged PRs", count: counts.mergedPRs, color: COLORS.prMerged },
      { key: "showClosedPRs", label: "Closed PRs", count: counts.closedPRs, color: COLORS.prClosed },
    ] as Array<{ key: keyof Filters; label: string; count: number; color: string }>
  ).filter((t) => t.count > 0);

  return (
    <Box
      sx={{
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
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          Created
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <DateField
            value={filters.createdStart}
            max={filters.createdEnd || undefined}
            onChange={(v) => set({ createdStart: v })}
            onClear={() => set({ createdStart: "" })}
          />
          <Typography variant="caption" color="text.secondary" sx={{ userSelect: "none" }}>
            –
          </Typography>
          <DateField
            value={filters.createdEnd}
            min={filters.createdStart || undefined}
            onChange={(v) => set({ createdEnd: v })}
            onClear={() => set({ createdEnd: "" })}
          />
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" gap={0.75}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          Closed
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <DateField
            value={filters.closedStart}
            max={filters.closedEnd || undefined}
            onChange={(v) => set({ closedStart: v })}
            onClear={() => set({ closedStart: "" })}
          />
          <Typography variant="caption" color="text.secondary" sx={{ userSelect: "none" }}>
            –
          </Typography>
          <DateField
            value={filters.closedEnd}
            min={filters.closedStart || undefined}
            onChange={(v) => set({ closedEnd: v })}
            onClear={() => set({ closedEnd: "" })}
          />
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
        {toggles.map(({ key, label, count, color }) => (
          <Chip
            key={key}
            label={
              <Stack component="span" direction="row" alignItems="center" gap={0.5}>
                {label}
                <Box component="span" sx={{ fontSize: "0.625rem", opacity: 0.7 }}>
                  {count}
                </Box>
              </Stack>
            }
            size="small"
            onClick={() => set({ [key]: !filters[key] })}
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
              fontSize: "0.6875rem",
              "&:hover": { bgcolor: `${color}2e`, opacity: 1 },
            }}
          />
        ))}
      </Stack>

      {isActive && (
        <IconButton size="small" onClick={() => onChange(DEFAULT_FILTERS)} title="Reset all filters" sx={{ ml: "auto" }}>
          <IconReset />
        </IconButton>
      )}
    </Box>
  );
};

export { FilterBar, DEFAULT_FILTERS, applyFilters };
export type { Filters };
