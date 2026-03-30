import type { Region } from "../api/bankHolidayApi";
import { useCallback, useState } from "react";

const VALID_REGIONS: Region[] = ["england-and-wales", "scotland", "northern-ireland", "US"];

type Settings = {
  highlightWeekends: boolean;
  colorblindMode: boolean;
  highlightBankHolidays: boolean;
  bankHolidayRegions: Region[];
};

const DEFAULT_SETTINGS: Settings = {
  highlightWeekends: false,
  colorblindMode: false,
  highlightBankHolidays: false,
  bankHolidayRegions: ["england-and-wales"],
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
      // Also migrate old single-value bankHolidayRegion → bankHolidayRegions array.
      const rawRegions = Array.isArray(p.bankHolidayRegions)
        ? (p.bankHolidayRegions as unknown[]).filter((v): v is Region => VALID_REGIONS.includes(v as Region))
        : VALID_REGIONS.includes(p.bankHolidayRegion as Region)
          ? [p.bankHolidayRegion as Region]   // migrate old single-value setting
          : DEFAULT_SETTINGS.bankHolidayRegions;
      return {
        highlightWeekends:     typeof p.highlightWeekends     === "boolean" ? p.highlightWeekends     : DEFAULT_SETTINGS.highlightWeekends,
        colorblindMode:        typeof p.colorblindMode        === "boolean" ? p.colorblindMode        : DEFAULT_SETTINGS.colorblindMode,
        highlightBankHolidays: typeof p.highlightBankHolidays === "boolean" ? p.highlightBankHolidays : DEFAULT_SETTINGS.highlightBankHolidays,
        bankHolidayRegions: rawRegions.length > 0 ? rawRegions : DEFAULT_SETTINGS.bankHolidayRegions,
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
