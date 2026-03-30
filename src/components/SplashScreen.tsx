import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

type GhCliStatus = "checking" | "available" | "unavailable";

type Props = {
  onConnect: (token: string) => void;
  onConnectWithGhCli?: () => Promise<void>;
  onCheckGhCli?: () => Promise<boolean>;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
};

const GanttIcon: FunctionComponent = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="4"  width="9"  height="3" rx="1.5" fill="currentColor" opacity="1"   />
    <rect x="2" y="9"  width="14" height="3" rx="1.5" fill="currentColor" opacity="0.7" />
    <rect x="2" y="14" width="6"  height="3" rx="1.5" fill="currentColor" opacity="0.45"/>
    <rect x="2" y="19" width="11" height="3" rx="1.5" fill="currentColor" opacity="0.25"/>
  </svg>
);

const GitHubIcon: FunctionComponent = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const KeyIcon: FunctionComponent = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7.5" cy="15.5" r="5.5"/>
    <path d="m21 2-9.6 9.6"/>
    <path d="m15.5 7.5 3 3L22 7l-3-3"/>
  </svg>
);

const GH_CLI_STATUS_COLOR: Record<GhCliStatus, string> = {
  checking:    "default",
  available:   "success",
  unavailable: "error",
} as const;

const GH_CLI_STATUS_LABEL: Record<GhCliStatus, string> = {
  checking:    "Checking…",
  available:   "Available",
  unavailable: "Unavailable",
};

const SplashScreen: FunctionComponent<Props> = ({
  onConnect, onConnectWithGhCli, onCheckGhCli, onDemo, loading, error,
}) => {
  const [token, setToken]               = useState("");
  const [ghCliStatus, setGhCliStatus]   = useState<GhCliStatus>("checking");
  const [ghCliLoading, setGhCliLoading] = useState(false);

  useEffect(() => {
    if (!onCheckGhCli) { return; }
    onCheckGhCli()
      .then((ok) => setGhCliStatus(ok ? "available" : "unavailable"))
      .catch(() => setGhCliStatus("unavailable"));
  }, [onCheckGhCli]);

  const submit = () => {
    const trimmed = token.trim();
    if (trimmed) { onConnect(trimmed); }
  };

  const handleGhCliClick = async () => {
    if (!onConnectWithGhCli) { return; }
    setGhCliLoading(true);
    try {
      await onConnectWithGhCli();
    } finally {
      setGhCliLoading(false);
    }
  };

  const busy = loading || ghCliLoading;

  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      p: 3,
      background: (t) => t.palette.mode === "dark"
        ? "radial-gradient(ellipse at 50% 0%, rgba(9,105,218,0.12) 0%, transparent 65%)"
        : "radial-gradient(ellipse at 50% 0%, rgba(9,105,218,0.07) 0%, transparent 65%)",
    }}>
      <Box sx={{ width: "100%", maxWidth: 420 }}>

        {/* Brand */}
        <Stack alignItems="center" sx={{ mb: 4 }}>
          <Box sx={{
            color: "primary.main",
            mb: 2,
            p: 1.5,
            borderRadius: 3,
            bgcolor: (t) => t.palette.mode === "dark" ? "rgba(9,105,218,0.15)" : "rgba(9,105,218,0.08)",
          }}>
            <GanttIcon />
          </Box>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.03em", mb: 0.5 }}>
            GitHub Work Visualiser
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visualise milestones &amp; epics across your repositories
          </Typography>
        </Stack>

        <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ borderRadius: 0, borderBottom: 1, borderColor: "divider" }}>
              {error}
            </Alert>
          )}

          <Box sx={{ p: 3 }}>

            {/* GitHub CLI sign-in */}
            {onConnectWithGhCli && (
              <Box sx={{ mb: 2.5 }}>
                <Button
                  variant="contained"
                  onClick={handleGhCliClick}
                  disabled={busy}
                  fullWidth
                  disableElevation
                  startIcon={<GitHubIcon />}
                  sx={{ py: 1.25, fontWeight: 600 }}
                >
                  {ghCliLoading ? "Connecting…" : "Sign in with GitHub CLI"}
                </Button>
                <Stack direction="row" alignItems="center" justifyContent="center" gap={1} sx={{ mt: 1.25 }}>
                  <Chip
                    label={`GitHub CLI ${GH_CLI_STATUS_LABEL[ghCliStatus]}`}
                    color={GH_CLI_STATUS_COLOR[ghCliStatus] as "default" | "success" | "error"}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: "0.7rem", height: 22 }}
                  />
                </Stack>
              </Box>
            )}

            {onConnectWithGhCli && (
              <Divider sx={{ mb: 2.5 }}>
                <Typography variant="caption" color="text.secondary">or use a token</Typography>
              </Divider>
            )}

            {/* PAT sign-in */}
            <Stack gap={1.5}>
              <TextField
                type="password"
                label="Personal Access Token"
                placeholder="ghp_… or fine-grained token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                size="small"
                fullWidth
                disabled={busy}
                autoFocus={!onConnectWithGhCli}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start" sx={{ color: "text.disabled" }}>
                        <KeyIcon />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                variant={onConnectWithGhCli ? "outlined" : "contained"}
                onClick={submit}
                disabled={!token.trim() || busy}
                fullWidth
                disableElevation
              >
                {loading && !ghCliLoading ? "Connecting…" : "Connect with token"}
              </Button>
            </Stack>

          </Box>

          <Divider />

          {/* Demo */}
          <Box sx={{ p: 2, bgcolor: "action.hover" }}>
            <Button
              variant="text"
              onClick={onDemo}
              fullWidth
              disabled={busy}
              size="small"
              sx={{ color: "text.secondary" }}
            >
              Explore with demo data →
            </Button>
          </Box>

        </Paper>

        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 2, textAlign: "center" }}>
          Your token is encrypted locally and never sent anywhere other than api.github.com
        </Typography>

        <Typography variant="caption" color="text.disabled" sx={{ position: "fixed", bottom: 12, right: 16 }}>
          v{__APP_VERSION__}
        </Typography>
      </Box>
    </Box>
  );
};

export { SplashScreen };
