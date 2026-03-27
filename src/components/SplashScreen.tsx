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

const SplashScreen: FunctionComponent<Props> = ({ onConnect, onDemo, loading, error }) => {
  const [token, setToken] = useState("");

  const submit = () => {
    const trimmed = token.trim();
    if (trimmed) { onConnect(trimmed); }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
      <Box sx={{ width: "100%", maxWidth: 420 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
          GitHub Work Visualiser
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Milestone insights for engineering leads
        </Typography>

        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
            Connect with GitHub
          </Typography>

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
            >
              {loading ? "Connecting…" : "Connect"}
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Button variant="text" onClick={onDemo} fullWidth disabled={loading} size="small">
            Try demo →
          </Button>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, textAlign: "center" }}>
          Your token is encrypted locally and never sent to any server other than api.github.com.
        </Typography>
      </Box>
    </Box>
  );
};

export { SplashScreen };
