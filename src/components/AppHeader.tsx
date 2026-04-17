import type { UserProfile } from "../types/GitHubTypes";
import type { FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { GearIcon } from "./GearIcon";
import { HelpPopover } from "./HelpPopover";

type Props = {
  userProfile: UserProfile;
  onSettingsClick: (e: MouseEvent<HTMLElement>) => void;
  onSignOut: () => void;
};

const BrandIcon: FunctionComponent = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1" y="3"   width="10" height="3"  rx="1.5" fill="currentColor" opacity="0.9" />
    <rect x="1" y="8.5" width="15" height="3"  rx="1.5" fill="currentColor" opacity="0.7" />
    <rect x="1" y="14"  width="7"  height="3"  rx="1.5" fill="currentColor" opacity="0.5" />
  </svg>
);

const SignOutIcon: FunctionComponent = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const AppHeader: FunctionComponent<Props> = ({ userProfile, onSettingsClick, onSignOut }) => (
    <Box
      component="header"
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        px: 3,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: "background.paper",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }}>
        <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>
          <BrandIcon />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
          GH Insight
        </Typography>
      </Stack>

      {/* Actions */}
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.25 }}>
        <HelpPopover />
        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={onSettingsClick}
            aria-label="Settings"
          >
            <GearIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 0.75 }} />

        <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
          <Box
            component="img"
            src={`${userProfile.avatarUrl}?size=48`}
            alt={userProfile.login}
            width={24}
            height={24}
            sx={{ borderRadius: "50%", display: "block" }}
          />
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {userProfile.name ?? userProfile.login}
          </Typography>
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={onSignOut} aria-label="Sign out" sx={{ mr: -1 }}>
              <SignOutIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
);

export { AppHeader };
