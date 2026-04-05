import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useGitHubReleaseCheck } from "../hooks/useGitHubReleaseCheck";
import { useNewVersionAvailable } from "../hooks/useNewVersionAvailable";

const UpdateBar: FunctionComponent = () => {
  const webUpdate       = useNewVersionAvailable();
  const electronRelease = useGitHubReleaseCheck();

  if (!webUpdate && !electronRelease) { return null; }

  return (
    <Alert
      severity="info"
      sx={{ borderRadius: 0 }}
      action={
        electronRelease ? (
          <Button
            size="small"
            color="inherit"
            href={electronRelease.releasesUrl}
            target="_blank"
            rel="noreferrer"
            component="a"
          >
            Download v{electronRelease.version}
          </Button>
        ) : (
          <Button size="small" color="inherit" onClick={() => window.location.reload()}>
            Reload
          </Button>
        )
      }
    >
      {electronRelease
        ? `A new version (${electronRelease.version}) is available to download.`
        : "A new version is available."}
    </Alert>
  );
};

export { UpdateBar };
