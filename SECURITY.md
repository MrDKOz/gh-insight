# Security Policy

## Supported versions

Only the latest release is actively maintained. Please update to the current version before reporting a vulnerability.

| Version | Supported |
|---------|-----------|
| 2.3.x (latest) | Yes |
| 2.2.x | No |
| < 2.2 | No |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Use GitHub's private vulnerability reporting instead:

1. Go to the [Security tab](https://github.com/MrDKOz/gh-insight/security) of this repository.
2. Click **"Report a vulnerability"**.
3. Fill in the form with as much detail as possible.

### What to include

- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The version of GH Insight affected (web app, Electron, or both)
- Any relevant environment details (OS, browser, Electron version)

### What to expect

- **Acknowledgement** within 5 business days
- **Status update** (confirmed, investigating, or not a vulnerability) within 10 business days
- A fix and coordinated disclosure once the issue is resolved

Reporters who responsibly disclose a genuine vulnerability will be credited in the release notes unless they prefer to remain anonymous.

## Scope

This project handles GitHub Personal Access Tokens (PATs) entered by the user. These are encrypted at rest using SubtleCrypto (`src/utils/tokenCrypto.ts`) — the AES-GCM key is stored in IndexedDB and the encrypted payload is persisted in `localStorage`. Tokens are only ever transmitted to GitHub's APIs (REST and GraphQL at `api.github.com`).

Areas of particular interest:

- Token storage and encryption
- Content Security Policy bypasses
- XSS in the rendered Gantt or chart views
- Electron-specific attack surface (context isolation, node integration, IPC)
- URL validation bypasses in `safeUrl()` (`src/utils/displayUtils.ts`)
