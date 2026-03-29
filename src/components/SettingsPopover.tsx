import type { FunctionComponent } from "react";
import type { Settings } from "../hooks/useSettings";
import type { Region } from "../api/bankHolidayApi";
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
  onExportConfig: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportConfig: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDisconnect: () => void;
};

const SettingsPopover: FunctionComponent<Props> = ({
  anchor, onClose, settings, updateSetting,
  onExportConfig, fileInputRef, onImportConfig, onDisconnect,
}) => (
  <>
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <Box sx={{ p: 2, minWidth: 220 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Settings</Typography>
        <Divider sx={{ mb: 1.5 }} />
        <Stack direction="column" gap={0.5}>
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
                  const s = sel as string[];
                  if (s.length === 0) { return <em style={{ opacity: 0.5 }}>None</em>; }
                  if (s.length === 1) { return REGION_LABELS[s[0] as Region] ?? s[0]; }
                  return `${s.length} regions`;
                }}
                sx={{ width: "100%", fontSize: "0.8rem" }}
              >
                {ALL_REGIONS.map((r) => (
                  <MenuItem key={r} value={r} dense>
                    <Checkbox size="small" checked={settings.bankHolidayRegions.includes(r)} sx={{ py: 0 }} />
                    <ListItemText primary={REGION_LABELS[r]} primaryTypographyProps={{ variant: "body2" }} />
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}
          <FormControlLabel
            control={<Switch size="small" checked={settings.colorblindMode} onChange={(e) => updateSetting("colorblindMode", e.target.checked)} />}
            label={<Typography variant="body2">Colorblind-friendly palette</Typography>}
          />
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: "0.06em", display: "block", mb: 1 }}>
          Config
        </Typography>
        <ButtonGroup size="small" variant="outlined" fullWidth>
          <Button onClick={onExportConfig}>Export</Button>
          <Button onClick={() => fileInputRef.current?.click()}>Import</Button>
        </ButtonGroup>
        <Divider sx={{ my: 1.5 }} />
        <Button variant="outlined" color="error" size="small" fullWidth onClick={onDisconnect}>
          Disconnect
        </Button>
      </Box>
    </Popover>
    <input type="file" accept=".json" hidden ref={fileInputRef} onChange={onImportConfig} />
  </>
);

export { SettingsPopover };
