# GitHub Work Visualiser

A browser-based dashboard for visualising GitHub milestone progress. Point it at any public or private repository, select one or more milestones, and explore the data across six views.

## Features

- **Gantt** — horizontal bars for every issue and PR, with resizable labels and scroll-wheel zoom
- **Burndown** — daily open issue count over the milestone's lifetime
- **Cycle Time** — scatter plot of days from creation to close, with median and mean reference lines
- **Velocity** — weekly stacked bar chart of closed issues and merged/closed PRs
- **Cumulative Flow** — running totals of created vs completed items
- **List** — sortable table of all items with status, dates, and duration
- **Filters** — show/hide by type and status; date range filters on creation and close date
- **Export** — CSV, XLSX, Markdown, PNG (current view or full timeline), and PDF
- **Multi-milestone** — load several milestones at once and view them together, colour-coded by milestone
- **Demo mode** — try the app without a token using built-in sample data

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### GitHub token

To load real milestone data you need a GitHub personal access token.

- **Public repositories** — a classic token with no scopes is sufficient, or a fine-grained token with read-only `Contents` permission.
- **Private repositories** — a classic token with the `repo` scope, or a fine-grained token with `Contents: Read` permission.

The token is encrypted with AES-GCM (Web Crypto API) before being written to `localStorage`. The encryption key lives in IndexedDB and never leaves your browser.

## Development

```bash
npm run dev      # start dev server
npm test         # run unit tests (Vitest)
npm run build    # type-check + production build
npm run preview  # preview the production build locally
```

### Project structure

```
src/
  api/          GitHub REST + GraphQL fetch logic
  charts/       SVG chart components (Burndown, CycleTime, Velocity, CumulativeFlow)
  components/   UI components (Timeline, GanttView, FilterBar, StatsBar, ItemList, …)
  data/         Demo data
  state/        Milestone reducer
  utils/        Shared utilities, token encryption, export functions
  types.ts      Shared TypeScript types
```

### Tech stack

- React 18 + TypeScript + Vite
- MUI v7 with the Redgate Honeycomb theme
- Vitest + Testing Library for unit tests
