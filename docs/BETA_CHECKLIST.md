# ScrollMiles beta checks

This is a release-readiness checklist, **not permission to publish**. The first beta is limited to scrolling, daily/seven-day reporting, local Wrapped, and privacy controls. No license or public publisher/contact details have been selected.

## Latest local execution

See [BETA_RESULTS.md](BETA_RESULTS.md) for the dated results, actual environment, regression fixed, evidence, and checks that still need a human/device. The local automated matrix now covers many of the steps below; those rows remain useful for a native Chrome/manual cross-check. Do not equate local fixtures or simulations with live-site, physical-device, or multi-platform testing.

## Automated coverage

The current suites cover:

- Pure distance/burst/time measurement and zero-data calendar reporting.
- Atomic cumulative checkpoints, retries, out-of-order delivery, retention, concurrent documents, and persistence.
- Sender/frame/host/incognito validation, permission requirements, metadata allowlisting, pause, deletion epochs, and external revocation.
- Denied, rejected, and synchronously failing permission requests through component tests with mocked Chrome APIs.
- Failed initial loads, explicit retry, stale-data warnings, and preservation of previous totals.
- Real Chromium onboarding with a pre-approved fixture host; no extension APIs are mocked in this browser suite.
- Actual root/nested scrolling, hidden/unfocused and paused movement, PNG export, theme changes, and full browser restart.
- Actual service-worker stop/wake through Chromium's lifecycle protocol while an existing content script remains alive; no reset or duplicate totals.
- Bundled PNG dimensions, optional-only host permissions, no static all-site scripts, and disabled incognito support.
- Optional all-site opt-in, denial/cancellation, safe migration, broad-grant revocation, partial external revocation, and exact-host exclusions on already-open tabs.
- Exact host versus www in both directions, HTTP compatibility, local infinite-feed/SPA fixtures, wheel/keyboard scrolling, resized panels, reload/navigation, two actual Chrome windows, removal while tracking, cancelled deletion, and downloaded-file persistence.
- Actual 200% Chrome zoom, keyboard skip-navigation/period/data-table controls, iframe exclusion, logged/blocked off-fixture HTTP attempts, and a real unavailable-database/retry check in a disposable profile.
- Simulated collector midnight/clock rollback, bounded retry recovery, no idle polling, and actual calendar functions in isolated New York DST/multiple-timezone processes.
- Separate opt-in website insights: preserving v1→v2 migration with no backfill, sender-derived site/hour totals, continuous-burst boundary attribution, anonymous/detail/checkpoint atomicity, detailed opt-out erasure, per-site deletion and pending-delete recovery, and real two-site dashboard accessibility in both themes.
- Offline privacy notice, keyboard skip-navigation, narrow-screen overflow, and automated WCAG 2 A/AA and WCAG 2.1 A/AA checks on the desktop dark/light dashboard, light popup, light settings, and dark privacy notice.

Automated accessibility checks do **not** prove complete accessibility conformance. Manual keyboard, screen-reader, zoom, contrast, and real permission-dialog checks are still required.

## Manual smoke test — a clean Chrome profile

Use the production build, not WXT development mode. Never enable a sensitive website just to test it.

