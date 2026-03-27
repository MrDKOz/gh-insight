# GitHub Work Visualiser

A browser-based dashboard for visualising GitHub milestone progress. Point it at any public or private repository, select one or more milestones, and explore the data across six views.

## Features

- **Gantt** — horizontal bars for every issue and PR, with resizable labels and scroll-wheel zoom
- **Burndown** — daily open issue count over the milestone's lifetime
- **Cycle Time** — scatter plot of days from creation to close, with median and mean reference lines
- **Velocity** — weekly stacked bar chart of closed issues and merged/closed PRs
- **Cumulative Flow** — running totals of created vs completed items
- **Contributors** — horizontal bar chart of issues and PRs per author
- **List** — sortable table of all items with status, dates, labels, assignees, and duration
- **Filters** — show/hide by type and status; date range filters on creation and close date
- **Export** — CSV, XLSX, Markdown, PNG (current view or full timeline), and PDF
- **Multi-milestone** — load several milestones at once and view them together, colour-coded by milestone
- **Shareable URLs** — current milestone selection, active view, and all filters are encoded in the URL; the token is never included
- **Colorblind mode** — alternative colour palette across all charts
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

The token is encrypted with AES-GCM (256-bit, Web Crypto API). The ciphertext is stored in `localStorage`; the encryption key is stored in IndexedDB and never leaves your browser. The token is never written to the URL.

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
  charts/       SVG chart components (Burndown, CycleTime, Velocity, CumulativeFlow, Contributors)
  components/   UI components (Timeline, GanttView, FilterBar, StatsBar, ItemList, …)
  data/         Demo data
  hooks/        Shared React hooks (useSettings)
  state/        Milestone reducer
  utils/        Shared utilities, token encryption, export functions
  types.ts      Shared TypeScript types
```

### Tech stack

- React 18 + TypeScript + Vite
- MUI v7 with the Redgate Honeycomb theme
- Vitest + Testing Library for unit tests
