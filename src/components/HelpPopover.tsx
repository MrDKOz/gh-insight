import type { FunctionComponent } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Fragment, useState } from "react";
import { useGitHubReleaseCheck } from "../hooks/useGitHubReleaseCheck";
import { isElectron } from "../utils/platform";

const HelpCircleIcon: FunctionComponent = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
  </svg>
);

type TextPoint   = string;
type LinkPoint   = { text: string; href: string };
type TablePoint  = { rows: [string, string][] };
type Point = TextPoint | LinkPoint | TablePoint;
type Section = { heading: string; points: Point[] };

const isTable = (p: Point): p is TablePoint => typeof p === "object" && "rows" in p;
const isLink  = (p: Point): p is LinkPoint  => typeof p === "object" && "text" in p;

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
    heading: "Privacy — no tracking",
    points: [
      "This app has no analytics, no telemetry, and no user tracking of any kind.",
      "Your GitHub token, repository data, and preferences never leave your browser. The only outbound connection the app makes is directly to api.github.com.",
      "There is no backend. Clearing your browser storage removes everything.",
      "The site domain is served via Cloudflare, which may collect anonymised performance metrics (page load times, country). Cloudflare has no access to your token or any GitHub data.",
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
      { rows: [["Metadata", "Read"], ["Contents", "Read"], ["Issues", "Read"], ["Pull requests", "Read"]] },
      { text: "Create a fine-grained PAT on GitHub →", href: "https://github.com/settings/personal-access-tokens/new" },
    ],
  },
];

const HelpPopover: FunctionComponent = () => {
  const [open, setOpen] = useState(false);
  const updateRelease = useGitHubReleaseCheck();

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
          onClick={() => setOpen(true)}
        >
          <HelpCircleIcon />
        </IconButton>
      </Badge>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          About GH Insight
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack gap={2}>
            {SECTIONS.map((section, i) => (
              <Box key={section.heading}>
                {i > 0 && <Divider sx={{ mb: 2 }} />}
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ textTransform: "uppercase", letterSpacing: "0.06em", display: "block", mb: 1 }}>
                  {section.heading}
                </Typography>
                <Stack gap={1}>
                  {section.points.map((point, j) =>
                    isTable(point) ? (
                      <Box key={j} sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "2px 16px" }}>
                        {point.rows.map(([label, value]) => (
                          <Fragment key={label}>
                            <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.6 }}>{label}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{value}</Typography>
                          </Fragment>
                        ))}
                      </Box>
                    ) : isLink(point) ? (
                      <Link key={j} href={point.href} target="_blank" rel="noreferrer"
                        variant="body2" sx={{ lineHeight: 1.6 }}>
                        {point.text}
                      </Link>
                    ) : (
                      <Typography key={j} variant="body2" color="text.primary" sx={{ lineHeight: 1.6 }}>
                        {point}
                      </Typography>
                    )
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ mt: 2 }} />
          <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
            {!isElectron() ? (
              <Link
                href="https://github.com/MrDKOz/gh-insight/releases/latest"
                target="_blank"
                rel="noreferrer"
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                Desktop app available →
              </Link>
            ) : <Box />}
            <Typography variant="caption" color="text.secondary">
              v{__APP_VERSION__} · Made by{" "}
              <Link href="https://github.com/MrDKOz" target="_blank" rel="noreferrer" variant="caption">
                @MrDKOz
              </Link>
            </Typography>
          </Box>

        </DialogContent>
      </Dialog>
    </>
  );
};

export { HelpPopover };
