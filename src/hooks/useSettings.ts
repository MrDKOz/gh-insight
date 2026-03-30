import type { Settings } from "../types/SettingsTypes";
import * as t from "io-ts";
import { useCallback, useState } from "react";
import { DEFAULT_SETTINGS } from "../types/SettingsTypes";
import { decodeSafe } from "../utils/iotsUtils";

const RegionCodec = t.union([
  t.literal("england-and-wales"),
  t.literal("scotland"),
  t.literal("northern-ireland"),
  t.literal("US"),
]);

// t.partial makes every field optional so a partially-written or
// partially-migrated entry still decodes — unknown keys are simply absent.
// bankHolidayRegion (singular) is the legacy single-value field; it is
// migrated to bankHolidayRegions (array) in loadSettings below.
const StoredSettingsCodec = t.partial({
  highlightWeekends:     t.boolean,
  colorblindMode:        t.boolean,
  highlightBankHolidays: t.boolean,
  bankHolidayRegions:    t.array(RegionCodec),
  bankHolidayRegion:     RegionCodec,
});

const LS_KEY = "gmt_settings";

const loadSettings = (): Settings => {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) { return DEFAULT_SETTINGS; }
    const p = decodeSafe(JSON.parse(stored) as unknown, StoredSettingsCodec);
    if (!p) { return DEFAULT_SETTINGS; }
    // Prefer the canonical array field; fall back to the legacy singular field
    const regions = p.bankHolidayRegions ?? (p.bankHolidayRegion ? [p.bankHolidayRegion] : null);
    return {
      highlightWeekends:     p.highlightWeekends     ?? DEFAULT_SETTINGS.highlightWeekends,
      colorblindMode:        p.colorblindMode        ?? DEFAULT_SETTINGS.colorblindMode,
      highlightBankHolidays: p.highlightBankHolidays ?? DEFAULT_SETTINGS.highlightBankHolidays,
      bankHolidayRegions: regions && regions.length > 0 ? regions : DEFAULT_SETTINGS.bankHolidayRegions,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const useSettings = (): { settings: Settings; updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void } => {
  const [settings, setSettings] = useState<Settings>(loadSettings);

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
export type { Settings } from "../types/SettingsTypes";
