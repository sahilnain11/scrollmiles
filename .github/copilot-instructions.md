# ScrollMiles

ScrollMiles is a playful, privacy-first digital-life tracker. Tagline: **Your digital life, measured.** Read the product context and README before expanding scope.

## Current beta

- Chrome MV3, WXT, React, strict TypeScript, Tailwind CSS, npm.
- Scrolling distance, bursts, active scrolling time, a rolling seven-day summary, local PNG Wrapped, and privacy controls.
- Optional Website insights adds exact-site/hour scrolling aggregates and seven-day trends, only after explicit opt-in. It is off by default for new and existing installs. No backfill or browser-usage/session timing.
- Future website usage/session insights are not part of this first slice. Do not invent statistics or populate production UI with sample activity.

## Privacy boundaries

- Local-only. No backend, accounts, remote assets, network calls, third-party analytics, page contents, passwords, keystrokes, search queries, full URLs, or incognito support.
- Request individual hosts or optional all-HTTP/HTTPS access only from an explicit user gesture. All-site mode is off by default; preserve its confirmation, exact-host exclusions, pause, and broad-grant revocation. Keep content entrypoint `matches: []` with runtime registration: WXT otherwise adds those matches as mandatory host permissions.
- Store only minimal exact scheme/hostname settings. Global totals and checkpoints never contain site identifiers. A separate site/hour aggregate store may contain exact scheme/hostnames only while Website insights is explicitly enabled; never page paths, full URLs, queries, titles, or content. Derive sites from validated Chrome senders, not checkpoint payloads.
- Preserve insights opt-out erasure, per-site detailed deletion, durable pending-deletion recovery, and anonymous total preservation. Wrapped remains site-free. Commit global totals, site/hour deltas, and deduplication in one transaction.
- Preserve pause, website removal, deletion, and stale-message epoch protections.
- Inspect the generated production manifest: no mandatory hosts or static all-site content scripts.

## Engineering

- Separate collection, aggregation, persistence, analytics, UI, and export. Use pure functions for measurement where possible.
- Never rely on long-running service-worker timers or permanent in-memory worker state.
- Cumulative checkpoints and aggregate changes must commit atomically and be idempotent. Validate sender, frame, permission, epoch, payload and numeric bounds.
- Bound retries, buffers, and retention. Do not replace indexed transactions with read-modify-write races.
- Preserve strict TypeScript; do not add `any` or disable checks to fix problems.
- Inspect files before editing. Add focused regression tests for tracking and privacy changes.
- Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` after changes. Browser tests use the production build and a temporary Chromium profile.

## Product and UI

- Dark-first with light-theme support; minimal, warm, playful, and guilt-free.
- CSS pixels are canonical. Label metres/kilometres screen-equivalent estimates, never physical finger travel or exercise.
- Describe behavioral patterns honestly; never claim to diagnose attention.
- Keep zero-data, errors, permission denial, keyboard navigation, reduced motion, and accessible chart values usable.
- No license has been selected; don't add one or publish without authorization.