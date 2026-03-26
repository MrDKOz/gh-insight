# CLAUDE.md — GitHub Work Visualiser

## Project overview

React 18 + TypeScript + Vite single-page app that fetches GitHub milestone data via the GitHub GraphQL API and renders it as a Gantt chart with supporting analytics views. Styled with MUI v7 and the Redgate Honeycomb theme.

**Run:** `npm run dev`
**Test:** `npm test`
**Build:** `npm run build`

---

## Code principles

### Stay DRY — extract components and utilities

Before writing inline markup or logic that looks like something already in the codebase, check whether a shared component or utility already covers it. If the same pattern appears more than once, extract it.

- UI patterns (avatar, hover card, badge) → `src/components/`
- Pure logic (date formatting, positioning helpers) → `src/utils/utils.ts`
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

## Patterns to follow

### Hover cards

- Use `position: fixed` with coordinates from `getBoundingClientRect()` so cards work correctly inside scrollable containers
- Use a `setTimeout` (150 ms) before hiding so the user can move the mouse from the trigger element onto the card itself — clear the timer on `onMouseEnter` of the card
- Use `hoverCardPos()` from `src/utils/utils.ts` for cards that need edge-detection (flip left/right, clamp to viewport) within a chart wrapper
- Use `barCardStyle()` (local to `GanttView`) for fixed-position cards that need window-level edge detection
- Never use native `title` attributes for meaningful data — use a MUI `Paper` card

### SVG charts (Burndown, CycleTime, Velocity, CumulativeFlow)

- Hardcode presentation attribute colours (e.g. `fill="#0969da"`) as fallbacks for `html-to-image` export, which cannot resolve CSS custom properties in its cloned document
- Add a CSS class (e.g. `className="chart-label"`) alongside the hardcoded attribute so dark-mode CSS overrides work at runtime
- Provide a continuous mouse-tracking cursor line (`onMouseMove` on the wrapper `<div>`, compute SVG-space fraction, snap to nearest data point) rather than per-dot hover targets
- Empty-state messages use MUI `Typography` with `color="text.secondary"`, not a custom CSS class

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
1. Add to both `IssueItem` and `PRItem` in `src/types.ts`
2. Fetch it in `src/api/github.ts` (GraphQL query + mapping)
3. Add it to all demo items in `src/data/demo.ts`
4. Include it in exports (`src/utils/export.ts`) — CSV, Markdown, PDF, XLSX
5. Add the field to test fixtures in all three test files

### Demo data

- All dates must use the relative `d(daysAgo, hour)` helper — never hardcode calendar dates
- Use a varied set of author logins so the avatar/author UI is visible without a live API call

---

## Testing

- Tests live in `src/**/__tests__/` and use Vitest + Testing Library
- Run with `npm test` (already passes `--run` — do not add a second `--run` flag)
- Keep tests up to date whenever types or logic change; if a type gains a new required field, update every fixture that constructs that type
- Unit-test pure utilities (`utils.ts`, `export.ts`, state reducers) thoroughly
- Component smoke tests are acceptable for UI components; avoid testing implementation details

---

## Architecture

```
src/
  api/          GitHub REST + GraphQL calls
  charts/       SVG chart components (Burndown, CycleTime, Velocity, CumulativeFlow)
  components/   UI components (Timeline, GanttView, FilterBar, StatsBar, AuthorTag, …)
  data/         Demo data (relative dates, varied authors)
  state/        Reducers / pure state logic
  utils/        Shared helpers (utils.ts, export.ts, tokenCrypto.ts)
  types.ts      Shared TypeScript interfaces
  index.css     Gantt canvas + SVG chart CSS only
  theme.ts      Redgate Honeycomb MUI theme configuration
```

- API calls belong in `src/api/` — no `fetch` calls inside components
- Shared logic (date formatting, position helpers, colour constants) belongs in `src/utils/utils.ts`
- Chart-local colour maps (`C`, `COL`) stay inside the chart file — they are not shared because each chart uses different colours and they serve as html-to-image fallbacks
