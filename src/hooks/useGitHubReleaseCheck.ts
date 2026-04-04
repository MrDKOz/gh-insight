import { useEffect, useState } from "react";
import { isElectron } from "../utils/platform";

type ReleaseInfo = { version: string; releasesUrl: string } | null;

const compareVersions = (a: string, b: string): number => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) { return diff; }
  }
  return 0;
};

/**
 * Fetches the latest GitHub release once on mount and returns info about it
 * if the release version is newer than the currently running build.
 * Only active in production — dev builds skip the check.
 */
const useGitHubReleaseCheck = (): ReleaseInfo => {
  const [release, setRelease] = useState<ReleaseInfo>(null);

  useEffect(() => {
    if (!isElectron()) { return; }

    fetch("https://api.github.com/repos/MrDKOz/gh-insight/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (typeof data !== "object" || data === null) { return; }
        const record = data as Record<string, unknown>;
        const tagName = record["tag_name"];
        if (typeof tagName !== "string") { return; }
        const latest = tagName.replace(/^v/, "");
        if (compareVersions(latest, __APP_VERSION__) > 0) {
          setRelease({
            version: latest,
            releasesUrl: "https://github.com/MrDKOz/gh-insight/releases",
          });
        }
      })
      .catch(() => {
        // Network error — silently ignore, update check is best-effort
      });
  }, []);

  return release;
};

export { useGitHubReleaseCheck };
