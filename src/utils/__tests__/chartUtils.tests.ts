import { calcBankHolidayBands, calcWeekendBands, calcXAxisIndices, calcYAxisStep } from "../chartUtils";

// ── calcYAxisStep ─────────────────────────────────────────────────────────────

describe("calcYAxisStep", () => {
  it("returns 1 when max is ≤ 12", () => {
    expect(calcYAxisStep(0)).toBe(1);
    expect(calcYAxisStep(5)).toBe(1);
    expect(calcYAxisStep(12)).toBe(1);
  });

  it("returns 2 when max is between 13 and 30", () => {
    expect(calcYAxisStep(13)).toBe(2);
    expect(calcYAxisStep(30)).toBe(2);
  });

  it("returns ceil(max / 8) when max is above 30", () => {
    expect(calcYAxisStep(31)).toBe(4); // ceil(31/8) = 4
    expect(calcYAxisStep(80)).toBe(10); // ceil(80/8) = 10
    expect(calcYAxisStep(100)).toBe(13); // ceil(100/8) = 13
  });
});

// ── calcXAxisIndices ──────────────────────────────────────────────────────────

describe("calcXAxisIndices", () => {
  it("returns numLabels evenly-spaced indices starting at 0", () => {
    const result = calcXAxisIndices(11, 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(0);   // first index always 0
    expect(result[2]).toBe(10);  // last index always totalPoints-1
  });

  it("returns [0] when only one label is requested", () => {
    expect(calcXAxisIndices(10, 1)).toEqual([0]);
  });

  it("returns all indices when numLabels equals totalPoints", () => {
    const result = calcXAxisIndices(5, 5);

    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("handles numLabels > totalPoints gracefully (clamps indices to totalPoints - 1)", () => {
    const result = calcXAxisIndices(3, 5);
    for (const idx of result) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(2);
    }
  });
});

// ── calcWeekendBands ──────────────────────────────────────────────────────────

describe("calcWeekendBands", () => {
  // Use a known Saturday in UTC: 2025-01-04 is a Saturday
  const saturdayMs = new Date("2025-01-04T00:00:00Z").getTime();

  it("includes a band that starts on a Saturday", () => {
    // Range: exactly the weekend (2 days)
    const bands = calcWeekendBands(saturdayMs, 2, 50, 1000);

    expect(bands.length).toBeGreaterThanOrEqual(1);
  });

  it("returns no bands for a range that contains no weekends", () => {
    // 2025-01-06 (Mon) to 2025-01-09 (Thu) — 4 days, no Saturday in i=0..4
    const mondayMs = new Date("2025-01-06T00:00:00Z").getTime();
    const bands = calcWeekendBands(mondayMs, 4, 50, 1000);

    expect(bands).toHaveLength(0);
  });

  it("returns SVG band objects with numeric x and w string values", () => {
    // Use 6 days so i=0 (Sat) is the only Saturday — no edge-boundary band
    const bands = calcWeekendBands(saturdayMs, 6, 0, 600);
    const positiveBands = bands.filter((b) => parseFloat(b.w) > 0);

    expect(positiveBands.length).toBeGreaterThanOrEqual(1);

    for (const b of positiveBands) {
      expect(typeof b.x).toBe("string");
      expect(typeof b.w).toBe("string");
      expect(parseFloat(b.x)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(b.w)).toBeGreaterThan(0);
    }
  });
});

// ── calcBankHolidayBands ──────────────────────────────────────────────────────

describe("calcBankHolidayBands", () => {
  const minTime = new Date("2025-01-01T00:00:00Z").getTime();
  const totalDays = 30;

  it("returns a band for a holiday within the range", () => {
    const holidays = [{ date: "2025-01-06" }];
    const bands = calcBankHolidayBands(holidays, minTime, totalDays, 50, 900);

    expect(bands).toHaveLength(1);
  });

  it("returns no bands for a holiday outside the range", () => {
    const holidays = [{ date: "2025-03-01" }];
    const bands = calcBankHolidayBands(holidays, minTime, totalDays, 50, 900);

    expect(bands).toHaveLength(0);
  });

  it("returns multiple bands for multiple in-range holidays", () => {
    const holidays = [{ date: "2025-01-05" }, { date: "2025-01-15" }];
    const bands = calcBankHolidayBands(holidays, minTime, totalDays, 50, 900);

    expect(bands).toHaveLength(2);
  });

  it("returns band objects with positive w values", () => {
    const holidays = [{ date: "2025-01-10" }];
    const bands = calcBankHolidayBands(holidays, minTime, totalDays, 0, 600);

    expect(parseFloat(bands[0]!.w)).toBeGreaterThan(0);
  });

  it("returns an empty array when the holiday array is empty", () => {
    expect(calcBankHolidayBands([], minTime, totalDays, 50, 900)).toEqual([]);
  });
});
