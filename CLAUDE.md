# CLAUDE.md — GH Insight

## Project overview

React 19 + TypeScript + Vite single-page app that fetches GitHub milestone data via the GitHub GraphQL API and renders it as a Gantt chart with supporting analytics views. Styled with MUI v7 and the Redgate Honeycomb theme.

**Run:** `npm run dev`
**Test:** `npm test`
**Lint:** `npm run lint`
**Build:** `npm run build`

> After making code changes, always run `npm run lint`, `npx tsc --noEmit`, and `npm test` before committing. Lint runs ESLint with `--max-warnings 0` (zero tolerance). Fix errors first, then run `npm run lint:fix` for auto-fixable warnings (import order etc.), then re-run lint to confirm clean. Also watch for IDE-level inspection warnings — avoid `React.X` UMD global references (import named types directly) and avoid throw-inside-catch patterns (use guard clauses or a local error helper instead).

---

## Workflow rules

**All changes must be delivered via a pull request — never push directly to `main`.**

`gh` CLI is available and should be used for all GitHub operations (creating PRs, viewing CI status, managing releases, etc.).

---

## GitHub Actions

Four workflows live in `.github/workflows/`:

### `ci.yml` — CI
Runs on every push and pull request. Installs dependencies, runs `npm run lint`, `npx tsc --noEmit`, and `npm test`. All three must pass before a PR can be merged.

### `deploy.yml` — Deploy to GitHub Pages
Runs on every push to `main` (and can be triggered manually). Builds the app with `npm run build` and deploys `./dist` to the `gh-pages` branch via `peaceiris/actions-gh-pages`. Uses `keep_files: true` so PR preview subdirectories (`pr-N/`) are preserved alongside the main site. Deployments are serialised (no cancel-in-progress) to avoid leaving the site in a broken state.

### `preview.yml` — PR Preview
Runs on PR open, sync, reopen, and close events. On open/sync/reopen it builds the app with `DEPLOY_BASE=/gh-insight/pr-{N}/` and deploys to `pr-{N}/` on the `gh-pages` branch, then posts (or updates) a comment on the PR with the preview URL (`https://dkoz.me/gh-insight/pr-{N}/`). On close it removes the preview directory from `gh-pages`. Concurrent builds for the same PR are cancelled in favour of the latest.

### `release.yml` — Release
Runs when a PR labelled `release:patch`, `release:minor`, or `release:major` is merged into `main`. Reads the version from `package.json`, creates and pushes a git tag, then creates a draft GitHub release. A matrix build job then runs in parallel on macOS, Windows, and Linux: it type-checks the Electron main process, builds the renderer in Electron mode, and uploads the packaged binaries to the draft release via `electron-builder --publish always`. The release is left as a draft so assets can be reviewed before publishing.

---

## Code principles

### Stay DRY — extract components and utilities

Before writing inline markup or logic that looks like something already in the codebase, check whether a shared component or utility already covers it. If the same pattern appears more than once, extract it.

- UI patterns (avatar, hover card, badge) → `src/components/`
- Date/time logic → `src/utils/dateUtils.ts`
- Display/presentation helpers → `src/utils/displayUtils.ts`
- Colour palette and palette-aware helpers → `src/utils/colorUtils.ts`
- Shared MUI sx tokens → `src/utils/sxTokens.ts`
- Chart-specific colour constants → local `C` / `COL` objects inside the chart file
- `AuthorTag` and `AuthorCard` are the canonical way to render an author anywhere in the app — do not re-implement inline avatar markup

### Components over inline markup

Prefer extracting a named component when:
- A visual pattern is used in two or more places
- A block of JSX has its own local state or event handling that doesn't belong in the parent
- A piece of UI is independently testable

Keep components focused. A component that renders a hover card should not also own the fetch logic.

### MUI styling over custom CSS

Use MUI `sx` props, `Box`, `Paper`, `Typography`, `Stack`, `Alert`, etc. for all UI chrome. Custom CSS in `src/index.css` is reserved exclusively for:

