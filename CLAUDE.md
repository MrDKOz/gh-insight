# CLAUDE.md — GH Insight

> **This file is the source of truth for how this project works.** Keep it accurate. Update it in the same PR as any change it describes — an outdated CLAUDE.md is worse than none.

## Project overview

React 19 + TypeScript + Vite SPA. Fetches GitHub milestone data via the GraphQL API and renders it as a Gantt chart with supporting analytics views. Styled with MUI v7 using a custom light/dark theme.

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint — zero warnings tolerance |
| `npm run lint:fix` | Auto-fix import order etc. |
| `npm run build` | Production build |

**Before committing:** run `npm run lint`, `npx tsc --noEmit`, `npm test`. Fix lint errors first, then `lint:fix` for auto-fixables, then re-run to confirm clean. Avoid `React.X` UMD global references (import named types directly) and throw-inside-catch patterns (use guard clauses instead).

---

## Workflow rules

- **Never push directly to `main`** — all changes via PR.
- **Always sync `main` before branching:** `git checkout main && git pull`
- **Use `gh` CLI** for all GitHub operations (PRs, CI status, releases, etc.).

### Copilot code review

Copilot posts automated review comments on every PR. Treat it as a second opinion:

- **Apply** when it identifies a genuine bug, missing coverage, or overlooked edge case.
- **Dismiss** when it conflicts with a deliberate project convention or adds speculative complexity. Explain why in the reply.
- **My judgement is final** — never apply a suggestion solely because it was raised.

When responding to a Copilot comment:
1. Reply inline: `gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID/replies -X POST -f body="..."`
2. Resolve the thread: `gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "THREAD_ID"}) { thread { isResolved } } }'`

Sign off every GitHub comment with `— 🤖 Claude Code`.

---

## GitHub Actions

Seven workflows in `.github/workflows/`. All actions are SHA-pinned; Dependabot updates them weekly (Monday 09:00 Europe/London).

### `ci.yml` — CI
Runs on push to `main` and all PRs. A `filter` job skips `check`/`e2e` when only `.github/` files change (GitHub treats `if:`-skipped required checks as passing; full suite always runs on `main`).

- **`check`** — lint, type-check (renderer + electron), unit tests, `npm audit`
- **`e2e`** — Playwright (needs `check`)
- **`cleanup-main-caches`** — prunes stale main-branch caches (needs `check` + `e2e`, push to `main` only)

### `deploy.yml` — Deploy to GitHub Pages
Triggers via `workflow_run` after CI passes on `main` (or manually). Builds, checks out `gh-pages` into `_site/`, rsyncs `dist/` excluding `.git/` and `pr-*/`. Pushes with a 3-attempt rebase+retry loop. Concurrency group `pages` with `cancel-in-progress: false` prevents partial deploys.

### `preview.yml` — PR Preview
Runs on PR open/sync/reopen/close. On open/sync/reopen: builds with `DEPLOY_BASE=/gh-insight/pr-{N}/`, deploys to `pr-{N}/` on `gh-pages`, creates a GitHub deployment, polls the preview URL for up to 4 minutes. On close: marks deployments inactive, deletes them and the environment, removes `pr-{N}/` from `gh-pages`. Both git push operations use rebase+retry loops. Concurrent builds for the same PR cancel in favour of the latest.

### `release.yml` — Release
Runs when a PR labelled `release:patch/minor/major` is merged to `main`. `prepare` reads version via `jq`, tags and creates a draft release. `build` runs in parallel on macOS/Windows/Linux: type-checks electron, builds renderer in electron mode, packages with `electron-builder --publish never`, uploads binaries to the draft. Release stays draft until manually published.

### `electron.yml` — Electron CI
Runs on PRs touching `electron/**` or related build config. Builds in Electron mode, runs `e2e/electron.spec.ts` via Playwright with `xvfb-run`.

### `cache-cleanup.yml` — Cache Cleanup
Runs on PR close. Deletes all Actions caches for that PR's merge ref.

### `update-holidays.yml` — Update Holiday Data
Runs 1 Jan at 06:00 UTC (or manually). Fetches UK bank holidays (gov.uk) and US public holidays (nager.at) for current year +2, opens a PR. Both fetches have a 30-second timeout.

### Dependabot
Runs weekly for both Actions and npm. **Process one PR at a time:** merge it, then trigger `@dependabot rebase` on the next. Merging in parallel causes repeated rebase churn.

---

## Release checklist

**Major/minor releases only** (e.g. 2.3.0, 3.0.0) — update `SECURITY.md` before merging:
- Mark the new `X.Y.x` row as **Yes**, previous minor as **No**

Patch releases don't require a `SECURITY.md` update.

---

## Architecture

