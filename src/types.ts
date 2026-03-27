type Milestone = {
  number: number;
  title: string;
  state: "open" | "closed";
  openIssues: number;
  closedIssues: number;
};

type Label = {
  name: string;
  color: string; // includes leading #
};

type PRItem = {
  type: "pr";
  number: number;
  title: string;
  url: string;
  author: string;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  linkedIssue: number | null;
  milestoneNumber: number;
  labels: Label[];
  assignees: string[];
  firstReviewAt: string | null;
};

type IssueItem = {
  type: "issue";
  number: number;
  title: string;
  url: string;
  author: string;
  createdAt: string;
  closedAt: string | null;
  linkedPRs: number[];
  milestoneNumber: number;
  labels: Label[];
  assignees: string[];
  reopenedCount: number;
};

type TimelineItem = IssueItem | PRItem;

type MilestoneMeta = {
  number: number;
  title: string;
  color: string;
};

export type { IssueItem, Label, Milestone, MilestoneMeta, PRItem, TimelineItem };