| Check | Steps | Expected |
| --- | --- | --- |
| First install | Load the unpacked production extension; open popup | Branded toolbar icon, genuine zero state, no tracking permission granted |
| Decline access | Enter a harmless website; decline Chrome's native prompt | Clear denial, no enabled website, no counters; can retry |
| Accept access | Submit again and approve | Only that scheme/hostname enabled; normal browsing starts collecting |
| All-site opt-in | In settings, read the warning, allow all supported sites, and approve Chrome's prompt | Explicit optional HTTP/HTTPS access including subdomains; no automatic enable on install/update |
| Exclusions and revocation | Exclude exact sensitive hosts; then turn off all-site access | Excluded pages stop collecting; switching off revokes wildcard/covered grants and returns to no enabled websites |
| Website insights consent | Set up and confirm, scroll, inspect site/hour values; turn off insights | Off by default; no old-history backfill; new details include exact hosts; opt-out erases details while anonymous totals remain |
| Detailed site deletion | Cancel then confirm Delete website history | Cancel retains details; confirm deletes the site's retained details, not anonymous totals; pause/exclude separately to stop new details |
| Exact host | Enable an apex domain but visit its www subdomain, then reverse | Unapproved subdomain is not tracked; UI explains the distinction |
| Pause | Pause, scroll, resume, scroll again | Paused movement never contributes; no distance jump on resume |
| Remove website | Remove an enabled host; continue scrolling its already-open tab | Permission revoked; no future increments; previous anonymous totals remain |
| Delete | Choose Delete history, cancel; then confirm | Cancel preserves data; confirm removes totals/checkpoints and pauses; old tabs cannot restore history |
| Wrapped | Download a card; inspect it; clear history | Only selected totals/date branding in PNG; file remains until manually deleted |
| Accessibility | Keyboard-only navigation, VoiceOver, browser zoom 200% | Named controls, visible focus, selected period announced, readable data table and errors |
| Database unavailable | Simulate storage failure in a disposable profile only | No fake zero stats; retry control; privacy notice remains readable |

Native Chrome permission bubbles are **not** clicked by Playwright. Component denial tests exercise application behavior; the manual decline/accept checks above must still be done.

## Compatibility matrix — local fixtures covered; device/live-site checks remain

- Root page and nested panels; actual long/infinite feeds and single-page navigation.
- Scroll-wheel, trackpad, scrollbar dragging, keyboard scrolling, and touch-capable supported devices.
- Multiple tabs and windows; focus leaving Chrome; tab discarding, page reloads, rapid navigation, and browser sleep/resume.
- Browser zoom and resized panels. CSS pixels stay canonical; no physical-distance claim.
- Local midnight, a DST transition, manual timezone change, and a clock moving backwards. Historical dates are not retroactively regrouped.
- Unsupported iframe, custom canvas, shadow-root, PDF, and protected-page behavior. Do not promise universal compatibility.
- Low-powered hardware: no perceptible page lag, bounded buffers, and no background polling.

## Public distribution blockers

- [ ] Run and record the manual matrix on supported Chrome versions and operating systems.
- [ ] Confirm the publisher identity and a real support/privacy contact route with the owner. Do not invent an email address.
- [ ] Review the [privacy notice source](../src/privacy/policy.ts) against the exact release behavior; add publisher/contact information and approve the wording.
- [ ] Host the approved privacy notice on an owner-approved public URL if required by the store. A packaged extension page is not a public policy URL; no hosting is set up here.
- [ ] Review Chrome Web Store data disclosures using the store's then-current definitions. Explain locally processed activity and minimal enabled-host settings accurately; do not assume “local-only” automatically answers every disclosure question.
- [ ] Justify `storage`, `scripting`, and optional per-site HTTP/HTTPS host access. No tabs/idle/all-site mandatory permissions are needed for this slice.
- [ ] Include the optional all-HTTP/HTTPS choice, sensitive-site warning, exact-host exclusions, and broad-access revocation in permission/disclosure review. Access is still never mandatory at installation.
- [ ] Prepare store screenshots using real, consented activity—or clearly label test imagery as illustrative, never as measured user activity.
- [ ] Final production manifest and dependency/security review; no external assets, analytics, or production network requests.
- [ ] Confirm distribution and licensing decisions. Do not add a license without authorization.
- [ ] Obtain explicit permission to submit or publish. Nothing in this checklist submits the extension.

## Reproducible local checks

Run the documented npm scripts in [the README](../README.md#development): typecheck, unit/UI tests, production build, browser tests, and dependency audit. Browser-test reports and screenshots stay in ignored local test output. Icons are generated from the [local SVG source](../assets/brand/icon.svg) by the build; the generator's Sharp dependency is development-only.