import { useState, useCallback } from "react";

type Settings = {
  highlightWeekends: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  highlightWeekends: false,
};

const LS_KEY = "gmt_settings";

function useSettings(): { settings: Settings; updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void } {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSetting };
}

export { useSettings };
export type { Settings };
