import type { FunctionComponent } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";
import { useGitHubReleaseCheck } from "../hooks/useGitHubReleaseCheck";

const HelpCircleIcon: FunctionComponent = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
  </svg>
);

type Section = { heading: string; points: (string | { text: string; href: string })[] };

const SECTIONS: Section[] = [
  {
    heading: "How it works",
    points: [
      "Enter a GitHub Personal Access Token and a repo owner/name.",
      "The app fetches your milestone data directly from GitHub's API and renders it as a Gantt chart alongside Burndown, Cycle Time, Velocity, and Cumulative Flow charts.",
      "No account or sign-up needed.",
    ],
  },
  {
    heading: "Everything stays local",
    points: [
      "Your token and preferences are stored only in your browser — nothing is sent to any server other than GitHub's API (api.github.com).",
      "There is no backend. Clearing your browser storage removes everything.",
    ],
  },
  {
    heading: "Token security",
    points: [
      "Your token is encrypted with AES-GCM. The encryption key lives in your browser's IndexedDB and never leaves your device.",
      "The token is only ever transmitted to api.github.com over HTTPS.",
      "In private browsing mode, IndexedDB may be unavailable — the app will warn you if your token can only be stored without encryption.",
    ],
  },
  {
    heading: "Recommended token setup",
    points: [
      "Use a fine-grained Personal Access Token scoped to only the repos you need.",
      "Required permissions: Metadata (read) · Contents (read) · Issues (read) · Pull requests (read).",
      { text: "Create a fine-grained PAT on GitHub →", href: "https://github.com/settings/personal-access-tokens/new" },
    ],
  },
];

const HelpPopover: FunctionComponent = () => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateRelease = useGitHubReleaseCheck();

  const cancelHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setAnchor(null), 150);
  };

  return (
    <>
      <Badge
        variant="dot"
        color="error"
        invisible={!updateRelease}
        overlap="circular"
        sx={{ "& .MuiBadge-dot": { width: 7, height: 7, minWidth: "unset" } }}
      >
        <IconButton
          size="small"
          aria-label="About this app"
          onMouseEnter={(e) => { cancelHide(); setAnchor(e.currentTarget); }}
          onMouseLeave={scheduleHide}
        >
          <HelpCircleIcon />
        </IconButton>
      </Badge>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        disableAutoFocus
        disableRestoreFocus
        sx={{ pointerEvents: "none", mt: 0.5 }}
        slotProps={{ paper: {
          onMouseEnter: cancelHide,
          onMouseLeave: scheduleHide,
          sx: { pointerEvents: "auto", width: 320, p: 2.5 },
        }}}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          About GH Insight
        </Typography>

        <Stack gap={1.5}>
          {SECTIONS.map((section, i) => (
            <Box key={section.heading}>
              {i > 0 && <Divider sx={{ mb: 1.5 }} />}
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: "0.06em", display: "block", mb: 0.75 }}>
                {section.heading}
              </Typography>
              <Stack gap={0.5}>
                {section.points.map((point, j) =>
                  typeof point === "string" ? (
                    <Typography key={j} variant="body2" color="text.primary" sx={{ lineHeight: 1.5 }}>
                      {point}
                    </Typography>
                  ) : (
                    <Link key={j} href={point.href} target="_blank" rel="noreferrer"
                      variant="body2" sx={{ lineHeight: 1.5 }}>
                      {point.text}
                    </Link>
                  )
                )}
              </Stack>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ mt: 1.5 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          v{__APP_VERSION__} · Made by{" "}
          <Link href="https://github.com/MrDKOz" target="_blank" rel="noreferrer" variant="caption">
            @MrDKOz
          </Link>
        </Typography>

        {updateRelease && (
          <Link
            href={updateRelease.releasesUrl}
            target="_blank"
            rel="noreferrer"
            variant="caption"
            sx={{ display: "block", mt: 0.75, fontWeight: 600, color: "error.main" }}
          >
            Update available (v{updateRelease.version}) →
          </Link>
        )}
      </Popover>
    </>
  );
};

export { HelpPopover };