```
src/
  api/          GitHub REST + GraphQL calls (no fetch in components)
  charts/       SVG charts — Burndown, CycleTime, Velocity, CumulativeFlow
  components/   UI components — GanttView, MilestoneView, FilterBar, AuthorTag, …
  data/         Demo data (relative dates via d(daysAgo, hour) helper)
  hooks/        Custom hooks — useGanttLayout, useSettings, …
  state/        Pure state logic — milestoneReducer
  types/
    GitHubTypes.ts   — API contract (IssueItem, PRItem, Milestone, …)
    AppTypes.ts      — App-layer (View, ExportFormat, AppPhase, GanttHandle)
    SettingsTypes.ts — Settings type and defaults
  utils/
    colorUtils.ts   — COLORS, COLORS_CB, makeChartColors, makeStatusChipSx
    dateUtils.ts    — MS, fmtDate, fmtDateTime, snapToHour, forecastCompletion
    displayUtils.ts — FS, hoverCardPos, safeUrl, itemEndDate, itemStatus, pluralize
    sxTokens.ts     — shared MUI sx design tokens
    export.ts       — CSV/XLSX/PDF/PNG/SVG export
    tokenCrypto.ts  — PAT encryption via IndexedDB + SubtleCrypto
  index.css     Gantt canvas + SVG chart CSS only
  theme.ts      MUI theme (Redgate Honeycomb)
```

---

## Code principles

### Where things go

| What | Where |
|---|---|
| UI patterns (avatar, hover card, badge) | `src/components/` |
| Date/time logic | `src/utils/dateUtils.ts` |
| Display/presentation helpers | `src/utils/displayUtils.ts` |
| Colour palette helpers | `src/utils/colorUtils.ts` |
| Shared MUI sx tokens | `src/utils/sxTokens.ts` |
| Chart-local colour constants | `C` / `COL` objects inside the chart file |

`AuthorTag` and `AuthorCard` are the canonical author renderers — don't re-implement inline.

Extract a named component when a visual pattern appears in 2+ places, a block has its own local state, or it's independently testable.

### MUI styling over custom CSS

Use MUI `sx`, `Box`, `Paper`, `Typography`, `Stack`, `Alert` for all UI chrome. `src/index.css` is reserved for:
1. Gantt canvas layout — `.tl-body`, `.tl-label-col`, `.tl-track-col`, `.tl-bar`, `.tl-resize-handle`, scrollbar styling
2. SVG chart theming — `.chart-label`, `.chart-axis`, `.chart-grid`, `.ct-dot`, `.vel-hover-area`
3. CSS custom property tokens — `:root` and `body.dark` colour tokens

### `useEffect` — only for true side effects

Only use `useEffect` for:
- Non-React event listeners (e.g. `wheel` with `{ passive: false }`)
- DOM measurements after layout (e.g. `getBoundingClientRect`)
- Cleanup on unmount

Derive state from other state with `useMemo`, not `useEffect`.

---

## Security

### Content Security Policy

CSP lives in `index.html`. `stripDevCspPlugin` in `vite.config.ts` strips dev-only directives at build time.

- `connect-src` governs `fetch()` — avatar fetches must be here, not `img-src` (they go through `inlineImages` in `export.ts`)
- `style-src` must keep `'unsafe-inline'` for Emotion
- Production `script-src` is `'self'` only

### URL and input validation

- `safeUrl()` (`displayUtils.ts`) — validates hostname is exactly `github.com` or `*.github.com`
- `fmtDate()` — guards malformed ISO strings with `isNaN(d.getTime())`, returns `"N/A"`
- `durationDays()` — clamps with `Math.max(0, ...)` to prevent negative values from timezone jitter

### Token encryption

- `encryptToken` (`tokenCrypto.ts`) throws `EncryptionUnavailableError` (never silently falls back) when IndexedDB is blocked
- `EncryptionUnavailableError` carries a `fallbackPayload` (base64 token) — `App.tsx` stores it and warns the user
- Tests require `import "fake-indexeddb/auto"` — jsdom's IndexedDB doesn't support CryptoKey structured cloning

---

## Patterns

### Hover cards

- `position: fixed` with `getBoundingClientRect()` coords — works inside scrollable containers
- 150ms `setTimeout` before hiding — lets the user move onto the card; clear on card `onMouseEnter`
- `hoverCardPos()` (`displayUtils.ts`) for edge-detection within a chart wrapper
- `barCardStyle()` (local to `GanttView`) for window-level edge detection
- Never use native `title` attributes — use a MUI `Paper` card

### Colour palette and colorblind mode

Every colour must go through the palette system:

