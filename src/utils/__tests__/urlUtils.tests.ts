import type { Repo } from "../../types/GitHubTypes";
import { DEFAULT_VIEW } from "../../types/AppTypes";
import { DEFAULT_FILTERS } from "../../types/FilterTypes";
import { decodeShareCode, encodeShareCode, readUrlParams, readViewFiltersFromUrl, setViewParam, syncFiltersToUrl, syncUrlParams } from "../urlUtils";

const setSearch = (search: string) => {
  Object.defineProperty(window, "location", {
    writable: true,
    configurable: true,
    value: { search, pathname: "/" },
  });
};

const parsedUrl = (spy: ReturnType<typeof vi.spyOn>) => {
  const raw = spy.mock.calls[0]?.[2] as string;
  const qs = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw;
  return new URLSearchParams(qs);
};

const REPO: Repo = { id: 1, owner: "acme", name: "frontend", fullName: "acme/frontend", private: false, description: null };

// ── readUrlParams ──────────────────────────────────────────────────────────────

describe("readUrlParams", () => {
  afterEach(() => setSearch(""));

  it("returns empty defaults for an empty search string", () => {
    setSearch("");

    expect(readUrlParams()).toEqual({ owner: "", repo: "", milestoneNums: [], epicNums: [], demo: false });
  });

  it("parses owner, repo, milestones and epics", () => {
    setSearch("?owner=acme&repo=frontend&milestones=1,2,3&epics=10,20");
    const { owner, repo, milestoneNums, epicNums, demo } = readUrlParams();

    expect(owner).toBe("acme");
    expect(repo).toBe("frontend");
    expect(milestoneNums).toEqual([1, 2, 3]);
    expect(epicNums).toEqual([10, 20]);
    expect(demo).toBe(false);
  });

  it("filters out zero, negative and non-numeric milestone numbers", () => {
    setSearch("?milestones=0,-5,abc,7,12");

    expect(readUrlParams().milestoneNums).toEqual([7, 12]);
  });

  it("demo=1 sets demo:true and clears owner/repo", () => {
    setSearch("?demo=1&owner=acme&repo=frontend");
    const { demo, owner, repo } = readUrlParams();

    expect(demo).toBe(true);
    expect(owner).toBe("");
    expect(repo).toBe("");
  });

  it("returns empty arrays when milestones/epics params are absent", () => {
    setSearch("?owner=acme&repo=frontend");
    const { milestoneNums, epicNums } = readUrlParams();

    expect(milestoneNums).toEqual([]);
    expect(epicNums).toEqual([]);
  });
});

// ── syncUrlParams ──────────────────────────────────────────────────────────────

describe("syncUrlParams", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setSearch("");
    replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => { replaceState.mockRestore(); setSearch(""); });

  it("sets owner, repo and selected milestones", () => {
    syncUrlParams(REPO, [3, 5], false);
    const p = parsedUrl(replaceState);

    expect(p.get("owner")).toBe("acme");
    expect(p.get("repo")).toBe("frontend");
    expect(p.get("milestones")).toBe("3,5");
  });

  it("sets demo=1 and omits owner/repo in demo mode", () => {
    syncUrlParams(null, [1], true);
    const p = parsedUrl(replaceState);

    expect(p.get("demo")).toBe("1");
    expect(p.has("owner")).toBe(false);
    expect(p.has("repo")).toBe(false);
  });

  it("omits milestones param when none selected", () => {
    syncUrlParams(REPO, [], false);

    expect(parsedUrl(replaceState).has("milestones")).toBe(false);
  });

  it("sets epics param when epic numbers are provided", () => {
    syncUrlParams(REPO, [], false, [42, 43]);

    expect(parsedUrl(replaceState).get("epics")).toBe("42,43");
  });

  it("omits epics param when no epics selected", () => {
    syncUrlParams(REPO, [], false, []);

    expect(parsedUrl(replaceState).has("epics")).toBe(false);
  });

  it("preserves existing non-managed params already in the URL", () => {
    setSearch("?view=Burndown&created_from=2024-01-01");
    syncUrlParams(REPO, [1], false);
    const p = parsedUrl(replaceState);

    expect(p.get("view")).toBe("Burndown");
    expect(p.get("created_from")).toBe("2024-01-01");
  });

  it("uses pathname-only URL when no params remain", () => {
    syncUrlParams(null, [], false);
    const raw = replaceState.mock.calls[0]?.[2] as string;

    expect(raw).toBe("/");
  });
});

// ── setViewParam ───────────────────────────────────────────────────────────────

