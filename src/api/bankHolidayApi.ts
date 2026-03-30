import * as t from "io-ts";
import { decodeOrThrow } from "../utils/iotsUtils";

// UK divisions match the keys used by the gov.uk API exactly
type Region = "england-and-wales" | "scotland" | "northern-ireland" | "US";
type BankHoliday = { date: string; name: string };

// ── Codecs ────────────────────────────────────────────────────────────────────

const UkEventCodec = t.type({ date: t.string, title: t.string });

const UkResponseCodec = t.record(
  t.string,
  t.type({ events: t.array(UkEventCodec) }),
);

const UsHolidayCodec = t.type({
  date:      t.string,
  localName: t.string,
  types:     t.array(t.string),
});

const UsResponseCodec = t.array(UsHolidayCodec);

// ── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, BankHoliday[]>();

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const fetchHolidaysForYear = async (region: Region, year: number): Promise<BankHoliday[]> => {
  const key = `${region}-${year}`;
  const cached = cache.get(key);
  if (cached !== undefined) { return cached; }

  let holidays: BankHoliday[];

  if (region !== "US") {
    const response = await fetch("https://www.gov.uk/bank-holidays.json");
    if (!response.ok) { throw new Error(`UK bank-holiday API returned ${response.status}`); }
    const data = decodeOrThrow(await response.json() as unknown, UkResponseCodec);
    const division = data[region];
    holidays = (division?.events ?? [])
      .filter((ev) => ev.date.startsWith(String(year)))
      .map((ev) => ({ date: ev.date, name: ev.title }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } else {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`);
    if (!response.ok) { throw new Error(`US holiday API returned ${response.status}`); }
    const data = decodeOrThrow(await response.json() as unknown, UsResponseCodec);
    holidays = data
      .filter((d) => d.date.startsWith(String(year)) && !d.types.includes("Observance"))
      .map((d) => ({ date: d.date, name: d.localName }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  cache.set(key, holidays);
  return holidays;
};

const fetchForRegion = async (region: Region, minTime: number, maxTime: number): Promise<BankHoliday[]> => {
  const minYear = new Date(minTime).getFullYear();
  const maxYear = new Date(maxTime).getFullYear();
  const yearPromises: Array<Promise<BankHoliday[]>> = [];
  for (let y = minYear; y <= maxYear; y++) {
    yearPromises.push(fetchHolidaysForYear(region, y));
  }
  const perYear = await Promise.all(yearPromises);
  return perYear.flat().filter((h) => {
    const holidayTimestampMs = new Date(h.date).getTime();
    return holidayTimestampMs >= minTime && holidayTimestampMs <= maxTime;
  });
};

/**
 * Returns all bank/public holidays across the given regions within [minTime, maxTime].
 * Results from multiple regions are merged and deduplicated by date.
 * Results are cached per (region, year).
 */
const fetchBankHolidays = async (regions: Region[], minTime: number, maxTime: number): Promise<BankHoliday[]> => {
  if (regions.length === 0) { return []; }
  const perRegion = await Promise.all(regions.map((r) => fetchForRegion(r, minTime, maxTime)));
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
};

export { fetchBankHolidays };
export type { BankHoliday, Region };
