import { fetchMilestoneItems, fetchMilestones } from "../githubApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = (responses: Array<{ ok: boolean; status?: number; body: unknown }>) => {
  let call = 0;
  return vi.fn((): Promise<Response> => {
    // index is clamped to [0, responses.length-1], so always in bounds
    const resp = responses[Math.min(call++, responses.length - 1)]!;
    return Promise.resolve({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 500),
      json: () => Promise.resolve(resp.body),
    } as Response);
  });
};

const RAW_MILESTONE = {
  number: 1,
  title: "Sprint 1",
  state: "open",
  open_issues: 2,
  closed_issues: 8,
  due_on: null,
};

const GQL_PR_NODE = {
  number: 10,
  title: "Fix the bug (PR)",
  url: "https://github.com/owner/repo/pull/10",
  author: { login: "a-jones" },
  createdAt: "2025-01-15T09:00:00Z",
  mergedAt: "2025-01-20T10:00:00Z",
  closedAt: "2025-01-20T10:00:00Z",
  labels: { nodes: [] },
  assignees: { nodes: [] },
  reviews: { nodes: [] },
};

const GQL_ISSUE_NODE = {
  number: 42,
  title: "Fix the bug",
  url: "https://github.com/owner/repo/issues/42",
  author: { login: "jsmith" },
  createdAt: "2025-01-10T09:00:00Z",
  closedAt: "2025-01-20T10:00:00Z",
  labels: { nodes: [] },
  assignees: { nodes: [] },
  timelineItems: { totalCount: 0 },
  closedByPullRequestsReferences: { nodes: [] },
};

/** Builds a mock response for the MILESTONE_QUERY (issues). */
const gqlSuccess = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) => ({
  ok: true,
  body: {
    data: {
      repository: {
        milestone: {
          issues: {
            pageInfo: { hasNextPage, endCursor },
            nodes,
          },
        },
      },
    },
  },
});

/** Builds a mock response for the MILESTONE_PRS_QUERY (pullRequests). */
const gqlPRsSuccess = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) => ({
  ok: true,
  body: {
    data: {
      repository: {
        milestone: {
          pullRequests: {
            pageInfo: { hasNextPage, endCursor },
            nodes,
          },
        },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// fetchMilestones
// ---------------------------------------------------------------------------

describe("fetchMilestones", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns mapped milestones from a single page", async () => {
    vi.stubGlobal("fetch", mockFetch([{ ok: true, body: [RAW_MILESTONE] }]));
    const result = await fetchMilestones("owner", "repo", "token");

    expect(result).toHaveLength(1);
    expect(result[0]!).toEqual({
      number: 1,
      title: "Sprint 1",
      state: "open",
      openIssues: 2,
      closedIssues: 8,
      dueOn: null,
    });
  });

  it("paginates until data.length < 100", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ ...RAW_MILESTONE, number: i + 1, title: `MS ${i + 1}` }));
    const page2 = [RAW_MILESTONE];
    vi.stubGlobal("fetch", mockFetch([
      { ok: true, body: page1 },
      { ok: true, body: page2 },
    ]));
    const result = await fetchMilestones("owner", "repo", "token");

    expect(result).toHaveLength(101);
  });

  it("sorts milestones alphabetically by title", async () => {
    const raw = [
      { ...RAW_MILESTONE, number: 2, title: "Sprint 2" },
      { ...RAW_MILESTONE, number: 1, title: "Alpha" },
    ];
    vi.stubGlobal("fetch", mockFetch([{ ok: true, body: raw }]));
    const result = await fetchMilestones("owner", "repo", "token");

    expect(result[0]!.title).toBe("Alpha");
    expect(result[1]!.title).toBe("Sprint 2");
  });

  it("returns empty array when repo has no milestones", async () => {
    vi.stubGlobal("fetch", mockFetch([{ ok: true, body: [] }]));
    const result = await fetchMilestones("owner", "repo", "token");

    expect(result).toEqual([]);
  });

  it("throws a descriptive error on 401", async () => {
    vi.stubGlobal("fetch", mockFetch([{ ok: false, status: 401, body: { message: "Bad credentials" } }]));

    await expect(fetchMilestones("owner", "repo", "bad-token")).rejects.toThrow(/401/);
    await expect(fetchMilestones("owner", "repo", "bad-token")).rejects.toThrow(/Bad credentials/);
  });

  it("throws a descriptive error on 404", async () => {
    vi.stubGlobal("fetch", mockFetch([{ ok: false, status: 404, body: { message: "Not Found" } }]));

    await expect(fetchMilestones("owner", "repo", "token")).rejects.toThrow(/404/);
    await expect(fetchMilestones("owner", "repo", "token")).rejects.toThrow(/Not Found/);
  });

  it("throws a generic error on other non-ok status", async () => {
    vi.stubGlobal("fetch", mockFetch([{ ok: false, status: 500, body: {} }]));

    await expect(fetchMilestones("owner", "repo", "token")).rejects.toThrow(/500/);
  });

  it("resolves without throwing when the AbortController aborts", async () => {
    const ac = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url: string, opts: { signal?: AbortSignal }): Promise<Response> => {
      // Simulate fetch respecting abort by throwing DOMException
      if (opts.signal?.aborted) {return Promise.reject(new DOMException("Aborted", "AbortError"));}
      ac.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }));

    // Should not throw — caller is responsible for ignoring AbortError
    await expect(
      fetchMilestones("owner", "repo", "token", ac.signal).catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") {return "aborted";}
        throw e;
      })
    ).resolves.toBe("aborted");
  });
});

// ---------------------------------------------------------------------------
// fetchMilestoneItems
// ---------------------------------------------------------------------------

