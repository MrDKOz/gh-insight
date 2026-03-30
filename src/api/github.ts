import type { Label, Milestone, Repo, TimelineItem, UserProfile } from "../types/GitHubTypes";
import * as t from "io-ts";
import { decodeOrThrow, decodeSafe } from "../utils/iotsUtils";

const GH_API = "https://api.github.com";
const GH_GRAPHQL = "https://api.github.com/graphql";

const RawMilestoneCodec = t.type({
  number:        t.number,
  title:         t.string,
  state:         t.union([t.literal("open"), t.literal("closed")]),
  open_issues:   t.number,
  closed_issues: t.number,
  due_on:        t.union([t.string, t.null]),
});

type RawMilestone = t.TypeOf<typeof RawMilestoneCodec>;

const mapMilestone = (raw: RawMilestone): Milestone => ({
  number: raw.number,
  title: raw.title,
  state: raw.state,
  openIssues: raw.open_issues,
  closedIssues: raw.closed_issues,
  dueOn: raw.due_on ?? null,
});

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

const GHErrorBodyCodec = t.partial({ message: t.string });

const checkResponse = async (response: Response): Promise<void> => {
  if (!response.ok) {
    let ghMessage = "";
    try {
      const body = decodeSafe(await response.json() as unknown, GHErrorBodyCodec);
      if (body?.message) {ghMessage = body.message;}
    } catch {
      // ignore
    }

    if (response.status === 401) {
      throw new Error(
        `Authentication failed (401) — check that your token is valid and not expired.${ghMessage ? ` GitHub: ${ghMessage}` : ""}`,
      );
    }
    if (response.status === 404) {
      throw new Error(
        "Repository not found (404) — verify the owner/repo names are correct. " +
          "For private repos, ensure your token has the \"repo\" scope (classic) or \"Contents: Read\" permission (fine-grained)." +
          `${ghMessage ? ` GitHub: ${ghMessage}` : ""}`,
      );
    }
    throw new Error(`GitHub API error ${response.status}${ghMessage ? `: ${ghMessage}` : ""}`);
  }
};

