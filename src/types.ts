type Milestone = {
  number: number;
  title: string;
  state: "open" | "closed";
  openIssues: number;
  closedIssues: number;
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
  linkedIssue: number;
  milestoneNumber: number;
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
};

type TimelineItem = IssueItem | PRItem;

type MilestoneMeta = {
  number: number;
  title: string;
  color: string;
};

export type { Milestone, PRItem, IssueItem, TimelineItem, MilestoneMeta };
