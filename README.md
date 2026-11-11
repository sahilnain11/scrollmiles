# ScrollMiles

**Your digital life, measured.**

A playful, privacy-first Chrome extension that turns everyday scrolling into a small personal journey. This is the first working beta, not the full product described in [the original context](ScrollMiles_Project_Context.md).

## Try it in Chrome

The production extension has already been built locally.

1. Open Chrome and visit **chrome://extensions**.
2. Enable **Developer mode** at the top right.
3. Choose **Load unpacked** and select the **.output/chrome-mv3** directory inside this project. In the macOS picker, use **Cmd + Shift + G** and enter this project's absolute folder path followed by `/.output/chrome-mv3` if hidden folders aren't visible.
4. Pin ScrollMiles from Chrome's Extensions menu and open it.
5. Enter a website's exact hostname, such as **en.wikipedia.org**, and select **+**. Accept Chrome's website-access prompt.
6. Open that website in a normal tab and scroll. Totals update within a few seconds. If an already-open page does not start collecting, reload it once.
7. Select **Your full story** for the dashboard. Download your Wrapped as a PNG, or open **Privacy & settings** to manage access.

Nothing is tracked until a website is enabled. HTTPS and HTTP are separate; so are subdomains. For example, enabling `https://example.com` does not enable `https://www.example.com`. Chrome host permissions cover all paths and ports for a hostname. Paste a URL if convenient; paths, credentials, query strings, and fragments are not saved (credential-bearing URLs are rejected).

### One permission for all supported websites

Open **Privacy & settings → All supported websites → Set up all-site access**. Read the sensitive-site warning, then choose **Allow all supported websites** and accept Chrome's prompt. This is **off by default** for both new and existing installations. No mandatory install-time website access has been added.

This explicitly enables HTTP/HTTPS websites and subdomains in normal browsing. Only scrolling in the visible, focused page is collected; watching a video alone is not measured. Chrome-protected pages and incognito remain excluded. All-site mode includes sensitive websites unless you exclude them, so use selected-site mode when you want the narrowest access.

In all-site mode, the website form adds **exclusions**, not grants. Exclusions are exact scheme/hostname controls inside ScrollMiles; they do not revoke Chrome's broad host permission. Exclude both `https://example.com` and `https://www.example.com` separately when needed. Pausing still stops collection everywhere.

**Turn off all-site access** revokes wildcard and covered website permissions and returns to selected-site mode with **no websites enabled**. Earlier totals and exclusions remain. Enable individual websites again afterwards. External partial broad-permission revocation also fails closed to no enabled sites rather than silently keeping broad mode active.

For YouTube in selected-site mode, enable **https://www.youtube.com** if that is the hostname of the video page. The full page path, video identifier, and comment position do not affect permission matching. Root scrolling and ordinary nested comments count; embedded frames and custom/shadow scrollers are not guaranteed. Live YouTube compatibility still needs a real-site check—local fixtures do not prove every YouTube layout works.

### After rebuilding: reload the extension

Rebuilding files does not replace Chrome's currently running background worker. If a new control reports **Unknown request** or asks you to reload, open **chrome://extensions**, click **Reload** on ScrollMiles, close any old ScrollMiles dashboard/settings tabs, and reopen it from the toolbar. Reloading preserves extension-managed settings and history; **do not remove and reinstall** as a troubleshooting shortcut. Reload the website tab if its collector still belongs to the old extension context.

The settings page checks the worker's advertised all-site support before offering a new broad-permission request. An older worker without that capability produces explicit reload instructions, not a permission request it cannot process. No automatic reload or permission grant is performed.

### Optional website insights

Open **Privacy & settings → Website insights → Set up website insights**. The confirmation explains that exact scheme/hostnames will be stored with local hourly scrolling totals for up to 90 days. Choose **Enable website insights** only if you want that extra detail. It is **off by default**, including on existing installs, and requires no new Chrome permission.

The dashboard adds a **Your scrolling, site by site** panel: choose a site to see its distance, active scrolling time, burst starts, busiest local hour, hourly chart, and seven-day trend. Today and Last 7 days apply to site ranking/hourly totals; the trend always shows seven days. Charts have keyboard-accessible exact-value tables. No examples are inserted as production activity.

