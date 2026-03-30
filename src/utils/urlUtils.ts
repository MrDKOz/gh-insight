import type { View } from "../types/AppTypes";
import type { Filters } from "../types/FilterTypes";
import type { Repo } from "../types/GitHubTypes";
import { DEFAULT_VIEW, VIEWS } from "../types/AppTypes";

const readUrlParams = (): { owner: string; repo: string; milestoneNums: number[]; demo: boolean } => {
  const urlParams = new URLSearchParams(window.location.search);
  const demo  = urlParams.get("demo") === "1";
  const owner = demo ? "" : (urlParams.get("owner") ?? "");
  const repo  = demo ? "" : (urlParams.get("repo")  ?? "");
  const raw   = urlParams.get("milestones") ?? "";
  const milestoneNums = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { owner, repo, milestoneNums, demo };
};

const syncUrlParams = (activeRepo: Repo | null, selectedNums: number[], isDemo: boolean): void => {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete("owner"); urlParams.delete("repo"); urlParams.delete("demo"); urlParams.delete("milestones");
  if (isDemo) {
    urlParams.set("demo", "1");
  } else if (activeRepo) {
    urlParams.set("owner", activeRepo.owner);
    urlParams.set("repo",  activeRepo.name);
  }
  if (selectedNums.length > 0) { urlParams.set("milestones", selectedNums.join(",")); }
  const qs = urlParams.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

const setViewParam = (v: View): void => {
  const urlParams = new URLSearchParams(window.location.search);
  if (v !== DEFAULT_VIEW) { urlParams.set("view", v); } else { urlParams.delete("view"); }
  const qs = urlParams.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

const readViewFiltersFromUrl = (): { view: View; filters: Filters } => {
  const urlParams = new URLSearchParams(window.location.search);
  const rawView = urlParams.get("view") ?? "";
  const view: View = (VIEWS as readonly string[]).includes(rawView) ? (rawView as View) : DEFAULT_VIEW;

  const hide = new Set((urlParams.get("hide") ?? "").split(",").filter(Boolean));
  const rawRole = urlParams.get("role");

  const filters: Filters = {
    createdStart:     urlParams.get("created_from") ?? "",
    createdEnd:       urlParams.get("created_to") ?? "",
    closedStart:      urlParams.get("closed_from") ?? "",
    closedEnd:        urlParams.get("closed_to") ?? "",
    showOpenIssues:   !hide.has("oi"),
    showClosedIssues: !hide.has("ci"),
    showOpenPRs:      !hide.has("op"),
    showMergedPRs:    !hide.has("mp"),
    showClosedPRs:    !hide.has("cp"),
    // "|" separator; each value is URI-encoded so "|" inside a label/name is safe
    activeLabels: (urlParams.get("labels") ?? "").split("|").filter(Boolean).map(decodeURIComponent),
    activePeople: (urlParams.get("people") ?? "").split("|").filter(Boolean).map(decodeURIComponent),
    peopleRole:   rawRole === "author" ? "author" : rawRole === "assignees" ? "assignees" : "either",
  };
  return { view, filters };
};

const syncFiltersToUrl = (filters: Filters): void => {
  // Read the current params so App-owned keys (owner/repo/milestones/demo/view) are preserved
  const urlParams = new URLSearchParams(window.location.search);

  if (filters.createdStart) {urlParams.set("created_from", filters.createdStart);} else {urlParams.delete("created_from");}
  if (filters.createdEnd)   {urlParams.set("created_to",   filters.createdEnd);}   else {urlParams.delete("created_to");}
  if (filters.closedStart)  {urlParams.set("closed_from",  filters.closedStart);}  else {urlParams.delete("closed_from");}
  if (filters.closedEnd)    {urlParams.set("closed_to",    filters.closedEnd);}    else {urlParams.delete("closed_to");}

  const hidden: string[] = [];
  if (!filters.showOpenIssues)   {hidden.push("oi");}
  if (!filters.showClosedIssues) {hidden.push("ci");}
  if (!filters.showOpenPRs)      {hidden.push("op");}
  if (!filters.showMergedPRs)    {hidden.push("mp");}
  if (!filters.showClosedPRs)    {hidden.push("cp");}
  if (hidden.length > 0) {urlParams.set("hide", hidden.join(","));} else {urlParams.delete("hide");}

  if (filters.activeLabels.length > 0) {urlParams.set("labels", filters.activeLabels.map(encodeURIComponent).join("|"));} else {urlParams.delete("labels");}
  if (filters.activePeople.length > 0) {urlParams.set("people", filters.activePeople.map(encodeURIComponent).join("|"));} else {urlParams.delete("people");}

  if (filters.peopleRole !== "either") {urlParams.set("role", filters.peopleRole);} else {urlParams.delete("role");}

  const qs = urlParams.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

export { readUrlParams, readViewFiltersFromUrl, setViewParam, syncFiltersToUrl, syncUrlParams };
