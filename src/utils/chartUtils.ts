import { MS_PER_DAY } from "./dateUtils";

type SvgBand = { x: string; w: string };

/**
 * Returns SVG band rectangles for Saturday+Sunday within [minTime, minTime + totalDays * MS_PER_DAY].
 * Each band spans two days. Used by SVG charts that highlight weekends.
 */
const calcWeekendBands = (minTime: number, totalDays: number, paddingLeft: number, chartWidth: number): SvgBand[] => {
  const bands: SvgBand[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const day = new Date(minTime + i * MS_PER_DAY);
    if (day.getUTCDay() !== 6) { continue; }
    const x = paddingLeft + (i / totalDays) * chartWidth;
    const w = Math.min((2 / totalDays) * chartWidth, chartWidth - (x - paddingLeft));
    bands.push({ x: x.toFixed(1), w: w.toFixed(1) });
  }
  return bands;
};

/**
 * Returns SVG band rectangles for each bank holiday that falls within the chart's time range.
 */
const calcBankHolidayBands = (
  bankHolidays: ReadonlyArray<{ date: string }>,
  minTime: number,
  totalDays: number,
  paddingLeft: number,
  chartWidth: number,
): SvgBand[] => {
  const dayWidth = (1 / totalDays) * chartWidth;
  return bankHolidays.flatMap(({ date }) => {
    const t = new Date(date).getTime();
    if (t < minTime || t > minTime + totalDays * MS_PER_DAY) { return []; }
    const i = (t - minTime) / MS_PER_DAY;
    const x = paddingLeft + (i / totalDays) * chartWidth;
    return [{ x: x.toFixed(1), w: Math.min(dayWidth, chartWidth - (x - paddingLeft)).toFixed(1) }];
  });
};

/**
 * Calculates a y-axis step size that keeps the number of grid lines reasonable.
 * Thresholds: ≤12 → 1, ≤30 → 2, otherwise ceil(max / 8).
 */
const calcYAxisStep = (max: number): number =>
  max <= 12 ? 1 : max <= 30 ? 2 : Math.ceil(max / 8);

/**
 * Returns evenly-spaced indices into an array of `totalPoints` elements,
 * suitable for x-axis label positions.
 */
const calcXAxisIndices = (totalPoints: number, numLabels: number): number[] =>
  Array.from({ length: numLabels }, (_, i) =>
    Math.round((i / Math.max(numLabels - 1, 1)) * (totalPoints - 1)),
  );

export { calcBankHolidayBands, calcWeekendBands, calcXAxisIndices, calcYAxisStep };