Only scrolling after opt-in is attributed; old anonymous totals cannot be split retrospectively. Site totals may therefore be lower than global totals. Exact schemes and subdomains remain separate. A local hour combines repeated DST hours; timezone travel does not retroactively regroup records. A continuous burst is counted where it starts; its event-to-event active time is split at hour/day boundaries. Clock/timezone discontinuities break the burst instead of inventing duration.

**This is scrolling time, not time spent on a website.** Watching a YouTube video without scrolling adds no distance or active scrolling time. Session duration, attention scores, direction-change analytics, and browser-active time are not implemented.

**Turn off & delete website insights** erases all detailed site/hour history but keeps anonymous totals. **Delete website history** erases all retained details for one site, also without subtracting combined totals. New scrolling can be recorded again while opted in. Permission removal/exclusion stops future collection but does not delete existing details; use the deletion controls separately. Global Delete history clears both stores and pauses, retaining settings/preferences. Epoch changes and durable deletion intent prevent stale messages or worker interruption from silently restoring deleted details. Wrapped stays hostname-free.

Reload the extension and close old dashboard/settings tabs after updating. Reload already-open website tabs if they still contain an older daily-only collector. IndexedDB upgrades from v1 to v2 without removing anonymous history; no website is inferred for old data.

### VS Code integrated-browser preview

The static production pages can be served locally for UI inspection inside VS Code. This is **not the installed extension**: the integrated browser does not provide ScrollMiles' Chrome extension storage, host permissions, background worker, or collector. Dashboard/settings correctly report unavailable statistics rather than inventing activity. The privacy notice remains readable without extension APIs.

Use the real Chromium integration suite for permission, aggregation, pause, deletion, and lifecycle checks. UI preview does not exercise your installed Chrome extension or diagnose its currently loaded worker version.

## What works

- Vertical scrolling distance in CSS pixels, counting both directions.
- Scroll bursts and estimated active scrolling duration.
- Today's totals and a rolling seven-local-calendar-day summary.
- Real zero-state UI: no fabricated data or invented improvement percentages.
- Dark-first popup, full-page dashboard, light theme, and privacy settings.
- Branded Chrome toolbar icons and an offline, bundled privacy notice.
- Explicit loading failures, stale-data warnings, and retry controls instead of misleading zero totals.
- Local 1200 × 1200 PNG Wrapped cards with no website identifiers.
- Per-host opt-in, immediate global pause, permission removal, and delete-history controls.
- Optional all-supported-websites opt-in with a separate confirmation, broad-permission revocation, and exact-host exclusions.
- Separate opt-in website/hour scrolling aggregates, per-site active scrolling and burst starts, hourly breakdowns, seven-day trends, and detailed-history deletion.
- IndexedDB history with atomic, retry-safe checkpoints and 90-day retention.
- No account, backend, cloud synchronization, third-party analytics, or production network requests.

Not implemented: website usage duration, session analytics, morning/night insights, achievements, notifications, mobile tracking, physical-activity integrations, or Web Store publishing. The first beta deliberately validates scrolling and sharing before expanding scope.

## Measurement definitions

**Distance** is cumulative absolute vertical scroll displacement. Down 1,000 CSS px and up 500 CSS px produces **1,500 CSS px**. Nested containers are measured separately; embedded iframe content is not tracked.

**Displayed metres/kilometres** are screen-equivalent estimates using 96 CSS px per inch: approximately **3,779.53 CSS px per metre**. They are not calibrated monitor distance, physical finger travel, exercise, or literal miles. Browser zoom does not turn CSS pixels into physical measurements. Raw CSS pixels remain visible in the dashboard and accessible daily table.

**A burst** is a sequence of nonzero scroll events separated by less than two seconds. A gap of two seconds or more starts another burst. Separate gestures within that interval are one burst.

**Active scrolling time** sums gaps between events in the same burst. Idle gaps and the tail after the last event are excluded. This intentionally avoids the original context document's proposed `min(gap, 2000)` formula, which would add two seconds after a long inactive gap. A single isolated scroll event contributes distance and a burst, but zero duration.

