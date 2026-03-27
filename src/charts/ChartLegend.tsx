import type { FunctionComponent } from "react";

export type ChartLegendItem = { color: string; label: string };

type Props = {
  items: ChartLegendItem[];
  /**
   * Horizontal centre of the legend in SVG user units.
   * Typically `L + CW / 2` (centre of the chart data area).
   */
  cx: number;
  /**
   * Text baseline Y in SVG user units.
   * Place within the chart's top margin — `T - 8` works for charts with T ≥ 24.
   */
  y: number;
  /**
   * Fill colour for label text. Pass `COL.label` from the parent chart so
   * dark-mode CSS overrides via `className="chart-label"` still apply.
   */
  fill: string;
};

const FONT_SIZE   = 11;
const SWATCH_W    = 11;
const SWATCH_H    = 11;
const INNER_GAP   = 6;   // between swatch right edge and label text
const BETWEEN_GAP = 22;  // between one item's text end and the next swatch

/** Character-width estimate for fontSize 11, proportional font. */
const estTextW = (text: string) => text.length * FONT_SIZE * 0.58;

/**
 * Horizontal legend rendered as SVG elements — scales naturally with the
 * chart's viewBox. Items are laid out left-to-right and centred around `cx`.
 */
const ChartLegend: FunctionComponent<Props> = ({ items, cx, y, fill }) => {
  const totalW = items.reduce(
    (sum, { label }, i) =>
      sum + SWATCH_W + INNER_GAP + estTextW(label) + (i < items.length - 1 ? BETWEEN_GAP : 0),
    0,
  );

  let curX = cx - totalW / 2;

  return (
    <g>
      {items.map(({ color, label }) => {
        const x = curX;
        curX += SWATCH_W + INNER_GAP + estTextW(label) + BETWEEN_GAP;
        return (
          <g key={label}>
            <rect
              x={x.toFixed(1)}
              y={(y - SWATCH_H + 2).toFixed(1)}
              width={SWATCH_W}
              height={SWATCH_H}
              fill={color}
              rx={2}
              opacity={0.88}
            />
            <text
              x={(x + SWATCH_W + INNER_GAP).toFixed(1)}
              y={y}
              fill={fill}
              fontSize={FONT_SIZE}
              fontFamily="inherit"
              className="chart-label"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export { ChartLegend };
