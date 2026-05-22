---
name: dev-server
description: Launch the Vite dev server for GH Insight. Use when asked to start, spin up, or run the dev site, dev server, or local app. Handles missing node_modules by running npm install first.
---

# dev-server

Starts the Vite dev server (`npm run dev`) and waits for it to report ready.

## Steps

1. **Check dependencies.** If `node_modules/` is missing, run `npm install` first (foreground, may take a few minutes). Skip if already installed.

2. **Launch dev server in the background** with the Bash tool:
   ```
   npm run dev
   ```
   Use `run_in_background: true`. Vite is fast (~500ms) but the background task keeps it alive for the session.

3. **Wait for ready marker.** Poll the output file with:
   ```bash
   until grep -qE "Local:|ready in|error" <output-file>; do sleep 1; done
   ```
   Use a 60s timeout. Bail and surface the error if `error` appears instead.

4. **Read the output file** and report the local URL (typically `http://localhost:5173/`) plus the background task ID so the user can stop it later.

## Notes

- The dev server runs Vite directly — no Electron mode. For Electron, use `npm run dev:electron` instead (different command, different entry point).
- If port 5173 is busy, Vite picks the next free port and prints it in the same `Local:` line — surface whatever URL Vite reports, don't hardcode.
- Do not run `npm run build` or `npm test` as part of this skill — only `dev`.
