import type { BankHoliday, Region } from "../api/bankHolidayApi";
import type { TimelineItem } from "../types/GitHubTypes";
import { useEffect, useState } from "react";
import { fetchBankHolidays } from "../api/bankHolidayApi";

const useBankHolidays = (options: {
  enabled: boolean;
  regions: Region[];
  allItems: TimelineItem[];
}): BankHoliday[] => {
  const { enabled, regions, allItems } = options;
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);

  useEffect(() => {
    if (!enabled || regions.length === 0 || allItems.length === 0) {
      setBankHolidays([]);
      return;
    }
    const timestamps = allItems.map((i) => new Date(i.createdAt).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps, Date.now());
    fetchBankHolidays(regions, minTime, maxTime)
      .then(setBankHolidays)
      .catch(() => { /* silently ignore — non-critical feature */ });
  }, [enabled, regions, allItems]);

  return bankHolidays;
};

export { useBankHolidays };