1. **Gantt canvas layout** — `.tl-body`, `.tl-label-col`, `.tl-track-col`, `.tl-track`, `.tl-bar`, `.tl-resize-handle`, scrollbar styling, etc.
2. **SVG chart theming** — `.chart-label`, `.chart-axis`, `.chart-grid`, `.bd-callout-text`, `.ct-dot`, `.vel-hover-area`
3. **CSS custom property tokens** — `:root` and `body.dark` colour tokens used by both the Gantt canvas and SVG elements

Do not add new CSS classes for things MUI already handles (hover cards, tooltips, empty states, legends, badges, alerts).

### `useEffect` — only when truly necessary

Use `useEffect` only for side effects that cannot be expressed as derived state or event handlers:

- Attaching non-React event listeners (e.g. `wheel` with `{ passive: false }`)
- Reading DOM measurements after layout (e.g. axis height via `getBoundingClientRect`)
- Cleanup on unmount

Do **not** use `useEffect` to sync one piece of state from another — derive it with `useMemo` instead. Do **not** use `useEffect` for data transformations that can be computed inline.

---

## Security

### Content Security Policy

The CSP lives in `index.html`. The `stripDevCspPlugin` in `vite.config.ts` removes dev-only directives at build time so the production bundle ships without `'unsafe-eval'` or `'unsafe-inline'` in `script-src`.

