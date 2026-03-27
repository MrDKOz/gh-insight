import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

type Props = {
  onConnect: (token: string) => void;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
};

const GanttIcon: FunctionComponent = () => (
  <svg width="40" height="40" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1" y="3"   width="10" height="3"  rx="1.5" fill="currentColor" opacity="0.9" />
    <rect x="1" y="8.5" width="15" height="3"  rx="1.5" fill="currentColor" opacity="0.7" />
    <rect x="1" y="14"  width="7"  height="3"  rx="1.5" fill="currentColor" opacity="0.5" />
  </svg>
);

const SplashScreen: FunctionComponent<Props> = ({ onConnect, onDemo, loading, error }) => {
  const [token, setToken] = useState("");

  const submit = () => {
    const trimmed = token.trim();
    if (trimmed) { onConnect(trimmed); }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
      <Box sx={{ width: "100%", maxWidth: 400 }}>

        {/* Brand mark */}
        <Stack alignItems="center" sx={{ mb: 4 }}>
          <Box sx={{ color: "primary.main", mb: 1.5 }}>
            <GanttIcon />
          </Box>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: "-0.02em", mb: 0.5 }}>
            GitHub Work Visualiser
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Milestone insights for engineering leads
          </Typography>
        </Stack>

        <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

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
              disabled={loading}
              autoFocus
            />
            <Button
              variant="contained"
              onClick={submit}
              disabled={!token.trim() || loading}
              fullWidth
              disableElevation
            >
              {loading ? "Connecting…" : "Connect to GitHub"}
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">or</Typography>
          </Divider>

          <Button variant="outlined" onClick={onDemo} fullWidth disabled={loading} size="small">
            Explore with demo data
          </Button>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, textAlign: "center" }}>
          Your token is encrypted locally and never sent anywhere other than api.github.com
        </Typography>
      </Box>
    </Box>
  );
};

export { SplashScreen };