describe("setViewParam", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setSearch("");
    replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => { replaceState.mockRestore(); setSearch(""); });

  it("sets the view param for a non-default view", () => {
    setViewParam("Burndown");

    expect(parsedUrl(replaceState).get("view")).toBe("Burndown");
  });

  it("removes the view param when set to the default view", () => {
    setSearch("?view=Burndown");
    setViewParam(DEFAULT_VIEW);

    expect(parsedUrl(replaceState).has("view")).toBe(false);
  });

  it("preserves other params when changing view", () => {
    setSearch("?owner=acme&repo=frontend&milestones=1");
    setViewParam("Velocity");
    const p = parsedUrl(replaceState);

    expect(p.get("owner")).toBe("acme");
    expect(p.get("view")).toBe("Velocity");
  });
});

// ── readViewFiltersFromUrl ─────────────────────────────────────────────────────

describe("readViewFiltersFromUrl", () => {
  afterEach(() => setSearch(""));

  it("returns defaults for empty search", () => {
    setSearch("");
    const { view, filters } = readViewFiltersFromUrl();

    expect(view).toBe(DEFAULT_VIEW);
    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it("parses a valid view", () => {
    setSearch("?view=Burndown");

    expect(readViewFiltersFromUrl().view).toBe("Burndown");
  });

  it("falls back to default view for an unknown view string", () => {
    setSearch("?view=nonsense");

    expect(readViewFiltersFromUrl().view).toBe(DEFAULT_VIEW);
  });

  it("maps hide flags to showX booleans", () => {
    setSearch("?hide=oi,ci,mp");
    const { filters } = readViewFiltersFromUrl();

    expect(filters.showOpenIssues).toBe(false);
    expect(filters.showClosedIssues).toBe(false);
    expect(filters.showOpenPRs).toBe(true);
    expect(filters.showMergedPRs).toBe(false);
    expect(filters.showClosedPRs).toBe(true);
  });

  it("all hide flags hidden", () => {
    setSearch("?hide=oi,ci,op,mp,cp");
    const { filters } = readViewFiltersFromUrl();

    expect(filters.showOpenIssues).toBe(false);
    expect(filters.showClosedIssues).toBe(false);
    expect(filters.showOpenPRs).toBe(false);
    expect(filters.showMergedPRs).toBe(false);
    expect(filters.showClosedPRs).toBe(false);
  });

  it("parses pipe-separated, URI-encoded labels and people", () => {
    setSearch(`?labels=${encodeURIComponent("bug fix")}|${encodeURIComponent("feat")}&people=alice|bob`);
    const { filters } = readViewFiltersFromUrl();

    expect(filters.activeLabels).toEqual(["bug fix", "feat"]);
    expect(filters.activePeople).toEqual(["alice", "bob"]);
  });

  it("parses date range filters", () => {
    setSearch("?created_from=2024-01-01&created_to=2024-06-30&closed_from=2024-02-01&closed_to=2024-07-31");
    const { filters } = readViewFiltersFromUrl();

    expect(filters.createdStart).toBe("2024-01-01");
    expect(filters.createdEnd).toBe("2024-06-30");
    expect(filters.closedStart).toBe("2024-02-01");
    expect(filters.closedEnd).toBe("2024-07-31");
  });

  it("parses all three people roles", () => {
    setSearch("?role=author");

    expect(readViewFiltersFromUrl().filters.peopleRole).toBe("author");

    setSearch("?role=assignees");

    expect(readViewFiltersFromUrl().filters.peopleRole).toBe("assignees");
  });

  it("defaults peopleRole to 'either' for absent or invalid role", () => {
    setSearch("");

    expect(readViewFiltersFromUrl().filters.peopleRole).toBe("either");

    setSearch("?role=invalid");

    expect(readViewFiltersFromUrl().filters.peopleRole).toBe("either");
  });

  it("returns empty arrays for absent labels and people", () => {
    setSearch("?owner=acme");
    const { filters } = readViewFiltersFromUrl();

    expect(filters.activeLabels).toEqual([]);
    expect(filters.activePeople).toEqual([]);
  });
});

// ── encodeShareCode / decodeShareCode ─────────────────────────────────────────

describe("encodeShareCode / decodeShareCode", () => {
  afterEach(() => setSearch(""));

  it("encodes the current search string with a gmt: prefix", () => {
    setSearch("?owner=acme&repo=frontend&milestones=1,2");
    const code = encodeShareCode();

    expect(code.startsWith("gmt:")).toBe(true);
    expect(decodeShareCode(code)).toBe("?owner=acme&repo=frontend&milestones=1,2");
  });

  it("encodes an empty search string", () => {
    setSearch("");
    const code = encodeShareCode();

    expect(decodeShareCode(code)).toBe("");
  });

  it("round-trips a search string with all filter params", () => {
    const search = "?owner=acme&repo=frontend&milestones=3&view=Burndown&hide=ci,mp&labels=bug%20fix&people=alice";
    setSearch(search);

    expect(decodeShareCode(encodeShareCode())).toBe(search);
  });

  it("returns null for a string without the gmt: prefix", () => {
    expect(decodeShareCode("not-a-code")).toBeNull();
  });

  it("returns null for invalid base64", () => {
    expect(decodeShareCode("gmt:!!!invalid!!!")).toBeNull();
  });

  it("trims surrounding whitespace before decoding", () => {
    setSearch("?view=Velocity");
    const code = encodeShareCode();

    expect(decodeShareCode(`  ${code}  `)).toBe("?view=Velocity");
  });
});

// ── syncFiltersToUrl ───────────────────────────────────────────────────────────

describe("syncFiltersToUrl", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setSearch("");
    replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => { replaceState.mockRestore(); setSearch(""); });

  it("sets hide param for hidden item types", () => {
    syncFiltersToUrl({ ...DEFAULT_FILTERS, showOpenIssues: false, showMergedPRs: false });
    const hide = parsedUrl(replaceState).get("hide") ?? "";

    expect(hide.split(",")).toContain("oi");
    expect(hide.split(",")).toContain("mp");
    expect(hide.split(",")).not.toContain("ci");
  });

  it("omits hide param when all types are visible", () => {
    syncFiltersToUrl({ ...DEFAULT_FILTERS });

    expect(parsedUrl(replaceState).has("hide")).toBe(false);
  });

  it("sets date params and clears them when empty", () => {
    syncFiltersToUrl({ ...DEFAULT_FILTERS, createdStart: "2024-01-01", createdEnd: "2024-12-31" });
    const p = parsedUrl(replaceState);

    expect(p.get("created_from")).toBe("2024-01-01");
    expect(p.get("created_to")).toBe("2024-12-31");
    expect(p.has("closed_from")).toBe(false);
  });

  it("encodes labels with pipe separator and URI-encodes each value", () => {
    syncFiltersToUrl({ ...DEFAULT_FILTERS, activeLabels: ["bug fix", "feat"] });
    const raw = parsedUrl(replaceState).get("labels") ?? "";
    const decoded = raw.split("|").map(decodeURIComponent);

    expect(decoded).toEqual(["bug fix", "feat"]);
  });

  it("omits labels/people params when empty", () => {
    syncFiltersToUrl({ ...DEFAULT_FILTERS });
    const p = parsedUrl(replaceState);

    expect(p.has("labels")).toBe(false);
    expect(p.has("people")).toBe(false);
  });

  it("sets role param for non-default roles and omits it for 'either'", () => {
    syncFiltersToUrl({ ...DEFAULT_FILTERS, peopleRole: "author" });

    expect(parsedUrl(replaceState).get("role")).toBe("author");

    replaceState.mockClear();
    syncFiltersToUrl({ ...DEFAULT_FILTERS, peopleRole: "either" });

    expect(parsedUrl(replaceState).has("role")).toBe(false);
  });

  it("preserves non-filter params already in the URL", () => {
    setSearch("?owner=acme&repo=frontend&milestones=1,2&view=Burndown");
    syncFiltersToUrl({ ...DEFAULT_FILTERS });
    const p = parsedUrl(replaceState);

    expect(p.get("owner")).toBe("acme");
    expect(p.get("view")).toBe("Burndown");
    expect(p.get("milestones")).toBe("1,2");
  });

  it("round-trips all filter fields through sync then read", () => {
    const original: typeof DEFAULT_FILTERS = {
      ...DEFAULT_FILTERS,
      showOpenIssues: false,
      showClosedPRs: false,
      activeLabels: ["type: bug"],
      activePeople: ["alice", "bob"],
      peopleRole: "author",
      createdStart: "2024-01-01",
      createdEnd: "2024-12-31",
      closedStart: "2024-03-01",
      closedEnd: "2024-09-30",
    };
    syncFiltersToUrl(original);
    const qs = (replaceState.mock.calls[0]?.[2] as string).split("?")[1] ?? "";
    setSearch(`?${qs}`);

    const { filters } = readViewFiltersFromUrl();

    expect(filters.showOpenIssues).toBe(false);
    expect(filters.showClosedPRs).toBe(false);
    expect(filters.activeLabels).toEqual(["type: bug"]);
    expect(filters.activePeople).toEqual(["alice", "bob"]);
    expect(filters.peopleRole).toBe("author");
    expect(filters.createdStart).toBe("2024-01-01");
    expect(filters.createdEnd).toBe("2024-12-31");
    expect(filters.closedStart).toBe("2024-03-01");
    expect(filters.closedEnd).toBe("2024-09-30");
  });
});
