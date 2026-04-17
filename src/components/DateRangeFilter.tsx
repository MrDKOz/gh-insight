import type { FunctionComponent } from "react";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { FS } from "../utils/displayUtils";

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
  min?: string | undefined;
  max?: string | undefined;
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
            <Tooltip title="Clear date" disableInteractive>
              <IconButton size="small" onClick={onClear} aria-label="Clear date" sx={{ p: 0.25 }}>
                <IconX />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ) : null,
      },
    }}
    onChange={(e) => onChange(e.target.value)}
    sx={{ "& .MuiInputBase-input": { fontSize: FS.md, py: 0.625 } }}
  />
);

type DateRangeFilterProps = {
  label: string;
  startValue: string;
  endValue: string;
  onStartChange: (v: string) => void;
  onStartClear: () => void;
  onEndChange: (v: string) => void;
  onEndClear: () => void;
};

const DateRangeFilter: FunctionComponent<DateRangeFilterProps> = ({
  label,
  startValue,
  endValue,
  onStartChange,
  onStartClear,
  onEndChange,
  onEndClear,
}) => (
  <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
      {label}
    </Typography>
    <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
      <DateField
        value={startValue}
        max={endValue || undefined}
        onChange={onStartChange}
        onClear={onStartClear}
      />
      <Typography variant="caption" color="text.secondary" sx={{ userSelect: "none" }}>
        –
      </Typography>
      <DateField
        value={endValue}
        min={startValue || undefined}
        onChange={onEndChange}
        onClear={onEndClear}
      />
    </Stack>
  </Stack>
);

export { DateRangeFilter, IconReset };
