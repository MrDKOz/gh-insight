import type { FunctionComponent } from "react";
import type { UserProfile } from "../types";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { GearIcon } from "./GearIcon";
import { HelpPopover } from "./HelpPopover";

type Props = {
  userProfile: UserProfile;
  dark: boolean;
  onToggleDark: () => void;
  onSettingsClick: (e: React.MouseEvent<HTMLElement>) => void;
};

const SunIcon: FunctionComponent = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2"  x2="12" y2="5"  />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"  />
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
    <line x1="2"  y1="12" x2="5"  y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon: FunctionComponent = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const AppHeader: FunctionComponent<Props> = ({ userProfile, dark, onToggleDark, onSettingsClick }) => (
  <Box
    component="header"
    sx={{
      borderBottom: 1,
      borderColor: "divider",
      px: 3,
      py: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      bgcolor: "background.paper",
    }}
  >
    <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: "-0.01em" }}>
      GitHub Work Visualiser
    </Typography>

    <Stack direction="row" alignItems="center" gap={0.5}>
      <HelpPopover />
      <IconButton
        size="small"
        onClick={onSettingsClick}
        title="Settings"
        aria-label="Settings"
      >
        <GearIcon />
      </IconButton>
      <IconButton
        size="small"
        onClick={onToggleDark}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </IconButton>

      <Stack direction="row" alignItems="center" gap={0.75} sx={{ ml: 0.5, pl: 1, borderLeft: 1, borderColor: "divider" }}>
        <Box
          component="img"
          src={`${userProfile.avatarUrl}?size=48`}
          alt={userProfile.login}
          width={22}
          height={22}
          sx={{ borderRadius: "50%", display: "block" }}
        />
        <Typography variant="body2" sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {userProfile.name ?? userProfile.login}
        </Typography>
      </Stack>
    </Stack>
  </Box>
);

export { AppHeader };
