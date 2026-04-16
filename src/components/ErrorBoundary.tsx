import type { ErrorInfo, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { Component } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <Box sx={{ maxWidth: 600, mx: "auto", mt: 8, px: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <Alert severity="error" variant="outlined">
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Something went wrong</Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-word" }}>
              {this.state.error.message}
            </Typography>
          </Alert>
          <Button variant="outlined" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