- `connect-src` governs `fetch()` — GitHub avatar fetches must be listed here (not `img-src`) because `inlineImages` in `export.ts` fetches them via `fetch()` to inline them for PNG export
- `style-src` must keep `'unsafe-inline'` for Emotion (MUI's CSS-in-JS runtime)
- Production `script-src` is `'self'` only — no unsafe directives

### URL and input validation

- `safeUrl()` in `src/utils/displayUtils.ts` validates that a URL's hostname is exactly `github.com` or a `*.github.com` subdomain — never accept arbitrary `https:` URLs
- `fmtDate()` guards against malformed ISO strings with `isNaN(d.getTime())` and returns `"N/A"`
- `durationDays()` clamps with `Math.max(0, ...)` to prevent timezone-jitter producing negative values

### Token encryption

- `encryptToken` in `src/utils/tokenCrypto.ts` throws `EncryptionUnavailableError` (not silently falls back) when IndexedDB is blocked
- `EncryptionUnavailableError` carries a `fallbackPayload` (base64 token) so the caller can decide what to do — `App.tsx` stores it and shows a clear warning to the user
- Tests for `tokenCrypto` require `import "fake-indexeddb/auto"` at the top — jsdom's IndexedDB does not support CryptoKey structured cloning

---

## Patterns to follow

### Hover cards

- Use `position: fixed` with coordinates from `getBoundingClientRect()` so cards work correctly inside scrollable containers
- Use a `setTimeout` (150 ms) before hiding so the user can move the mouse from the trigger element onto the card itself — clear the timer on `onMouseEnter` of the card
- Use `hoverCardPos()` from `src/utils/displayUtils.ts` for cards that need edge-detection (flip left/right, clamp to viewport) within a chart wrapper
- Use `barCardStyle()` (local to `GanttView`) for fixed-position cards that need window-level edge detection
- Never use native `title` attributes for meaningful data — use a MUI `Paper` card

### Colour palette and colorblind mode

**Every colour used in the app must be routed through the palette system** so it automatically respects the colorblind toggle:

- Named colour tokens live in `COLORS` (default) and `COLORS_CB` (Okabe-Ito) in `src/utils/colorUtils.ts`
- `makeChartColors(colorblindMode)` exposes the right set for SVG charts — add new tokens to **both** objects and to the `makeChartColors` return value
- The `body.colorblind` class (toggled in `App.tsx`) drives CSS overrides for Gantt/CSS-only colours — add `body.colorblind .your-class` and `body.dark.colorblind .your-class` rules alongside every new colour in `index.css`
- Never hardcode a colour value in a chart, component, or CSS rule without also providing a colorblind-safe alternative in the same diff

### SVG charts (Burndown, CycleTime, Velocity, CumulativeFlow)

- Hardcode presentation attribute colours via `COL.<token>` (from `makeChartColors`) as fallbacks for `html-to-image` export, which cannot resolve CSS custom properties in its cloned document — this also ensures the colorblind palette is applied to exported images
- Add a CSS class (e.g. `className="chart-label"`) alongside the `COL` attribute so dark-mode and colorblind CSS overrides work at runtime
- Provide a continuous mouse-tracking cursor line (`onMouseMove` on the wrapper `<div>`, compute SVG-space fraction, snap to nearest data point) rather than per-dot hover targets
- Empty-state messages use MUI `Typography` with `color="text.secondary"`, not a custom CSS class
- Interactive SVG elements (clickable dots, etc.) must be wrapped in a `<g role="button" tabIndex={0} aria-label={...} onClick={...} onKeyDown={...}>` — attach `onMouseEnter` to the inner shape, not the `<g>`, so hover and keyboard activation are independent

### Gantt bar rendering

- Snap `startMs` to UTC midnight: `new Date(new Date(item.createdAt).toISOString().slice(0, 10)).getTime()` — ensures same-calendar-day items share the same left edge regardless of their creation time
- Snap closed bar width to the rounded duration: `snapEndMs = startMs + duration * 86_400_000` — ensures bars with the same duration label are visually the same width
- Show the today marker and extend the timeline range to today **only** when at least one item is still open; for fully-closed milestones add a small right padding (`+ 3 * MS`) instead

### Gantt cursor crosshair

- Track mouse position on `.tl-track-col` with `scrollLeft` correction: `x = e.clientX - rect.left + el.scrollLeft`
- Express position as a percentage (`pct = x / trackWidth * 100`) and apply as `left: ${pct}%` inside each `.tl-track` row
- Suppress the date chip tooltip when a bar hover card is already showing

### GitHub avatars

- URL pattern: `https://github.com/${login}.png?size=${size * 2}` (request 2× pixels for retina displays, render at `size` CSS pixels)
- Use `AuthorTag` for inline avatar + name; use `AuthorCard` for the floating hover card
- Always provide `alt={login}` on avatar `<img>` elements

---

## Types and data

### Adding fields to `TimelineItem`

When adding a new field:
1. Add to both `IssueItem` and `PRItem` in `src/types/GitHubTypes.ts`
2. Fetch it in `src/api/github.ts` (GraphQL query + mapping)
3. Add it to all demo items in `src/data/demo.ts`
4. Include it in **both** export groups in `src/utils/export.ts`:
   - List view: `Row` type, `buildRows`, `COLS`, `exportCSV`, `exportMarkdown`, `exportPDF`, `exportXLSX`
   - Review-wait view: `ReviewWaitRow` type, `buildReviewWaitRows`, `RW_COLS`, `exportReviewWaitCSV`, `exportReviewWaitMarkdown`, `exportReviewWaitPDF`, `exportReviewWaitXLSX`
5. Add the field to test fixtures in all three test files

### Demo data

- All dates must use the relative `d(daysAgo, hour)` helper — never hardcode calendar dates
- Use a varied set of author logins so the avatar/author UI is visible without a live API call

---

## Testing

- Tests live in `src/**/__tests__/` and use Vitest + Testing Library
- Run with `npm test` (already passes `--run` — do not add a second `--run` flag)
- Keep tests up to date whenever types or logic change; if a type gains a new required field, update every fixture that constructs that type
- Unit-test pure utilities (`colorUtils.ts`, `dateUtils.ts`, `displayUtils.ts`, `export.ts`, state reducers) thoroughly
- Component smoke tests are acceptable for UI components; avoid testing implementation details

---

## Export implementation notes

### PDF tables

PDF list exports use `drawPDFTable` (defined in `src/utils/export.ts`) — a custom jsPDF drawing helper. **Do not add `jspdf-autotable` back** — the replacement was deliberate to reduce bundle size and remove a dependency.

- Page width for landscape A4: 297mm − 14mm (left) − 14mm (right) = **269mm** available
- When adding columns, reduce other widths to keep the total at 269mm

### PNG / image export

`captureElement` in `export.ts` runs two passes (`toPng` twice) — the first is a warm-up that forces Emotion to inline its styles into the clone. Do not remove the warm-up pass.

`inlineImages` pre-fetches `<img>` tags via `fetch()` and swaps them to data URLs before capture, then restores the originals in a `finally` block. This is needed because `html-to-image`'s cloned document cannot re-fetch cross-origin images.

### `write-excel-file` import path

Always import as `"write-excel-file/browser"` — v3 removed the `"."` root export and split into explicit sub-paths. Using the bare package name will fail in Vite's resolver.

### `html2canvas` stub

`src/utils/html2canvas-stub.ts` is aliased over the real `html2canvas` package in `vite.config.ts`. jsPDF bundles a dynamic import of html2canvas for its unused `.html()` plugin — the stub prevents the ≈200 KB dead chunk from appearing in the build. **Never call `jsPDF.html()`** — it will throw at runtime by design.

---

## React 19 / TypeScript notes

- `useRef<T>(null)` returns `RefObject<T | null>` in React 19 types — prop types that accept a ref must use `RefObject<T | null>`, not `RefObject<T>`
- `src/vite-env.d.ts` provides `/// <reference types="vite/client" />` so TypeScript recognises CSS side-effect imports (`import "./index.css"`)

### Dependency version constraints

These upgrades are currently blocked by the plugin ecosystem — do not attempt until the listed packages add support:

| Package | Current | Blocked by |
|---|---|---|
| TypeScript | 5.x | `@typescript-eslint` requires `<6.0.0` |
| ESLint | 9.x | `eslint-plugin-import` peer range stops at `^9` |

---

## Architecture

```
src/
  api/          GitHub REST + GraphQL calls
  charts/       SVG chart components (Burndown, CycleTime, Velocity, CumulativeFlow)
  components/   UI components (GanttView, MilestoneView, FilterBar, StatsBar, AuthorTag, …)
  data/         Demo data (relative dates, varied authors)
  hooks/        Custom React hooks (useGanttLayout, useSettings, …)
  state/        Reducers / pure state logic (milestoneReducer)
  types/        TypeScript type definitions by domain:
                  GitHubTypes.ts  — API contract types (IssueItem, PRItem, Milestone, …)
                  AppTypes.ts     — App-layer types (View, ExportFormat, AppPhase, GanttHandle)
                  SettingsTypes.ts — Settings type and defaults
  utils/        Shared helpers:
                  colorUtils.ts  — COLORS, COLORS_CB, makeChartColors, makeStatusChipSx
                  dateUtils.ts   — MS, fmtDate, fmtDateTime, snapToHour, forecastCompletion
                  displayUtils.ts — FS, hoverCardPos, safeUrl, itemEndDate, itemStatus, pluralize
                  sxTokens.ts    — shared MUI sx design token objects
                  export.ts      — CSV/XLSX/PDF/PNG/SVG export
                  tokenCrypto.ts — PAT encryption via IndexedDB + SubtleCrypto
  index.css     Gantt canvas + SVG chart CSS only
  theme.ts      Redgate Honeycomb MUI theme configuration
```

- API calls belong in `src/api/` — no `fetch` calls inside components
- GitHub domain types belong in `src/types/GitHubTypes.ts`; app-layer types in `src/types/AppTypes.ts`
- Date/time logic → `src/utils/dateUtils.ts`; colour palette → `src/utils/colorUtils.ts`; presentation helpers → `src/utils/displayUtils.ts`; shared sx tokens → `src/utils/sxTokens.ts`
- Chart-local colour maps (`C`, `COL`) stay inside the chart file — they are not shared because each chart uses different colours and they serve as html-to-image fallbacks