- Tokens in `COLORS` (default) and `COLORS_CB` (Okabe-Ito) in `colorUtils.ts` — add new tokens to **both** and to `makeChartColors` return value
- `body.colorblind` class (toggled in `App.tsx`) drives CSS overrides — add `body.colorblind .your-class` and `body.dark.colorblind .your-class` alongside every new colour in `index.css`
- Never hardcode a colour without a colorblind-safe alternative in the same diff

### SVG charts (Burndown, CycleTime, Velocity, CumulativeFlow)

- Use `COL.<token>` from `makeChartColors` as hardcoded presentation attributes — `html-to-image` can't resolve CSS custom properties in its cloned document
- Add a CSS class alongside the `COL` attribute for dark-mode/colorblind runtime overrides
- Continuous mouse-tracking cursor line (`onMouseMove` on wrapper `<div>`, snap to nearest data point) — not per-dot hover targets
- Empty states: MUI `Typography` with `color="text.secondary"`
- Clickable SVG elements: `<g role="button" tabIndex={0} aria-label={...} onClick={...} onKeyDown={...}>` — `onMouseEnter` on the inner shape, not the `<g>`

### Gantt bar rendering

- Snap `startMs` to UTC midnight: `new Date(new Date(item.createdAt).toISOString().slice(0, 10)).getTime()`
- Snap closed bar width: `snapEndMs = startMs + duration * 86_400_000` — same duration label = same visual width
- Show today marker and extend range to today only when at least one item is open; closed milestones get `+ 3 * MS` right padding

### Gantt cursor crosshair

- Track position on `.tl-track-col` with `scrollLeft` correction: `x = e.clientX - rect.left + el.scrollLeft`
- Express as percentage: `pct = x / trackWidth * 100`, apply as `left: ${pct}%` in each `.tl-track` row
- Suppress date chip when a bar hover card is showing

### GitHub avatars

- URL: `https://github.com/${login}.png?size=${size * 2}` (2× for retina, render at `size` CSS px)
- `AuthorTag` for inline avatar + name; `AuthorCard` for the floating hover card
- Always `alt={login}`

---

## Types and data

### Adding fields to `TimelineItem`

1. Add to `IssueItem` and `PRItem` in `src/types/GitHubTypes.ts`
2. Fetch in `src/api/github.ts` (GraphQL query + mapping)
3. Add to all demo items in `src/data/demo.ts`
4. Add to **both** export groups in `src/utils/export.ts`:
   - List view: `Row`, `buildRows`, `COLS`, `exportCSV/Markdown/PDF/XLSX`
   - Review-wait view: `ReviewWaitRow`, `buildReviewWaitRows`, `RW_COLS`, `exportReviewWaitCSV/Markdown/PDF/XLSX`
5. Add to test fixtures in all three test files

### Demo data

- Use `d(daysAgo, hour)` helper — never hardcode calendar dates
- Use varied author logins so avatar/author UI is visible without a live API call

---

## Testing

- Tests in `src/**/__tests__/` — Vitest + Testing Library
- `npm test` already passes `--run` — don't add it again
- Update fixtures whenever types change — required fields must be present everywhere
- Unit-test pure utilities thoroughly; component smoke tests are fine for UI

---

## Export implementation notes

### PDF tables

Uses `drawPDFTable` in `export.ts` — a custom jsPDF helper. **Do not re-add `jspdf-autotable`** — removed deliberately to reduce bundle size.

- Landscape A4: 297mm − 28mm margins = **269mm** available. Keep column widths summing to 269mm.

### PNG / image export

`captureElement` runs `toPng` twice — first pass warms up Emotion's style inlining into the clone. Do not remove it.

`inlineImages` fetches `<img>` tags via `fetch()`, swaps to data URLs before capture, restores in `finally`. Required because `html-to-image`'s cloned document can't re-fetch cross-origin images.

### `write-excel-file` import

Always import from `"write-excel-file/browser"` — v3 removed the root export. The bare package name fails in Vite.

### `html2canvas` stub

`src/utils/html2canvas-stub.ts` is aliased over the real package in `vite.config.ts`. Prevents a ≈200 KB dead chunk from jsPDF's unused `.html()` plugin. **Never call `jsPDF.html()`** — throws by design.

---

## React 19 / TypeScript notes

- `useRef<T>(null)` → `RefObject<T | null>` in React 19 — ref props must use `RefObject<T | null>`, not `RefObject<T>`
- `src/vite-env.d.ts` provides `/// <reference types="vite/client" />` for CSS side-effect import recognition

### Blocked upgrades

| Package | Current | Blocker |
|---|---|---|
| TypeScript | 5.9.x | TS 6 errors on `moduleResolution: node` in `tsconfig.electron.json` (`node` maps to `node10` internally) — needs migration to `bundler` or `node16` first |
| ESLint | 9.x | `eslint-plugin-import` peer range stops at `^9` — no ESLint 10 support yet |
