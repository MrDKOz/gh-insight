# GitHub Work Visualiser

**Live:** [mrdkoz.github.io/GitHubWorkVisualiser](https://mrdkoz.github.io/GitHubWorkVisualiser/)

> **A note on this project:** This is an experiment in AI-driven development, built during my 10% / L&D time at Redgate. The goal was to learn how Claude works by attempting to build a genuinely usable application without writing a single line of code manually — using Claude Code to handle everything from architecture decisions to implementation. The application you see here is the result of that process. I think it's only fair to be upfront about that, both to set expectations and to give an honest account of what AI-assisted development looks like in practice.

A browser-based dashboard for analysing GitHub milestone progress. Point it at any public or private repository, select one or more milestones, and explore the data across seven interactive views — then export what you need in the format you need it.

## What can it do?

### Seven views

- **Gantt** — interactive horizontal bar timeline for every issue and PR, with scroll-wheel zoom and resizable labels
- **Burndown** — daily open issue count plotted over the milestone's lifetime
- **Cycle Time** — scatter plot of days from creation to close per item, with median and mean reference lines
- **Velocity** — weekly stacked bar chart of closed issues and merged/closed PRs
- **Cumulative Flow** — running totals of created vs completed items over time
- **Contributors** — per-author breakdown of issues and pull requests
- **List** — sortable table of all items with status, dates, labels, assignees, and duration

### Export everything

Every view can be exported. Data exports: **CSV**, **Excel (XLSX)**, **Markdown**, and **PDF**. Visual exports: **PNG** of the current view, or a full-resolution PNG of the entire Gantt timeline.

### More features

- **Multi-milestone** — load several milestones at once and view them together, colour-coded by milestone
- **Filters** — show/hide by type and status; date range filters on creation and close date
- **Shareable URLs** — current milestone selection, active view, and all filters are encoded in the URL; the token is never included
- **Colorblind mode** — alternative Okabe-Ito colour palette across all charts and views
- **Demo mode** — try the app without a token using built-in sample data
- **Desktop app** — available for Windows, macOS, and Linux via Electron

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

## Common questions

**How do I create a Gantt chart from GitHub milestones?**
Enter your GitHub token, select a repository, choose one or more milestones, and switch to the Gantt view. Each issue and PR appears as a horizontal bar spanning its creation to close date. Zoom with the scroll wheel, resize the label column, and export to PNG or PDF when you're done.

**How do I export GitHub milestone data to Excel or CSV?**
Open the List view or any chart view, click the export button in the toolbar, and choose your format — CSV, Excel (XLSX), Markdown, or PDF. The Gantt view additionally supports full-timeline PNG export.

**Can I track sprint velocity from GitHub issues?**
Yes. The Velocity view shows a weekly stacked bar chart of closed issues and merged/closed pull requests, giving you a clear picture of throughput over time.

**Can I see cycle time for GitHub issues?**
Yes. The Cycle Time view plots each closed item as a dot at its days-from-creation-to-close, with median and mean reference lines overlaid.

**Does it support multiple milestones at once?**
Yes. Select any number of milestones from the same repository and all seven views update to show the combined data, with each milestone colour-coded so you can compare sprints or releases side by side.

**Does it work with private repositories?**
Yes. Use a fine-grained GitHub PAT with read-only permissions on Issues, Pull Requests, Contents, and Metadata. The token is encrypted in your browser and never sent anywhere except directly to `api.github.com`.

## Local development

```bash
npm install
npm run dev            # start browser dev server (http://localhost:5173)
npm test               # run unit tests (Vitest)
npm run lint           # lint (zero warnings)
npm run build          # type-check + production web build
npm run preview        # preview the production build locally
```

### Electron (desktop app)

```bash
npm run electron:dev   # start Electron app in dev mode (hot-reload)
npm run build:electron # type-check, build renderer, and package the app
```

## CI / CD

### Continuous integration

Every push and pull request runs **lint**, **type-check**, and **tests** via the CI workflow. All three must pass before a PR can be merged.

### Web deployment (GitHub Pages)

Every push to `main` automatically builds and deploys the web app to GitHub Pages. No version bump is involved — the live site always reflects the latest state of `main`.

### Releasing (Electron builds)

Releases are triggered by merging a PR that carries one of these labels:

| Label | Effect |
|---|---|
| `release:patch` | Bumps the patch version (e.g. 2.0.21 → 2.0.22) |
| `release:minor` | Bumps the minor version (e.g. 2.0.21 → 2.1.0) |
| `release:major` | Bumps the major version (e.g. 2.0.21 → 3.0.0) |

When a labelled PR is merged into `main`, the release workflow:

1. Runs tests as a final gate
2. Bumps the version in `package.json`, commits it, and pushes a `vX.Y.Z` tag
3. Builds the Electron app in parallel for macOS, Windows, and Linux
4. Publishes a GitHub release with the built artefacts attached

PRs without a release label merge normally with no version bump and no Electron build.

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
