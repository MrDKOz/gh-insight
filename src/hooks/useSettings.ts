import { useCallback, useState } from "react";

type Settings = {
  highlightWeekends: boolean;
  colorblindMode: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  highlightWeekends: false,
  colorblindMode: false,
};

const LS_KEY = "gmt_settings";

const useSettings = (): { settings: Settings; updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void } => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (!stored) {return DEFAULT_SETTINGS;}
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed !== "object" || parsed === null) {return DEFAULT_SETTINGS;}
      const p = parsed as Record<string, unknown>;
      // Validate each field individually so a corrupted or partially-migrated
      // localStorage entry falls back to the default for that field only.
      return {
        highlightWeekends: typeof p.highlightWeekends === "boolean" ? p.highlightWeekends : DEFAULT_SETTINGS.highlightWeekends,
        colorblindMode:    typeof p.colorblindMode    === "boolean" ? p.colorblindMode    : DEFAULT_SETTINGS.colorblindMode,
      };
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