Collection requires an enabled website, a visible document, and document focus. Switching tabs or leaving the browser stops measurement and breaks the burst. The extension does not measure total browser usage or psychological attention span; idle permissions are unnecessary for this limited slice.

## Reliability and known limits

- Checkpoints contain **cumulative counters**, a random stream ID, sequence, and data epoch. History and deduplication commit in one IndexedDB transaction. Retries or service-worker restarts do not double count accepted data.
- Settings and policy changes are serialized by the service worker. Deletion changes the epoch before removing history; stale messages cannot restore deleted totals even after tracking resumes.
- Collection flushes at most once per second while scrolling, with three bounded exponential-backoff retries and best-effort flush on blur, hide, or navigation. **An abrupt tab close, browser crash, or extension update can lose the last unacknowledged second, or more during storage errors.** This is not a lossless audit log.
- Policy changes reset collector buffers. Pause, site changes, and deletion prioritize stopping collection over preserving the last unsent batch.
- Per-document daily buffers and deduplication retention are bounded to 90 calendar days. Clock rollback/timezone changes may temporarily defer future-labeled checkpoints. Existing totals retain the local calendar date used at collection; history is not retroactively moved to a new timezone. DST/timezone travel need broader manual validation.
- Existing checkpoints for previous days are safe to resend. Once a record ages beyond retention it is dropped; no unbounded message queue or continuous service-worker timer is used.
- Automatic/programmatic scrolling, scroll anchoring, and some layout changes may count as movement. Distinguishing physical user input reliably is not claimed.
- Standard root scrolling and nested panels are supported. A nested panel first observed after movement starts may miss its initial delta; pointer/wheel/touch interactions prime its geometry without reading content. Custom canvas feeds, shadow-root scrollers, virtualized panels, PDFs, and browser-protected pages need manual compatibility testing or may be unsupported.
- Chrome's Web Store and browser-internal pages cannot be tracked. Incognito use is prohibited in the manifest, not just switched off in the UI.
- Removing a website stops future collection and revokes its host permission. Existing anonymous totals remain; optional site details remain until their dedicated deletion control or global deletion is used.
- Delete history removes statistics and checkpoints and pauses collection. It preserves website choices, exclusions, all-site preference/permissions, and theme. Remove websites or turn off all-site access separately to revoke access, or uninstall to remove all extension data. A PNG already downloaded is outside extension storage and must be deleted separately.
- Default history remains anonymous combined totals. If Website insights is enabled, a separate local store contains exact scheme/hostname with date/hour scrolling aggregates—not URLs, page visits, or browsing sessions. Random document/bucket IDs and cumulative checkpoint counters contain no hostnames, page titles, paths, or content. Settings also retain the separate insights choice/start time.

## Development

Requires **Node.js 22.12+** and npm. Dependencies are locked in [package-lock.json](package-lock.json).

| npm script | Purpose |
| --- | --- |
| `npm install` | Install dependencies and generate WXT types |
| `npm run dev` | WXT development mode |
| `npm run assets` | Regenerate local 16/32/48/128 px PNG icons from the bundled SVG |
| `npm run build` | Create the Chrome MV3 production extension |
| `npm run typecheck` | Strict TypeScript validation |
| `npm test` | Vitest measurement, storage, analytics, authorization, privacy, and lifecycle tests |
| `npm run test:e2e` | Run Chromium integration tests against the production build |
| `npm run zip` | Package the production extension |

Before integration tests, run the production build and install Playwright's browser with `npx playwright install chromium` (already installed in the current environment). Tests use a temporary browser profile and a local-only HTTP fixture. Chromium's native permission bubble is not a page DOM element: the tests pre-approve the fixture host through **chrome://extensions**, then exercise the real UI and `chrome.permissions.request`. No extension API is mocked in browser tests. Separate component tests simulate denied, blocked, and throwing permission APIs; native permission-prompt acceptance/denial still needs a manual check.

