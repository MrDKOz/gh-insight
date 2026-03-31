# GitHub Work Visualiser

**Live:** [mrdkoz.github.io/GitHubWorkVisualiser](https://mrdkoz.github.io/GitHubWorkVisualiser/)

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

## Using the live app

Visit **[mrdkoz.github.io/GitHubWorkVisualiser](https://mrdkoz.github.io/GitHubWorkVisualiser/)** — no installation needed.

You will need a GitHub Personal Access Token to load real data. A fine-grained token with the following read-only permissions is recommended:

| Permission | Level |
|---|---|
| Metadata | Read |
| Contents | Read |
| Issues | Read |
| Pull requests | Read |

[Create a fine-grained PAT on GitHub](https://github.com/settings/personal-access-tokens/new)

### Privacy and security

- Your token is encrypted with AES-GCM (256-bit, Web Crypto API). The ciphertext is stored in `localStorage`; the encryption key lives in IndexedDB and never leaves your browser.
- All API calls go directly from your browser to `api.github.com` over HTTPS. No data passes through any third-party server.
- The token is never written to the URL. Clearing your browser storage removes everything.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Electron (desktop app)

To run the Electron app in dev mode:

```bash
npm run electron:dev
```

This starts Vite in Electron mode, then launches the desktop window. Hot-reload works the same as the browser dev server.

To build a distributable:

```bash
npm run build:electron
```

This type-checks the Electron main process, builds the renderer, and packages the app with `electron-builder`. Output goes to `dist/`.

## Development commands

```bash
npm run dev            # start browser dev server
npm run electron:dev   # start Electron app in dev mode
npm test               # run unit tests (Vitest)
npm run build          # type-check + production web build
npm run build:electron # build distributable Electron app
npm run preview        # preview the production build locally
```

## Releasing

Releases are triggered by pushing a version tag. The CI workflow builds and publishes installers for Windows, macOS, and Linux automatically.

```bash
# Bump the version in package.json first, then:
git tag v1.2.3
git push origin v1.2.3
```

The `release.yml` workflow runs tests, builds the Electron app on all three platforms, and uploads the installers to a GitHub Release.

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

- React 19 + TypeScript + Vite
- MUI v7 with the Redgate Honeycomb theme
- Vitest + Testing Library for unit tests
