# GH Insight

[![CI](https://github.com/MrDKOz/gh-insight/actions/workflows/ci.yml/badge.svg)](https://github.com/MrDKOz/gh-insight/actions/workflows/ci.yml)
[![macOS (arm64)](https://img.shields.io/github/v/release/MrDKOz/gh-insight?label=macOS+%28arm64%29&logo=apple&color=black)](https://github.com/MrDKOz/gh-insight/releases/latest)
[![Windows](https://img.shields.io/github/v/release/MrDKOz/gh-insight?label=Windows&logo=windows&color=0078d4)](https://github.com/MrDKOz/gh-insight/releases/latest)
[![Linux](https://img.shields.io/github/v/release/MrDKOz/gh-insight?label=Linux&logo=linux&logoColor=white&color=e95420)](https://github.com/MrDKOz/gh-insight/releases/latest)

**Live:** [dkoz.me/gh-insight](https://dkoz.me/gh-insight/)

> **A note on this project:** This is an experiment in AI-driven development, built during my 10% / L&D time at Redgate. The goal was to learn how Claude works by attempting to build a genuinely usable application without writing a single line of code manually — using Claude Code to handle everything from architecture decisions to implementation. The application you see here is the result of that process. I think it's only fair to be upfront about that, both to set expectations and to give an honest account of what AI-assisted development looks like in practice.

A browser-based dashboard for analysing GitHub milestone progress. Point it at any public or private repository, select one or more milestones, and explore the data across seven interactive views — then export what you need in the format you need it.

## Features

- **Gantt** — interactive horizontal bar timeline for every issue and PR, with scroll-wheel zoom and resizable labels
- **Burndown** — daily open issue count plotted over the milestone's lifetime
- **Cycle Time** — scatter plot of days from creation to close per item, with median and mean reference lines
- **Velocity** — weekly stacked bar chart of closed issues and merged/closed PRs
- **Cumulative Flow** — running totals of created vs completed items over time
- **Contributors** — per-author breakdown of issues and pull requests
- **List** — sortable table of all items with status, dates, labels, assignees, and duration
- **Export** — CSV, Excel (XLSX), Markdown, and PDF for data; PNG for charts and the full Gantt timeline
- **Multi-milestone** — load several milestones at once, colour-coded by milestone
- **Filters** — by type, status, and date range
- **Shareable URLs** — milestone selection, active view, and filters encoded in the URL (token never included)
- **Colorblind mode** — Okabe-Ito colour palette across all charts and views
- **Demo mode** — try the app without a token using built-in sample data
- **Desktop app** — available for Windows, macOS, and Linux via Electron

## Using the live app

Visit **[dkoz.me/gh-insight](https://dkoz.me/gh-insight/)** — no installation needed.

You will need a GitHub Personal Access Token to load real data. A fine-grained token with read-only permissions on **Metadata**, **Contents**, **Issues**, and **Pull requests** is recommended.

[Create a fine-grained PAT on GitHub](https://github.com/settings/personal-access-tokens/new)

### Privacy and security

- Your token is encrypted with AES-GCM (256-bit, Web Crypto API). The ciphertext is stored in `localStorage`; the encryption key lives in IndexedDB and never leaves your browser.
- All API calls go directly from your browser to `api.github.com` over HTTPS. No data passes through any third-party server.
- The token is never written to the URL. Clearing your browser storage removes everything.

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

Every push and pull request runs **lint**, **type-check** (renderer + Electron main), **unit tests**, and a **dependency audit**. Playwright end-to-end tests run in a second job after CI passes.

A separate **Electron CI** workflow runs on PRs that touch Electron-related paths — it builds the renderer in Electron mode and runs Playwright tests against the built, unpackaged Electron app.

### Web deployment and PR previews

After CI passes on `main`, the site is deployed to GitHub Pages. Opening or updating a PR triggers a preview build at `/gh-insight/pr-{N}/`; a bot comments the URL on the PR and the preview is removed when the PR closes.

### Releasing (Electron builds)

Run `npm version patch|minor|major` locally, commit the bump as part of your PR, and add the matching `release:patch`, `release:minor`, or `release:major` label before merging. When the labelled PR merges, the release workflow tags the commit, builds the Electron app for macOS, Windows, and Linux, and publishes a draft GitHub release with the artefacts attached.

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
  types/        Shared TypeScript types (GitHubTypes, AppTypes, SettingsTypes, FilterTypes)
```

### Tech stack

- React 19 + TypeScript + Vite
- MUI v7 with a custom light/dark theme
- Vitest + Testing Library for unit tests
