import type { View } from "../types/AppTypes";
import type { Repo } from "../types/GitHubTypes";
import { DEFAULT_VIEW } from "../types/AppTypes";

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

export { readUrlParams, setViewParam, syncUrlParams };
