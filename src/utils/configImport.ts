import type { Region } from "../api/bankHolidayApi";
import type { Settings } from "../types/SettingsTypes";

const VALID_REGIONS = new Set<string>(["england-and-wales", "scotland", "northern-ireland", "US"]);
const isRegion = (v: unknown): v is Region => typeof v === "string" && VALID_REGIONS.has(v);

/**
 * Parsed fields from an imported config file.
 * All fields are optional — the import applies only what is present and valid.
 */
type ImportedConfig = {
  dark?: boolean;
  token?: string;
  settings?: Partial<Settings>;
};

/**
 * Parses raw JSON (already parsed to `unknown`) from a config import file.
 * Returns the validated fields, or a string describing why the file was rejected.
 */
const parseImportConfig = (raw: unknown): ImportedConfig | string => {
  if (typeof raw !== "object" || raw === null) { return "Not a valid config object"; }
  const c = raw as Record<string, unknown>;
  if (c.version !== 1) { return "Unsupported config version"; }

  const result: ImportedConfig = {};

  if (typeof c.dark === "boolean")              { result.dark  = c.dark; }
  if (typeof c.token === "string" && c.token)   { result.token = c.token; }

  if (typeof c.settings === "object" && c.settings !== null) {
    const s = c.settings as Record<string, unknown>;
    const settings: Partial<Settings> = {};
    if (typeof s.highlightWeekends     === "boolean") { settings.highlightWeekends     = s.highlightWeekends; }
    if (typeof s.colorblindMode        === "boolean") { settings.colorblindMode        = s.colorblindMode; }
    if (typeof s.highlightBankHolidays === "boolean") { settings.highlightBankHolidays = s.highlightBankHolidays; }
    if (Array.isArray(s.bankHolidayRegions)) {
      settings.bankHolidayRegions = (s.bankHolidayRegions as unknown[]).filter(isRegion);
    }
    result.settings = settings;
  }

  return result;
};

export { parseImportConfig };
export type { ImportedConfig };
