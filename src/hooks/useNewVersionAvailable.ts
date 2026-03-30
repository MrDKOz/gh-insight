import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

/**
 * Polls `<base>/version.json` periodically and returns true when the server
 * has a newer build than the one currently running. Only active in production
 * (dev builds skip polling since there's no version.json to fetch).
 */
const useNewVersionAvailable = (): boolean => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) { return; }

    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store" });
        if (!res.ok) { return; }
        const data: unknown = await res.json();
        if (
          typeof data === "object" && data !== null &&
          "buildTime" in data &&
          typeof (data as { buildTime: unknown }).buildTime === "number" &&
          (data as { buildTime: number }).buildTime > __APP_BUILD_TIME__
        ) {
          setAvailable(true);
        }
      } catch {
        // Network error — silently ignore, will retry next interval
      }
    };

    void check();
    const id = setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return available;
};

export { useNewVersionAvailable };
