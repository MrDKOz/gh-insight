import type { BankHoliday } from "../api/bankHolidayApi";
import type { Action } from "../state/appReducer";
import type { GanttHandle, View } from "../types/AppTypes";
import type { Filters } from "../types/FilterTypes";
import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { Dispatch, FunctionComponent } from "react";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BurndownChart } from "../charts/BurndownChart";
import { ContributorsChart } from "../charts/ContributorsChart";
import { CumulativeFlowChart } from "../charts/CumulativeFlowChart";
import { CycleTimeChart } from "../charts/CycleTimeChart";
import { VelocityChart } from "../charts/VelocityChart";
import { useAvatarPreload } from "../hooks/useAvatarPreload";
import { applyFilters } from "../types/FilterTypes";
import { partitionItems } from "../utils/displayUtils";
import { ExportMenu } from "./ExportMenu";
import { FilterBar } from "./FilterBar";
import { GanttView } from "./GanttView";
import { ItemList } from "./ItemList";
import { ReviewWaitList } from "./ReviewWaitList";
import { StatsBar } from "./StatsBar";
import { ViewOptionsMenu } from "./ViewOptionsMenu";


type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
  view: View;
  filters: Filters;
  includePRs: { burndown: boolean; cumulativeFlow: boolean; cycleTime: boolean; velocity: boolean };
  dispatch: Dispatch<Action>;
};

const MilestoneView: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, bankHolidays, colorblindMode, view, filters, includePRs, dispatch }) => {
  useAvatarPreload(items);

  const [showPercentiles, setShowPercentiles] = useState(false);
  const [toolbarSlot, setToolbarSlot] = useState<Element | null>(null);
  const [filterSlot, setFilterSlot]   = useState<Element | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const ganttRef   = useRef<GanttHandle>(null);

  const title =
    milestones.length === 0
      ? "Milestone"
      : milestones.length === 1
        ? (milestones[0]?.title ?? "Milestone")
        : milestones.length === 2
          ? `${milestones[0]?.title ?? ""} + ${milestones[1]?.title ?? ""}`
          : `${milestones.length} milestones`;

  const { closedIssues, openIssues, prItems, mergedPRs, closedPRs } = useMemo(
    () => partitionItems(items),
    [items],
  );

  const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);

  const counts = useMemo(
    () => ({
      openIssues: openIssues.length,
      closedIssues: closedIssues.length,
      openPRs: prItems.filter((i) => !i.mergedAt && !i.closedAt).length,
      mergedPRs: mergedPRs.length,
      closedPRs: closedPRs.length,
    }),
    [openIssues, closedIssues, prItems, mergedPRs, closedPRs],
  );

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    dispatch({ type: "SET_FILTERS", filters: newFilters });
  }, [dispatch]);

  // Read portal target nodes after mount — querying the DOM inline during
  // render returns null on first paint because sibling components haven't
  // been committed yet. useLayoutEffect runs synchronously after commit, so
  // the elements are guaranteed to exist by the time the second paint fires.
  useLayoutEffect(() => {
    setToolbarSlot(document.getElementById("timeline-toolbar"));
    setFilterSlot(document.getElementById("filter-bar-slot"));
  }, []);

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          No items found.
        </Typography>
      </Paper>
    );
  }

  const noFilteredItems = filteredItems.length === 0;

  const toolbar = (
    <Stack direction="row" sx={{ gap: 1, alignItems: "center" }} data-export-exclude>
      <ViewOptionsMenu
        view={view}
        includePRs={includePRs}
        showPercentiles={showPercentiles}
        onShowPercentilesChange={() => setShowPercentiles((v) => !v)}
        dispatch={dispatch}
      />
      <ExportMenu
        view={view}
        filteredItems={filteredItems}
        milestones={milestones}
        title={title}
        wrapperRef={wrapperRef}
        ganttRef={ganttRef}
      />
    </Stack>
  );

  return (
    <>
      {toolbarSlot && createPortal(toolbar, toolbarSlot)}
      {filterSlot && createPortal(
        <FilterBar
          variant="toolbar"
          items={items}
          filters={filters}
          counts={counts}
          onChange={handleFiltersChange}
          colorblindMode={colorblindMode}
        />,
        filterSlot,
      )}
      <Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }} ref={wrapperRef}>
        <StatsBar items={filteredItems} milestones={milestones} view={view} colorblindMode={colorblindMode} />

        {noFilteredItems && (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No items match the current filters.
          </Typography>
        )}
        {!noFilteredItems && view === "Burndown" && (
          <BurndownChart items={filteredItems} milestones={milestones} highlightWeekends={highlightWeekends} bankHolidays={bankHolidays} colorblindMode={colorblindMode} includePRs={includePRs.burndown} />
        )}
        {!noFilteredItems && view === "Cycle Time" && (
          <CycleTimeChart items={filteredItems} milestones={milestones} highlightWeekends={highlightWeekends} bankHolidays={bankHolidays} colorblindMode={colorblindMode} includePRs={includePRs.cycleTime} showPercentiles={showPercentiles} />
        )}
        {!noFilteredItems && view === "Velocity" && (
          <VelocityChart items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} includePRs={includePRs.velocity} />
        )}
        {!noFilteredItems && view === "Cumulative Flow" && (
          <CumulativeFlowChart items={filteredItems} highlightWeekends={highlightWeekends} bankHolidays={bankHolidays} colorblindMode={colorblindMode} includePRs={includePRs.cumulativeFlow} />
        )}
        {!noFilteredItems && view === "Contributors" && <ContributorsChart items={filteredItems} colorblindMode={colorblindMode} />}
        {!noFilteredItems && view === "Review Wait" && <ReviewWaitList items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} />}
        {!noFilteredItems && view === "List" && <ItemList items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} />}

        {!noFilteredItems && view === "Gantt" && (
          <GanttView
            ref={ganttRef}
            items={items}
            filteredItems={filteredItems}
            milestones={milestones}
            highlightWeekends={highlightWeekends}
            bankHolidays={bankHolidays}
            colorblindMode={colorblindMode}
          />
        )}
      </Paper>
    </>
  );
};

export { MilestoneView };