describe("fetchMilestoneItems", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a mapped issue and linked PR", async () => {
    const issueWithPR = {
      ...GQL_ISSUE_NODE,
      closedByPullRequestsReferences: { nodes: [GQL_PR_NODE] },
    };
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([issueWithPR]), gqlPRsSuccess([])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);

    const issue = items.find((i) => i.type === "issue")!;
    const pr    = items.find((i) => i.type === "pr")!;

    expect(issue.number).toBe(42);
    expect(issue.author).toBe("jsmith");
    expect(issue.linkedPRs).toEqual([10]);

    expect(pr.number).toBe(10);
    expect(pr.author).toBe("a-jones");

    if (pr.type === "pr") {expect(pr.linkedIssue).toBe(42);}
  });

  it("deduplicates PRs referenced by multiple issues", async () => {
    const issue1 = { ...GQL_ISSUE_NODE, number: 1, closedByPullRequestsReferences: { nodes: [GQL_PR_NODE] } };
    const issue2 = { ...GQL_ISSUE_NODE, number: 2, closedByPullRequestsReferences: { nodes: [GQL_PR_NODE] } };
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([issue1, issue2]), gqlPRsSuccess([])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);
    const prs = items.filter((i) => i.type === "pr");

    expect(prs).toHaveLength(1);
  });

  it("maps null author to 'ghost'", async () => {
    const noAuthorIssue = { ...GQL_ISSUE_NODE, author: null };
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([noAuthorIssue]), gqlPRsSuccess([])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);
    const issue = items.find((i) => i.type === "issue")!;

    expect(issue.author).toBe("ghost");
  });

  it("returns empty array when milestone has no issues", async () => {
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([]), gqlPRsSuccess([])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);

    expect(items).toEqual([]);
  });

  it("throws when milestone is not found in repository", async () => {
    vi.stubGlobal("fetch", mockFetch([{
      ok: true,
      body: { data: { repository: { milestone: null } } },
    }]));

    await expect(fetchMilestoneItems("owner", "repo", "token", 999)).rejects.toThrow(/Milestone not found/);
  });

  it("throws on a GraphQL error response", async () => {
    vi.stubGlobal("fetch", mockFetch([{
      ok: true,
      body: { errors: [{ message: "Field 'foo' doesn't exist on type 'Issue'" }] },
    }]));

    await expect(fetchMilestoneItems("owner", "repo", "token", 1)).rejects.toThrow(/Field 'foo'/);
  });

  it("throws when GraphQL response has no data field and no errors", async () => {
    vi.stubGlobal("fetch", mockFetch([{ ok: true, body: {} }]));

    await expect(fetchMilestoneItems("owner", "repo", "token", 1)).rejects.toThrow(/no data/i);
  });

  it("throws when GraphQL response has data: null", async () => {
    vi.stubGlobal("fetch", mockFetch([{ ok: true, body: { data: null } }]));

    await expect(fetchMilestoneItems("owner", "repo", "token", 1)).rejects.toThrow(/no data/i);
  });

  it("paginates when hasNextPage is true", async () => {
    const issue1 = { ...GQL_ISSUE_NODE, number: 1, closedByPullRequestsReferences: { nodes: [] } };
    const issue2 = { ...GQL_ISSUE_NODE, number: 2, closedByPullRequestsReferences: { nodes: [] } };
    vi.stubGlobal("fetch", mockFetch([
      gqlSuccess([issue1], true, "cursor_abc"),
      gqlSuccess([issue2], false, null),
      gqlPRsSuccess([]),
    ]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);

    expect(items.filter((i) => i.type === "issue")).toHaveLength(2);
  });

  it("correctly maps an open issue (closedAt: null)", async () => {
    const openIssue = { ...GQL_ISSUE_NODE, closedAt: null, closedByPullRequestsReferences: { nodes: [] } };
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([openIssue]), gqlPRsSuccess([])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);
    const issue = items.find((i) => i.type === "issue")!;

    expect(issue.closedAt).toBeNull();
  });

  it("includes standalone milestone PRs not linked to any issue", async () => {
    const standalonePR = { ...GQL_PR_NODE, number: 99, title: "Standalone PR" };
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([GQL_ISSUE_NODE]), gqlPRsSuccess([standalonePR])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);
    const pr = items.find((i) => i.type === "pr" && i.number === 99);

    expect(pr).toBeDefined();

    if (pr?.type === "pr") {expect(pr.linkedIssue).toBeNull();}
  });

  it("maps labels correctly", async () => {
    const issueWithLabels = {
      ...GQL_ISSUE_NODE,
      labels: { nodes: [{ name: "bug", color: "d73a4a" }] },
    };
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([issueWithLabels]), gqlPRsSuccess([])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);
    const issue = items.find((i) => i.type === "issue")!;

    expect(issue.labels).toEqual([{ name: "bug", color: "#d73a4a" }]);
  });

  it("maps firstReviewAt from the first review node", async () => {
    const issueWithPRAndReview = {
      ...GQL_ISSUE_NODE,
      closedByPullRequestsReferences: {
        nodes: [{
          ...GQL_PR_NODE,
          reviews: { nodes: [{ submittedAt: "2025-01-17T12:00:00Z" }] },
        }],
      },
    };
    vi.stubGlobal("fetch", mockFetch([gqlSuccess([issueWithPRAndReview]), gqlPRsSuccess([])]));
    const items = await fetchMilestoneItems("owner", "repo", "token", 1);
    const pr = items.find((i) => i.type === "pr")!;
    if (pr.type === "pr") {expect(pr.firstReviewAt).toBe("2025-01-17T12:00:00Z");}
  });
});

