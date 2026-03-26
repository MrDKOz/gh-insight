import type { Milestone, TimelineItem } from "../types";

const GH_API = "https://api.github.com";
const GH_GRAPHQL = "https://api.github.com/graphql";

type RawMilestone = {
  number: number;
  title: string;
  state: "open" | "closed";
  open_issues: number;
  closed_issues: number;
};

function mapMilestone(raw: RawMilestone): Milestone {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    openIssues: raw.open_issues,
    closedIssues: raw.closed_issues,
  };
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

async function checkResponse(res: Response): Promise<void> {
  if (!res.ok) {
    let ghMessage = "";
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) ghMessage = body.message;
    } catch {
      // ignore
    }

    if (res.status === 401) {
      throw new Error(
        `Authentication failed (401) — check that your token is valid and not expired.${ghMessage ? ` GitHub: ${ghMessage}` : ""}`,
      );
    }
    if (res.status === 404) {
      throw new Error(
        `Repository not found (404) — verify the owner/repo names are correct. ` +
          `For private repos, ensure your token has the "repo" scope (classic) or "Contents: Read" permission (fine-grained).` +
          `${ghMessage ? ` GitHub: ${ghMessage}` : ""}`,
      );
    }
    throw new Error(`GitHub API error ${res.status}${ghMessage ? `: ${ghMessage}` : ""}`);
  }
}

async function fetchMilestones(owner: string, repo: string, token: string): Promise<Milestone[]> {
  const results: Milestone[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones?state=all&per_page=100&page=${page}`,
      { headers: authHeaders(token) },
    );
    await checkResponse(res);
    const data = (await res.json()) as RawMilestone[];
    results.push(...data.map(mapMilestone));
    if (data.length < 100) break;
    page++;
  }

  return results.sort((a, b) => a.title.localeCompare(b.title));
}

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
            closedAt
            closedByPullRequestsReferences(first: 20, includeClosedPrs: true) {
              nodes {
                number
                title
                url
                author { login }
                createdAt
                mergedAt
                closedAt
              }
            }
          }
        }
      }
    }
  }
`;

type GQLIssueNode = {
  number: number;
  title: string;
  url: string;
  author: { login: string } | null;
  createdAt: string;
  closedAt: string | null;
  closedByPullRequestsReferences: {
    nodes: Array<{
      number: number;
      title: string;
      url: string;
      author: { login: string } | null;
      createdAt: string;
      mergedAt: string | null;
      closedAt: string | null;
    }>;
  };
};

type GQLResponse = {
  data?: {
    repository?: {
      milestone?: {
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: GQLIssueNode[];
        };
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

async function fetchMilestoneItems(
  owner: string,
  repo: string,
  token: string,
  milestoneNumber: number,
): Promise<TimelineItem[]> {
  const allIssues: GQLIssueNode[] = [];
  let after: string | null = null;

  while (true) {
    const res = await fetch(GH_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: MILESTONE_QUERY,
        variables: { owner, repo, milestoneNumber, after },
      }),
    });

    await checkResponse(res);
    const json = (await res.json()) as GQLResponse;

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message);
    }

    const milestone = json.data?.repository?.milestone;
    if (!milestone) {
      throw new Error("Milestone not found in repository");
    }

    const { nodes, pageInfo } = milestone.issues;
    allIssues.push(...nodes);

    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  const items: TimelineItem[] = [];
  const seenPRs = new Set<number>();

  for (const issue of allIssues) {
    const linkedPRNums: number[] = [];

    for (const pr of issue.closedByPullRequestsReferences.nodes) {
      linkedPRNums.push(pr.number);
      if (!seenPRs.has(pr.number)) {
        seenPRs.add(pr.number);
        items.push({
          type: "pr",
          number: pr.number,
          title: pr.title,
          url: pr.url,
          author: pr.author?.login ?? "ghost",
          createdAt: pr.createdAt,
          mergedAt: pr.mergedAt,
          closedAt: pr.closedAt,
          linkedIssue: issue.number,
          milestoneNumber,
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
      closedAt: issue.closedAt,
      linkedPRs: linkedPRNums,
      milestoneNumber,
    });
  }

  return items;
}

export { fetchMilestones, fetchMilestoneItems };
