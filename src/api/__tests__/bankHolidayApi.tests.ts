import { fetchBankHolidays } from "../bankHolidayApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FetchCall = { ok: boolean; status?: number; body: unknown };

const stubFetch = (...calls: FetchCall[]) => {
  let i = 0;
  return vi.fn((): Promise<Response> => {
    const call = calls[Math.min(i++, calls.length - 1)]!;
    return Promise.resolve({
      ok: call.ok,
      status: call.status ?? (call.ok ? 200 : 500),
      json: () => Promise.resolve(call.body),
    } as Response);
  });
};

// Gov.uk bank-holidays.json shape
const ukBody = (region: string, events: Array<{ date: string; title: string }>) => ({
  [region]: { events },
});

// US Nager public holidays shape
const usBody = (entries: Array<{ date: string; localName: string; types: string[] }>) => entries;

// Helper to create a [minTime, maxTime] range covering an entire year
const yearRange = (year: number) => ({
  min: new Date(`${year}-01-01T00:00:00Z`).getTime(),
  max: new Date(`${year}-12-31T23:59:59Z`).getTime(),
});

// ---------------------------------------------------------------------------
// NOTE: bankHolidayApi uses a module-level cache keyed by (region, year).
// Each test uses a unique year so tests never collide in the cache.
// UK years: 2030-2033  |  US years: 2040-2042  |  multi-year: 2050+
// multi-region: 2060+  |  edge cases: 2070+
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchBankHolidays — UK region (england-and-wales)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses gov.uk events and returns holidays within the date range", async () => {
    const { min, max } = yearRange(2030);
    vi.stubGlobal("fetch", stubFetch({
      ok: true,
      body: ukBody("england-and-wales", [
        { date: "2030-01-01", title: "New Year's Day" },
        { date: "2030-04-18", title: "Good Friday" },
        { date: "2029-12-25", title: "Christmas Day" }, // outside range — should be filtered
      ]),
    }));

    const result = await fetchBankHolidays(["england-and-wales"], min, max);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: "2030-01-01", name: "New Year's Day" });
    expect(result[1]).toEqual({ date: "2030-04-18", name: "Good Friday" });
  });

  it("returns an empty array when no holidays fall in the range", async () => {
    vi.stubGlobal("fetch", stubFetch({
      ok: true,
      body: ukBody("england-and-wales", [
        { date: "2031-01-01", title: "New Year's Day" },
      ]),
    }));

    const min = new Date("2031-06-01").getTime();
    const max = new Date("2031-06-30").getTime();
    const result = await fetchBankHolidays(["england-and-wales"], min, max);

    expect(result).toHaveLength(0);
  });

  it("throws when the gov.uk API returns a non-ok status", async () => {
    vi.stubGlobal("fetch", stubFetch({ ok: false, status: 503, body: {} }));
    const { min, max } = yearRange(2032);

    await expect(
      fetchBankHolidays(["england-and-wales"], min, max),
    ).rejects.toThrow("503");
  });

  it("returns results sorted by date", async () => {
    const { min, max } = yearRange(2033);
    vi.stubGlobal("fetch", stubFetch({
      ok: true,
      body: ukBody("england-and-wales", [
        { date: "2033-12-26", title: "Boxing Day" },
        { date: "2033-01-01", title: "New Year's Day" },
        { date: "2033-04-18", title: "Good Friday" },
      ]),
    }));

    const result = await fetchBankHolidays(["england-and-wales"], min, max);

    expect(result.map((h) => h.date)).toEqual(["2033-01-01", "2033-04-18", "2033-12-26"]);
  });
});

describe("fetchBankHolidays — US region", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses Nager public holiday entries", async () => {
    const { min, max } = yearRange(2040);
    vi.stubGlobal("fetch", stubFetch({
      ok: true,
      body: usBody([
        { date: "2040-01-01", localName: "New Year's Day", types: ["Public"] },
        { date: "2040-07-04", localName: "Independence Day", types: ["Public"] },
      ]),
    }));

    const result = await fetchBankHolidays(["US"], min, max);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: "2040-01-01", name: "New Year's Day" });
    expect(result[1]).toEqual({ date: "2040-07-04", name: "Independence Day" });
  });

  it("filters out Observance entries", async () => {
    const { min, max } = yearRange(2041);
    vi.stubGlobal("fetch", stubFetch({
      ok: true,
      body: usBody([
        { date: "2041-02-17", localName: "Presidents Day", types: ["Observance"] },
        { date: "2041-07-04", localName: "Independence Day", types: ["Public"] },
      ]),
    }));

    const result = await fetchBankHolidays(["US"], min, max);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Independence Day");
  });

  it("throws when the US API returns a non-ok status", async () => {
    const { min, max } = yearRange(2042);
    vi.stubGlobal("fetch", stubFetch({ ok: false, status: 404, body: [] }));

    await expect(
      fetchBankHolidays(["US"], min, max),
    ).rejects.toThrow("404");
  });
});

describe("fetchBankHolidays — multi-year range", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches both years when range spans a year boundary", async () => {
    const fetchMock = stubFetch(
      // first call: 2050 data
      {
        ok: true,
        body: ukBody("scotland", [
          { date: "2050-11-30", title: "St Andrew's Day" },
        ]),
      },
      // second call: 2051 data
      {
        ok: true,
        body: ukBody("scotland", [
          { date: "2051-01-02", title: "New Year's Day (observed)" },
        ]),
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const min = new Date("2050-06-01T00:00:00Z").getTime();
    const max = new Date("2051-06-30T00:00:00Z").getTime();
    const result = await fetchBankHolidays(["scotland"], min, max);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.map((h) => h.date)).toContain("2050-11-30");
    expect(result.map((h) => h.date)).toContain("2051-01-02");
  });
});

describe("fetchBankHolidays — multi-region merge", () => {
  afterEach(() => vi.restoreAllMocks());

  it("merges holidays from two regions and deduplicates shared dates", async () => {
    const { min, max } = yearRange(2060);
    // The UK endpoint returns different data per region via the region key.
    // england-and-wales has Jan 1 + Good Friday; northern-ireland only has Jan 1.
    const fetchMock = vi.fn((url: string): Promise<Response> => {
      // Both regions hit the same gov.uk endpoint, so return a body with both region keys.
      void url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          "england-and-wales": {
            events: [
              { date: "2060-01-01", title: "New Year's Day (E&W)" },
              { date: "2060-04-18", title: "Good Friday" },
            ],
          },
          "northern-ireland": {
            events: [
              { date: "2060-01-01", title: "New Year's Day (NI)" },
            ],
          },
        }),
      } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBankHolidays(["england-and-wales", "northern-ireland"], min, max);

    // Jan 1 appears in both regions but should only appear once
    const jan1 = result.filter((h) => h.date === "2060-01-01");
    expect(jan1).toHaveLength(1);
    // First region's name wins on conflict
    expect(jan1[0]?.name).toBe("New Year's Day (E&W)");
    // Good Friday is only in england-and-wales, should still appear
    expect(result.some((h) => h.date === "2060-04-18")).toBe(true);
  });

  it("returns an empty array for an empty regions list", async () => {
    const { min, max } = yearRange(2070);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBankHolidays([], min, max);

    expect(result).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
