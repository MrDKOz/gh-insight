/** Fetches public holiday dates for a specific region, returning name + date pairs. */

// UK divisions match the keys used by the gov.uk API exactly
type Region = "england-and-wales" | "scotland" | "northern-ireland" | "US";
type BankHoliday = { date: string; name: string };

// Cache per (region, year)
const cache = new Map<string, BankHoliday[]>();

const fetchHolidaysForYear = async (region: Region, year: number): Promise<BankHoliday[]> => {
  const key = `${region}-${year}`;
  const cached = cache.get(key);
  if (cached !== undefined) { return cached; }

  let holidays: BankHoliday[];
  if (region !== "US") {
    const res = await fetch("https://www.gov.uk/bank-holidays.json");
    if (!res.ok) { throw new Error(`UK bank-holiday API returned ${res.status}`); }
    const raw: unknown = await res.json();
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error("Unexpected UK bank-holiday API response shape");
    }
    const data = raw as Record<string, { events: Array<{ date: string; title: string }> }>;
    const division = data[region];
    holidays = (division?.events ?? [])
      .filter((ev) => ev.date.startsWith(String(year)))
      .map((ev) => ({ date: ev.date, name: ev.title }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } else {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`);
    if (!res.ok) { throw new Error(`US holiday API returned ${res.status}`); }
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) { throw new Error("Unexpected US holiday API response shape"); }
    const data = raw as Array<{ date: string; localName: string; types: string[] }>;
    holidays = data
      .filter((d) => d.date.startsWith(String(year)) && !d.types.includes("Observance"))
      .map((d) => ({ date: d.date, name: d.localName }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  cache.set(key, holidays);
  return holidays;
}

const fetchForRegion = async (region: Region, minTime: number, maxTime: number): Promise<BankHoliday[]> => {
  const minYear = new Date(minTime).getFullYear();
  const maxYear = new Date(maxTime).getFullYear();
  const yearPromises: Array<Promise<BankHoliday[]>> = [];
  for (let y = minYear; y <= maxYear; y++) {
    yearPromises.push(fetchHolidaysForYear(region, y));
  }
  const perYear = await Promise.all(yearPromises);
  return perYear.flat().filter((h) => {
    const t = new Date(h.date).getTime();
    return t >= minTime && t <= maxTime;
  });
}

/**
 * Returns all bank/public holidays across the given regions within [minTime, maxTime].
 * Results from multiple regions are merged and deduplicated by date.
 * Results are cached per (region, year).
 */
const fetchBankHolidays = async (regions: Region[], minTime: number, maxTime: number): Promise<BankHoliday[]> => {
  if (regions.length === 0) { return []; }
  const perRegion = await Promise.all(regions.map((r) => fetchForRegion(r, minTime, maxTime)));
  // Merge and deduplicate by date; first region wins on name conflicts
  const seen = new Set<string>();
  const merged: BankHoliday[] = [];
  for (const list of perRegion) {
    for (const h of list) {
      if (!seen.has(h.date)) {
        seen.add(h.date);
        merged.push(h);
      }
    }
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

export { fetchBankHolidays };
export type { BankHoliday, Region };
