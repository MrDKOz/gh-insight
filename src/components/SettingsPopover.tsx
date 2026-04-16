import type { Region } from "../api/bankHolidayApi";
import type { Settings } from "../types/SettingsTypes";
import type { ChangeEvent, FunctionComponent, RefObject } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

const REGION_LABELS: Record<Region, string> = {
  "england-and-wales": "England & Wales",
  "scotland":          "Scotland",
  "northern-ireland":  "Northern Ireland",
  "US":                "United States",
};

const ALL_REGIONS: Region[] = ["england-and-wales", "scotland", "northern-ireland", "US"];

type Props = {
  anchor: HTMLElement | null;
  onClose: () => void;
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  dark: boolean;
  onToggleDark: () => void;
  onExportConfig: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportConfig: (e: ChangeEvent<HTMLInputElement>) => void;
  /** When true, hides Gantt-specific and config options not relevant before sign-in */
  splashMode?: boolean;
};

const SettingsPopover: FunctionComponent<Props> = ({
  anchor, onClose, settings, updateSetting,
  dark, onToggleDark,
  onExportConfig, fileInputRef, onImportConfig,
  splashMode = false,
}) => (
  <>
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      aria-labelledby="settings-popover-title"
    >
      <Box sx={{ p: 2, minWidth: 220 }}>
        <Typography id="settings-popover-title" variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Settings</Typography>
        <Divider sx={{ mb: 1.5 }} />
        <Stack direction="column" sx={{ gap: 0.5 }}>
          <FormControlLabel
            control={<Switch size="small" checked={dark} onChange={onToggleDark} />}
            label={<Typography variant="body2">Dark mode</Typography>}
          />
          {!splashMode && (
            <>
              <FormControlLabel
                control={<Switch size="small" checked={settings.highlightWeekends} onChange={(e) => updateSetting("highlightWeekends", e.target.checked)} />}
                label={<Typography variant="body2">Highlight weekends</Typography>}
              />
              <FormControlLabel
                control={<Switch size="small" checked={settings.highlightBankHolidays} onChange={(e) => updateSetting("highlightBankHolidays", e.target.checked)} />}
                label={<Typography variant="body2">Highlight bank holidays</Typography>}
              />
              {settings.highlightBankHolidays && (
                <Box sx={{ pl: 4.5, pb: 0.5 }}>
                  <Select
                    multiple
                    size="small"
                    displayEmpty
                    value={settings.bankHolidayRegions}
                    onChange={(e) => updateSetting("bankHolidayRegions", e.target.value as Region[])}
                    renderValue={(sel) => {
                      const selectedRegions = sel as string[];
                      if (selectedRegions.length === 0) { return <em style={{ opacity: 0.5 }}>None</em>; }
                      if (selectedRegions.length === 1) { return REGION_LABELS[selectedRegions[0] as Region] ?? selectedRegions[0]; }
                      return `${selectedRegions.length} regions`;
                    }}
                    sx={{ width: "100%", fontSize: "0.8rem" }}
                  >
                    {ALL_REGIONS.map((r) => (
                      <MenuItem key={r} value={r} dense>
                        <Checkbox size="small" checked={settings.bankHolidayRegions.includes(r)} sx={{ py: 0 }} />
                        <ListItemText primary={REGION_LABELS[r]} slotProps={{ primary: { variant: "body2" } }} />
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              )}
            </>
          )}
          <FormControlLabel
            control={<Switch size="small" checked={settings.colorblindMode} onChange={(e) => updateSetting("colorblindMode", e.target.checked)} />}
            label={<Typography variant="body2">Colorblind-friendly palette</Typography>}
          />
        </Stack>
        {!splashMode && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary"
              sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", mb: 1 }}>
              Config
            </Typography>
            <ButtonGroup size="small" variant="outlined" fullWidth>
              <Button onClick={onExportConfig}>Export</Button>
              <Button onClick={() => fileInputRef.current?.click()}>Import</Button>
            </ButtonGroup>
          </>
        )}
      </Box>
    </Popover>
    <input type="file" accept=".json" hidden ref={fileInputRef} onChange={onImportConfig} aria-label="Import configuration file" />
  </>
);

export { SettingsPopover };
