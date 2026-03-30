import type { View } from "../types/AppTypes";
import type { Repo } from "../types/GitHubTypes";
import { DEFAULT_VIEW } from "../types/AppTypes";

const readUrlParams = (): { owner: string; repo: string; milestoneNums: number[]; demo: boolean } => {
  const p = new URLSearchParams(window.location.search);
  const demo  = p.get("demo") === "1";
  const owner = demo ? "" : (p.get("owner") ?? "");
  const repo  = demo ? "" : (p.get("repo")  ?? "");
  const raw   = p.get("milestones") ?? "";
  const milestoneNums = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { owner, repo, milestoneNums, demo };
};

const syncUrlParams = (activeRepo: Repo | null, selectedNums: number[], isDemo: boolean): void => {
  const p = new URLSearchParams(window.location.search);
  p.delete("owner"); p.delete("repo"); p.delete("demo"); p.delete("milestones");
  if (isDemo) {
    p.set("demo", "1");
  } else if (activeRepo) {
    p.set("owner", activeRepo.owner);
    p.set("repo",  activeRepo.name);
  }
  if (selectedNums.length > 0) { p.set("milestones", selectedNums.join(",")); }
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

const setViewParam = (v: View): void => {
  const p = new URLSearchParams(window.location.search);
  if (v !== DEFAULT_VIEW) { p.set("view", v); } else { p.delete("view"); }
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

export { readUrlParams, setViewParam, syncUrlParams };
