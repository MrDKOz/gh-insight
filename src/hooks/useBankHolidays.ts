import type { BankHoliday, Region } from "../api/bankHolidayApi";
import { useEffect, useState } from "react";
import { fetchBankHolidays } from "../api/bankHolidayApi";

const useBankHolidays = (options: {
  enabled: boolean;
  regions: Region[];
  /** Unix timestamp (ms) of the earliest item creation date, or null when there are no items. */
  minTime: number | null;
  /** Unix timestamp (ms) of the latest item creation date (clamped to now), or null when there are no items. */
  maxTime: number | null;
}): BankHoliday[] => {
  const { enabled, regions, minTime, maxTime } = options;
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);

  useEffect(() => {
    if (!enabled || regions.length === 0 || minTime === null || maxTime === null) {
      setBankHolidays([]);
      return;
    }
    fetchBankHolidays(regions, minTime, maxTime)
      .then(setBankHolidays)
      .catch(() => { /* silently ignore — non-critical feature */ });
  }, [enabled, regions, minTime, maxTime]);

  return bankHolidays;
};

export { useBankHolidays };
