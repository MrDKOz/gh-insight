import * as t from "io-ts";
import { useEffect, useState } from "react";
import { decodeSafe } from "../utils/iotsUtils";

const VersionFileCodec = t.type({ buildTime: t.number });

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
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store" });
        if (!response.ok) { return; }
        const data = decodeSafe(await response.json() as unknown, VersionFileCodec);
        if (data && data.buildTime > __APP_BUILD_TIME__) {
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
