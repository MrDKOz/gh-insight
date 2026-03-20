import type { FunctionComponent, MouseEvent, RefObject } from "react";
import type { TimelineItem, MilestoneMeta } from "../types";
import { fmtDate, itemEndDate } from "../utils/utils";

type Props = {
  sortedItems: TimelineItem[];
  milestones: MilestoneMeta[];
  isMultiMilestone: boolean;
  milestoneColorMap: Map<number, string>;
  hasOpenIssues: boolean;
  labelWidth: number;
  axisHeight: number;
  trackWidth: number;
  minTime: number;
  totalMs: number;
  todayMs: number;
  trackColRef: RefObject<HTMLDivElement>;
  axisRef: RefObject<HTMLDivElement>;
  onResizeStart: (e: MouseEvent<HTMLDivElement>) => void;
};

const ROW_HEIGHT = 31;

function durationDays(start: string, end: string | null): number | null {
  if (!end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
}

const GanttView: FunctionComponent<Props> = ({
  sortedItems,
  milestones,
  isMultiMilestone,
  milestoneColorMap,
  hasOpenIssues,
  labelWidth,
  axisHeight,
  trackWidth,
  minTime,
  totalMs,
  todayMs,
  trackColRef,
  axisRef,
  onResizeStart,
}) => {
  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday = todayMs >= minTime;
  const numDateLabels = Math.max(4, Math.min(24, Math.floor(trackWidth / 110)));
  const dateLabels = Array.from({ length: numDateLabels }, (_, i) =>
    fmtDate(new Date(minTime + (totalMs * i) / (numDateLabels - 1)).toISOString()),
  );

  return (
    <>
      <div className="tl-legend">
        <div className="tl-legend-item">
          <span className="tl-swatch tl-swatch--issue" />
          <span>Issues (closed)</span>
        </div>
        {hasOpenIssues && (
          <div className="tl-legend-item">
            <span className="tl-swatch tl-swatch--issue-open" />
            <span>Issues (open)</span>
          </div>
        )}
        <div className="tl-legend-item">
          <span className="tl-swatch tl-swatch--pr-merged" />
          <span>PRs (merged)</span>
        </div>
        <div className="tl-legend-item">
          <span className="tl-swatch tl-swatch--pr-closed" />
          <span>PRs (closed)</span>
        </div>
      </div>

      {isMultiMilestone && (
        <div className="tl-milestone-legend">
          {milestones.map((m) => (
            <div key={m.number} className="tl-milestone-legend-item">
              <span className="tl-milestone-swatch" style={{ background: m.color }} />
              <span>{m.title}</span>
            </div>
          ))}
        </div>
      )}

      <p className="tl-hint">
        Click issue/PR numbers to open in GitHub &nbsp;·&nbsp; Drag handle to resize labels &nbsp;·&nbsp; Scroll wheel
        to zoom
      </p>

      <div className="tl-body">
        <div className="tl-label-col" style={{ width: labelWidth }}>
          <div style={{ height: axisHeight, flexShrink: 0 }} />
          {sortedItems.map((item) => {
            const isOpen = item.type === "issue" ? !item.closedAt : !(item.mergedAt || item.closedAt);
            const isClosedPR = item.type === "pr" && !item.mergedAt && !!item.closedAt;
            const badgeClass =
              item.type === "issue"
                ? "tl-badge tl-badge--issue"
                : isClosedPR
                  ? "tl-badge tl-badge--pr-closed"
                  : "tl-badge tl-badge--pr";
            return (
              <div
                key={`lbl-${item.type}-${item.number}`}
                className="tl-label"
                style={{
                  height: ROW_HEIGHT,
                  opacity: isOpen ? 0.75 : 1,
                  boxShadow: isMultiMilestone
                    ? `inset 3px 0 0 ${milestoneColorMap.get(item.milestoneNumber) ?? "#57606a"}`
                    : undefined,
                }}
              >
                <span className={badgeClass}>{item.type.toUpperCase()}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className={`tl-num tl-num--${item.type}`}>
                  #{item.number}
                </a>
                <span className="tl-title" title={item.title}>
                  {item.title}
                </span>
                <div className="tl-resize-handle" onMouseDown={onResizeStart} />
              </div>
            );
          })}
        </div>

        <div className="tl-track-col" ref={trackColRef}>
          <div className="tl-date-axis" ref={axisRef} style={{ width: trackWidth }}>
            {dateLabels.map((label, i) => (
              <span key={i} className="tl-date-label">
                {label}
              </span>
            ))}
          </div>
          {sortedItems.map((item) => {
            const isOpen = item.type === "issue" ? !item.closedAt : !(item.mergedAt || item.closedAt);
            const startMs = new Date(item.createdAt).getTime();
            const endDate = isOpen ? null : itemEndDate(item);
            const endMs = isOpen ? todayMs : new Date(endDate!).getTime();

            const leftPct = ((startMs - minTime) / totalMs) * 100;
            const widthPct = Math.max(((endMs - startMs) / totalMs) * 100, 0.3);

            const duration = durationDays(item.createdAt, isOpen ? null : (endDate ?? null));
            const durationText =
              duration === null ? "ongoing" : duration === 0 ? "Same day" : duration === 1 ? "1 day" : `${duration} days`;

            const isMergedPR = item.type === "pr" && !!item.mergedAt;
            const barClass = [
              "tl-bar",
              isOpen
                ? item.type === "issue"
                  ? "tl-bar--issue-open"
                  : "tl-bar--pr-open"
                : item.type === "issue"
                  ? "tl-bar--issue"
                  : isMergedPR
                    ? "tl-bar--pr-merged"
                    : "tl-bar--pr-closed",
            ].join(" ");

            const barWidthPx = (widthPct / 100) * trackWidth;
            const barLabel =
              barWidthPx < 40
                ? ""
                : isOpen
                  ? `${fmtDate(item.createdAt)} → today (${durationText})`
                  : duration !== null && duration <= 2
                    ? durationText
                    : `${fmtDate(item.createdAt)} → ${fmtDate(endDate)} (${durationText})`;

            const statusWord = isOpen ? "Open" : item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";

            const tooltip = [
              `${item.type === "pr" ? "PR" : "Issue"} #${item.number}: ${item.title}`,
              item.type === "pr" && item.linkedIssue ? `Closes #${item.linkedIssue}` : "",
              `Opened: ${fmtDate(item.createdAt)}`,
              isOpen ? "Status: Open" : `${statusWord}: ${fmtDate(endDate)}`,
              `Duration: ${durationText}`,
            ]
              .filter(Boolean)
              .join("\n");

            return (
              <div key={`trk-${item.type}-${item.number}`} className="tl-track-row" style={{ height: ROW_HEIGHT }}>
                <div className="tl-track" style={{ width: trackWidth }}>
                  {showToday && <div className="tl-today-marker" style={{ left: `${todayLeftPct}%` }} />}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={barClass}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={tooltip}
                  >
                    {barLabel}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export { GanttView };
