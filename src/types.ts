export interface Milestone {
  number: number;
  title: string;
  state: 'open' | 'closed';
  open_issues: number;
  closed_issues: number;
}

export interface PRItem {
  type: 'pr';
  number: number;
  title: string;
  url: string;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  linkedIssue: number;
  milestoneNumber: number;
}

export interface IssueItem {
  type: 'issue';
  number: number;
  title: string;
  url: string;
  createdAt: string;
  closedAt: string | null;
  linkedPRs: number[];
  milestoneNumber: number;
}

export type TimelineItem = IssueItem | PRItem;

export interface MilestoneMeta {
  number: number;
  title:  string;
  color:  string;
}