The browser suite also verifies a genuine service-worker stop/wake, packaged icon dimensions, offline privacy navigation, optional all-site mode/exclusions/revocation, exact-host boundaries, local infinite-feed/SPA fixtures, wheel and keyboard inputs, two actual browser windows, navigation, deletion cancellation, export persistence, real 200% browser zoom, and recovery from an incompatible database in a disposable profile. Fixtures map test domains to loopback, and off-fixture page/worker HTTP attempts are logged, blocked, and fail the suite. A real bug on ordinary non-localhost HTTP pages was fixed: collector IDs use the UUID library's cryptographic fallback where `crypto.randomUUID()` is unavailable.

Collector tests simulate midnight before flush, wall-clock rollback, bounded retries/recovery, idle behavior, and immediate epoch/exclusion changes. Calendar tests run the actual metrics module in isolated processes with New York DST and multiple timezones; they do not change the Mac's clock. These checks complement—not replace—the remaining manual checks in [the beta checklist](docs/BETA_CHECKLIST.md). See the [dated beta results](docs/BETA_RESULTS.md) for what was and was not verified. Screenshots remain in ignored local test output.

Development mode may need a supported local Chrome installation and WXT's development runner. WXT adds localhost tooling in dev mode. Production has a restrictive `connect-src 'none'` policy and no mandatory host permissions. Always inspect the production manifest before distribution.

## Project map

| Location | Responsibility |
| --- | --- |
| [entrypoints/background.ts](entrypoints/background.ts) | Authorization, optional host registration, policy changes, serialized aggregation |
| [entrypoints/content.ts](entrypoints/content.ts) | Geometry-only scrolling, focus gating, batching, bounded retries |
| [src/tracking/ScrollTracker.ts](src/tracking/ScrollTracker.ts) | Pure scroll/burst/duration algorithm |
| [src/storage/database.ts](src/storage/database.ts) | Versioned IndexedDB schema, atomic checkpoints, retention |
| [src/storage/settings.ts](src/storage/settings.ts) | Local settings and policy epoch |
| [src/analytics/metrics.ts](src/analytics/metrics.ts) | Local calendar grouping and display formatting |
| [src/analytics/sites.ts](src/analytics/sites.ts) | Pure per-site ranking, hour summaries, and seven-day reporting |
| [src/tracking/HourlyScrollTracker.ts](src/tracking/HourlyScrollTracker.ts) | Continuous-burst attribution across hour/day boundaries |
| [src/components/SiteInsights.tsx](src/components/SiteInsights.tsx) | Explicit detailed-history consent, live site analysis, accessible charts, and deletion |
| [src/components/App.tsx](src/components/App.tsx) | Shared popup/dashboard/settings UI |
| [src/components/PrivacyPage.tsx](src/components/PrivacyPage.tsx) | Offline privacy notice, independent of historical database/worker availability |
| [src/privacy/policy.ts](src/privacy/policy.ts) | Single source of privacy notice text; publisher/contact review required before public release |
| [assets/brand/icon.svg](assets/brand/icon.svg) | Original brand icon source, rasterized locally during build |
| [src/wrapped/CardRenderer.ts](src/wrapped/CardRenderer.ts) | Local Canvas PNG generation |
| [tests](tests) | Unit, authorization, storage and real-browser checks |

WXT + React + strict TypeScript + Tailwind CSS. `idb` is the small typed wrapper around IndexedDB; `uuid` creates random collector IDs on HTTP as well as HTTPS. Lucide supplies bundled SVG icons. The seven-bar chart is accessible HTML/CSS with a data table, so a charting library is unnecessary at this stage. Vitest and Playwright are development-only dependencies. No empty future modules, application server, or unnecessary infrastructure.

## Before a public beta

- Test real infinite feeds, nested panels, browser sleep/wake, zoom, DST, timezone travel, rapid navigation, and multiple windows.
- Exercise native permission acceptance and denial manually.
- Icons and an in-app privacy notice are included. Before distribution, approve publisher/contact details, a public privacy-policy URL, store screenshots, and accurate Chrome Web Store data disclosures.
- Review extension accessibility and performance on low-powered devices.
- Decide distribution/license terms. This repository is private by default in intent; no public-use license has been assigned.
- If using employer-provided Copilot Business, confirm organizational policy permits personal-project development.

See [the beta checklist](docs/BETA_CHECKLIST.md) for automated coverage, native-permission checks, the compatibility matrix, and public-distribution blockers. This work does not publish or submit the extension.