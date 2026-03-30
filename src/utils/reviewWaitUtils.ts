import type { TimelineItem } from "../types/GitHubTypes";
import { MS_PER_DAY } from "./dateUtils";
import { itemStatus } from "./displayUtils";

type SortCol = "number" | "title" | "author" | "status" | "created" | "firstReview" | "wait" | "total";
type SortDir = "asc" | "desc";

type PRRow = {
  number: number;
  title: string;
  url: string;
  author: string;
  assignees: string[];
  labels: { name: string; color: string }[];
  status: "Open" | "Merged" | "Closed";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  firstReviewAt: string | null;
  /** Days from creation to first review, or null if no review yet */
  reviewWaitDays: number | null;
  /** Days from creation to merge/close, or null if still open */
  totalDays: number | null;
  milestoneNumber: number;
};

const toDays = (ms: number): number => Math.round(ms / MS_PER_DAY);

const buildRows = (items: TimelineItem[]): PRRow[] => items
    .filter((i): i is Extract<TimelineItem, { type: "pr" }> => i.type === "pr")
    .map((pr) => {
      const createdMs = new Date(pr.createdAt).getTime();
      const endMs = pr.mergedAt
        ? new Date(pr.mergedAt).getTime()
        : pr.closedAt
          ? new Date(pr.closedAt).getTime()
          : null;
      const reviewMs = pr.firstReviewAt ? new Date(pr.firstReviewAt).getTime() : null;

      return {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        author: pr.author,
        assignees: pr.assignees,
        labels: pr.labels,
        status: itemStatus(pr),
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
        closedAt: pr.closedAt,
        firstReviewAt: pr.firstReviewAt,
        reviewWaitDays: reviewMs !== null ? Math.max(0, toDays(reviewMs - createdMs)) : null,
        totalDays: endMs !== null ? Math.max(0, toDays(endMs - createdMs)) : null,
        milestoneNumber: pr.milestoneNumber,
      };
    });

const sortRows = (rows: PRRow[], col: SortCol, dir: SortDir): PRRow[] => {
  const asc = dir === "asc";
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "number":   cmp = a.number - b.number; break;
      case "title":    cmp = a.title.localeCompare(b.title); break;
      case "author":   cmp = a.author.localeCompare(b.author); break;
      case "status":   cmp = a.status.localeCompare(b.status); break;
      case "created":  cmp = a.createdAt.localeCompare(b.createdAt); break;
      case "firstReview":
        // Nulls always last regardless of direction
        if (a.firstReviewAt === null && b.firstReviewAt === null) {cmp = 0;}
        else if (a.firstReviewAt === null) {return 1;}
        else if (b.firstReviewAt === null) {return -1;}
        else {cmp = a.firstReviewAt.localeCompare(b.firstReviewAt);}
        break;
      case "wait":
        if (a.reviewWaitDays === null && b.reviewWaitDays === null) {cmp = 0;}
        else if (a.reviewWaitDays === null) {return 1;}
        else if (b.reviewWaitDays === null) {return -1;}
        else {cmp = a.reviewWaitDays - b.reviewWaitDays;}
        break;
      case "total":
        if (a.totalDays === null && b.totalDays === null) {cmp = 0;}
        else if (a.totalDays === null) {return 1;}
        else if (b.totalDays === null) {return -1;}
        else {cmp = a.totalDays - b.totalDays;}
        break;
    }
    return asc ? cmp : -cmp;
  });
};

export { buildRows, sortRows };
export type { PRRow, SortCol, SortDir };
