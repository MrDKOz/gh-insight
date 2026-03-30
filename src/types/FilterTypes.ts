import type { TimelineItem } from "./GitHubTypes";
import { itemEndDate } from "../utils/displayUtils";

type PeopleRole = "author" | "assignees" | "either";

type Filters = {
  createdStart: string;
  createdEnd: string;
  closedStart: string;
  closedEnd: string;
  showOpenIssues: boolean;
  showClosedIssues: boolean;
  showOpenPRs: boolean;
  showMergedPRs: boolean;
  showClosedPRs: boolean;
  activeLabels: string[];  // label names; empty = all
  activePeople: string[];  // logins; empty = all
  peopleRole: PeopleRole;  // which role(s) to match against
};

const DEFAULT_FILTERS: Filters = {
  createdStart: "",
  createdEnd: "",
  closedStart: "",
  closedEnd: "",
  showOpenIssues: true,
  showClosedIssues: true,
  showOpenPRs: true,
  showMergedPRs: true,
  showClosedPRs: true,
  activeLabels: [],
  activePeople: [],
  peopleRole: "either",
};

const applyFilters = (items: TimelineItem[], filters: Filters): TimelineItem[] =>
  items.filter((item) => {
    if (filters.createdStart && item.createdAt.slice(0, 10) < filters.createdStart) {return false;}
    if (filters.createdEnd && item.createdAt.slice(0, 10) > filters.createdEnd) {return false;}

    const end = itemEndDate(item);
    if (filters.closedStart || filters.closedEnd) {
      if (!end) {return false;} // open items have no close date — exclude when filtering by closed
      if (filters.closedStart && end.slice(0, 10) < filters.closedStart) {return false;}
      if (filters.closedEnd && end.slice(0, 10) > filters.closedEnd) {return false;}
    }

    if (item.type === "issue") {
      if (!item.closedAt && !filters.showOpenIssues) {return false;}
      if (item.closedAt && !filters.showClosedIssues) {return false;}
    } else {
      const isMerged = !!item.mergedAt;
      const isClosed = !item.mergedAt && !!item.closedAt;
      const isOpen   = !item.mergedAt && !item.closedAt;
      if (isOpen   && !filters.showOpenPRs)   {return false;}
      if (isMerged && !filters.showMergedPRs) {return false;}
      if (isClosed && !filters.showClosedPRs) {return false;}
    }

    if (filters.activeLabels.length > 0) {
      const itemLabels = new Set(item.labels.map((l) => l.name));
      if (!filters.activeLabels.some((l) => itemLabels.has(l))) {return false;}
    }

    if (filters.activePeople.length > 0) {
      const matchAuthor    = filters.peopleRole === "author"    || filters.peopleRole === "either";
      const matchAssignees = filters.peopleRole === "assignees" || filters.peopleRole === "either";
      const itemAssignees  = new Set(item.assignees);
      const passes =
        (matchAuthor    && filters.activePeople.includes(item.author)) ||
        (matchAssignees && filters.activePeople.some((p) => itemAssignees.has(p)));
      if (!passes) {return false;}
    }

    return true;
  });

export { DEFAULT_FILTERS, applyFilters };
export type { Filters, PeopleRole };