const fetchMilestones = async (owner: string, repo: string, token: string, signal?: AbortSignal): Promise<Milestone[]> => {
  const results: Milestone[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones?state=all&per_page=100&page=${page}`,
      { headers: authHeaders(token), signal: signal ?? null },
    );
    await checkResponse(response);
    const data = decodeOrThrow(await response.json() as unknown, t.array(RawMilestoneCodec));
    results.push(...data.map(mapMilestone));
    if (data.length < 100) {break;}
    page++;
  }

  return results.sort((a, b) => a.title.localeCompare(b.title));
};

// Fragment for label + assignee fields shared across issue/PR nodes
const LABEL_ASSIGNEE_FIELDS = `
  labels(first: 20) {
    nodes { name color }
  }
  assignees(first: 10) {
    nodes { login }
  }
`;

const MILESTONE_QUERY = `
  query MilestoneData($owner: String!, $repo: String!, $milestoneNumber: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      milestone(number: $milestoneNumber) {
        issues(first: 100, after: $after, states: [OPEN, CLOSED]) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            author { login }
            createdAt
            updatedAt
            closedAt
            ${LABEL_ASSIGNEE_FIELDS}
            timelineItems(first: 1, itemTypes: [REOPENED_EVENT]) {
              totalCount
            }
            closedByPullRequestsReferences(first: 20, includeClosedPrs: true) {
              nodes {
                number
                title
                url
                author { login }
                createdAt
                updatedAt
                mergedAt
                closedAt
                isDraft
                reviewDecision
                additions
                deletions
                ${LABEL_ASSIGNEE_FIELDS}
                reviews(first: 1, states: [APPROVED, CHANGES_REQUESTED, COMMENTED]) {
                  nodes { submittedAt }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Fetches PRs directly attached to the milestone (not just via closedByPullRequestsReferences)
const MILESTONE_PRS_QUERY = `
  query MilestonePRs($owner: String!, $repo: String!, $milestoneNumber: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      milestone(number: $milestoneNumber) {
        pullRequests(first: 100, after: $after, states: [OPEN, CLOSED, MERGED]) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            author { login }
            createdAt
            updatedAt
            mergedAt
            closedAt
            isDraft
            reviewDecision
            additions
            deletions
            ${LABEL_ASSIGNEE_FIELDS}
            reviews(first: 1, states: [APPROVED, CHANGES_REQUESTED, COMMENTED]) {
              nodes { submittedAt }
            }
          }
        }
      }
    }
  }
`;

type GQLLabelNode = { name: string; color: string };
type GQLUserNode  = { login: string };

type GQLPRNode = {
  number: number;
  title: string;
  url: string;
  author: { login: string } | null;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  isDraft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  additions: number;
  deletions: number;
  labels: { nodes: GQLLabelNode[] };
  assignees: { nodes: GQLUserNode[] };
  reviews: { nodes: Array<{ submittedAt: string }> };
};

type GQLIssueNode = {
  number: number;
  title: string;
  url: string;
  author: { login: string } | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  labels: { nodes: GQLLabelNode[] };
  assignees: { nodes: GQLUserNode[] };
  timelineItems: { totalCount: number };
  closedByPullRequestsReferences: {
    nodes: GQLPRNode[];
  };
};


// Explicit response data shapes for gqlFetch<T> to avoid TS7022 circular inference
type IssuePageData = {
  repository?: {
    milestone?: {
      issues: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: GQLIssueNode[];
      };
    } | null;
  } | null;
};

type PRPageData = {
  repository?: {
    milestone?: {
      pullRequests: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: GQLPRNode[];
      };
    } | null;
  } | null;
};

const HEX_COLOR_RE = /^[0-9a-f]{6}$/i;

const mapLabels = (nodes: GQLLabelNode[]): Label[] =>
  nodes.map((n) => ({
    name: n.name,
    // GitHub returns a bare 6-char hex string; validate before prefixing so
    // malformed API values don't silently break CSS or labelTextColor().
    color: HEX_COLOR_RE.test(n.color) ? `#${n.color}` : "#cccccc",
  }));

const GQLEnvelopeCodec = t.partial({
  data:   t.unknown,
  errors: t.array(t.type({ message: t.string })),
});

const gqlFetch = async <T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  signal?: AbortSignal,
): Promise<T> => {
  const response = await fetch(GH_GRAPHQL, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: signal ?? null,
  });
  await checkResponse(response);
  const envelope = decodeOrThrow(await response.json() as unknown, GQLEnvelopeCodec);
  if (envelope.errors && envelope.errors.length > 0) {throw new Error(envelope.errors[0]?.message ?? "GraphQL error");}
  if (envelope.data == null) {throw new Error("GraphQL response contained no data");}
  return envelope.data as T;
};

const fetchMilestoneItems = async (
  owner: string,
  repo: string,
  token: string,
  milestoneNumber: number,
  signal?: AbortSignal,
): Promise<TimelineItem[]> => {
  // ── Fetch issues (+ PRs via closedByPullRequestsReferences) ────────────────
  const allIssues: GQLIssueNode[] = [];
  let after: string | null = null;

  while (true) {
    const data: IssuePageData = await gqlFetch<IssuePageData>(
      MILESTONE_QUERY,
      { owner, repo, milestoneNumber, after },
      token,
      signal,
    );

    const milestone = data?.repository?.milestone;
    if (!milestone) {throw new Error("Milestone not found in repository");}

    const { nodes, pageInfo } = milestone.issues;
    allIssues.push(...nodes);
    if (!pageInfo.hasNextPage) {break;}
    after = pageInfo.endCursor;
  }

  // ── Fetch PRs directly assigned to the milestone ────────────────────────────
  const allMilestonePRs: GQLPRNode[] = [];
  let prAfter: string | null = null;

  while (true) {
    const data: PRPageData = await gqlFetch<PRPageData>(
      MILESTONE_PRS_QUERY,
      { owner, repo, milestoneNumber, after: prAfter },
      token,
      signal,
    );

    const milestone = data?.repository?.milestone;
    if (!milestone) {break;} // graceful — some GH plans restrict this

    const { nodes, pageInfo } = milestone.pullRequests;
    allMilestonePRs.push(...nodes);
    if (!pageInfo.hasNextPage) {break;}
    prAfter = pageInfo.endCursor;
  }

  // Index milestone PRs by number for O(1) lookup
  const milestonePRMap = new Map<number, GQLPRNode>(allMilestonePRs.map((pr) => [pr.number, pr]));

  // ── Build TimelineItem list ──────────────────────────────────────────────────
  const items: TimelineItem[] = [];
  const seenPRs = new Set<number>();

  for (const issue of allIssues) {
    const linkedPRNums: number[] = [];

    for (const refPR of issue.closedByPullRequestsReferences.nodes) {
      linkedPRNums.push(refPR.number);
      if (!seenPRs.has(refPR.number)) {
        seenPRs.add(refPR.number);
        // Prefer milestone PR node (has full data); fall back to the reference node
        const pr = milestonePRMap.get(refPR.number) ?? refPR;
        items.push({
          type: "pr",
          number: pr.number,
          title: pr.title,
          url: pr.url,
          author: pr.author?.login ?? "ghost",
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt,
          mergedAt: pr.mergedAt,
          closedAt: pr.closedAt,
          isDraft: pr.isDraft,
          reviewDecision: pr.reviewDecision ?? null,
          additions: pr.additions,
          deletions: pr.deletions,
          linkedIssue: issue.number > 0 ? issue.number : null,
          milestoneNumber,
          labels: mapLabels(pr.labels.nodes),
          assignees: pr.assignees.nodes.map((n) => n.login),
          firstReviewAt: pr.reviews.nodes[0]?.submittedAt ?? null,
        });
      }
    }

    items.push({
      type: "issue",
      number: issue.number,
      title: issue.title,
      url: issue.url,
      author: issue.author?.login ?? "ghost",
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      closedAt: issue.closedAt,
      linkedPRs: linkedPRNums,
      milestoneNumber,
      labels: mapLabels(issue.labels.nodes),
      assignees: issue.assignees.nodes.map((n) => n.login),
      reopenedCount: issue.timelineItems.totalCount,
    });
  }

  // Add any milestone PRs that weren't already picked up via issue references
  for (const pr of allMilestonePRs) {
    if (!seenPRs.has(pr.number)) {
      seenPRs.add(pr.number);
      items.push({
        type: "pr",
        number: pr.number,
        title: pr.title,
        url: pr.url,
        author: pr.author?.login ?? "ghost",
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        mergedAt: pr.mergedAt,
        closedAt: pr.closedAt,
        isDraft: pr.isDraft,
        reviewDecision: pr.reviewDecision ?? null,
        additions: pr.additions,
        deletions: pr.deletions,
        linkedIssue: null,
        milestoneNumber,
        labels: mapLabels(pr.labels.nodes),
        assignees: pr.assignees.nodes.map((n) => n.login),
        firstReviewAt: pr.reviews.nodes[0]?.submittedAt ?? null,
      });
    }
  }

  return items;
};

const UserProfileResponseCodec = t.type({
  login:      t.string,
  name:       t.union([t.string, t.null]),
  avatar_url: t.string,
});

const fetchUserProfile = async (token: string): Promise<UserProfile> => {
  const response = await fetch(`${GH_API}/user`, { headers: authHeaders(token) });
  await checkResponse(response);
  const data = decodeOrThrow(await response.json() as unknown, UserProfileResponseCodec);
  return { login: data.login, name: data.name, avatarUrl: data.avatar_url };
};

const RawRepoCodec = t.type({
  id:          t.number,
  owner:       t.type({ login: t.string }),
  name:        t.string,
  full_name:   t.string,
  private:     t.boolean,
  description: t.union([t.string, t.null]),
});

const fetchUserRepos = async (token: string, signal?: AbortSignal): Promise<Repo[]> => {
  const results: Repo[] = [];
  let page = 1;
  while (true) {
    const response = await fetch(
      `${GH_API}/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      { headers: authHeaders(token), signal: signal ?? null },
    );
    await checkResponse(response);
    const data = decodeOrThrow(await response.json() as unknown, t.array(RawRepoCodec));
    results.push(...data.map((r) => ({
      id: r.id,
      owner: r.owner.login,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      description: r.description,
    })));
    if (data.length < 100) { break; }
    page++;
  }
  return results;
};

export { fetchMilestoneItems, fetchMilestones, fetchUserProfile, fetchUserRepos };
