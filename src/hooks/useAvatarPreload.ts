import type { TimelineItem } from "../types/GitHubTypes";
import { useEffect } from "react";

// Module-level set: URLs already primed into the browser cache this session.
// Persists across component remounts so we never re-fetch a URL we've already
// triggered — even when switching views causes MilestoneView to re-render.
const preloaded = new Set<string>();

const PRELOAD_SIZES = [40, 144]; // inline tag (@2×20px) and hover card (@144px)

/**
 * Fires off `new Image()` for every unique author/assignee in `items` at the
 * standard avatar sizes so the browser cache is warm before charts render.
 * Uses a module-level dedup set — safe to call on every render cycle.
 */
const useAvatarPreload = (items: TimelineItem[]): void => {
  useEffect(() => {
    if (items.length === 0) { return; }

    const logins = new Set<string>();
    for (const item of items) {
      logins.add(item.author);
      for (const a of item.assignees) { logins.add(a); }
    }

    for (const login of logins) {
      for (const size of PRELOAD_SIZES) {
        const url = `https://github.com/${login}.png?size=${size}`;
        if (preloaded.has(url)) { continue; }
        preloaded.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }, [items]);
};

export { useAvatarPreload };
