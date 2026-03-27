import { useCallback, useState } from "react";

type Settings = {
  highlightWeekends: boolean;
  colorblindMode: boolean;
  fullWidth: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  highlightWeekends: false,
  colorblindMode: false,
  fullWidth: false,
};

const LS_KEY = "gmt_settings";

const useSettings = (): { settings: Settings; updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void } => {
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
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* quota exceeded — setting still applies for this session */ }
      return next;
    });
  }, []);

  return { settings, updateSetting };
};

export { useSettings };
export type { Settings };
