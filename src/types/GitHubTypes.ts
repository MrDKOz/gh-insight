type Milestone = {
  number: number;
  title: string;
  state: "open" | "closed";
  openIssues: number;
  closedIssues: number;
  dueOn: string | null;
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
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  isDraft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  additions: number;
  deletions: number;
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
  updatedAt: string;
  closedAt: string | null;
  linkedPRs: number[];
  milestoneNumber: number;
  labels: Label[];
  assignees: string[];
  reopenedCount: number;
};

type TimelineItem = IssueItem | PRItem;

type Epic = {
  /** Issue number — reused as `milestoneNumber` on sub-issue items for chart colouring. */
  number: number;
  title: string;
  state: "open" | "closed";
  subIssueCount: number;
  url: string;
};

type MilestoneMeta = {
  number: number;
  title: string;
  color: string;
  dueOn: string | null;
};

type Repo = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
};

type UserProfile = {
  login: string;
  name: string | null;
  avatarUrl: string;
};

export type { Epic, IssueItem, Label, Milestone, MilestoneMeta, PRItem, Repo, TimelineItem, UserProfile };
