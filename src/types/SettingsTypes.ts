import type { Region } from "../api/bankHolidayApi";

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

export { DEFAULT_SETTINGS };
export type { Settings };
