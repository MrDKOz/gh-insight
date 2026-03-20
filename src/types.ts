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
}

export interface IssueItem {
  type: 'issue';
  number: number;
  title: string;
  url: string;
  createdAt: string;
  closedAt: string | null;
  linkedPRs: number[];
}

export type TimelineItem = IssueItem | PRItem;
