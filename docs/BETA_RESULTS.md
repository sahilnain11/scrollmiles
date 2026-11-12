# Beta check results — November 11, 2026

## Summary

**Local automated checks passed. Not a public-release sign-off.**

- Strict TypeScript: passed.
- Vitest: **132 tests in 15 files** cover measurement, storage, policy/authorization, UI, settings migration, hourly collector/calendar boundaries, detailed consent/deletion, worker compatibility, site/chart interactions, popup/dashboard states, anonymous Wrapped models, rendering and preview lifecycle. See the execution records below.
- Production build: passed; assets generated locally.
- Playwright: **28 tests** cover the original production suite plus opted-in site insights, the compact production popup document, the polished dashboard, and exact PNG previews. See the latest execution record below.
- Full npm dependency audit: **0 known vulnerabilities** at execution time. This is not a security certification.
- Editor diagnostics: no errors.

## Actual environment and safety

| Item | Tested environment |
| --- | --- |
| OS | macOS 14.6, build 23G80, Apple Silicon |
| Browser | Google Chrome for Testing 158.0.8127.18, headless Chromium channel |
| Node / npm | 22.14.0 / 11.6.2 |
| Extension | ScrollMiles 0.1.0, WXT production Manifest V3 build |
| Profiles | Temporary profiles created and deleted by the tests; not the owner's browsing profile |
| Websites | Loopback HTTP fixtures, including synthetic apex/www hostnames; no real user browsing data |
| Permissions | Chrome settings pre-approve fixture hosts, then the real UI calls `chrome.permissions.request`; the native permission bubble is not clicked |
| Clock checks | Controlled collector timers and isolated Node timezone processes; the Mac's clock/timezone is not changed |

No extension has been submitted to the Chrome Web Store or licensed for public distribution. Source-code backup to the owner's private GitHub repository was separately requested; this is not store publication or an upload of browsing data. No owner's existing browsing data or profile was modified by these tests. Synthetic statistics are confined to test fixtures and temporary profiles, not seeded into the production UI.

## Executed smoke/compatibility matrix

| Check | Result | Evidence / limits |
| --- | --- | --- |
| Clean install, zero state | Pass | Empty temporary profile; no mandatory hosts or static all-site scripts; PNG dimensions validated. Physical toolbar-menu appearance remains a human check. |
| Permission decline / errors | Pass, simulated | Component tests cover decline, policy rejection, synchronous errors, retry, and cancellation. Native Chrome bubble acceptance/denial remains unverified. |
| Selected-site permission | Pass | Real Chrome settings pre-approval plus real UI permission request and collection. |
| Apex versus www | Pass | Local HTTP apex does not enable www; reverse direction also tested. Unit checks cover YouTube exact-host/path matching without visiting YouTube. |
| Optional all-site mode | Pass | Off by default, extra confirmation, Chrome broad-grant verification, multiple hosts collected, settings reload persists the choice. No mandatory manifest hosts added. |
| All-site exclusions | Pass | Existing tabs stop incrementing after exact-host exclusion; removing the exclusion resumes without counting the excluded movement. Exclusion does not revoke broad Chrome access. |
| All-site turn-off | Pass | Wildcard/covered grants removed; no websites enabled afterwards; earlier totals preserved; individual opt-in works again. |
| Partial external broad revocation | Pass, simulated | Background tests fail closed to selected-site mode with no enabled sites. Chrome-native partial revocation flow still needs manual validation. |
| Pause/resume | Pass | Visible/focus gating, pause/resume, and two actual browser windows; no paused-distance jump. Headless focus is not physical switching away from Chrome. |
| Root/nested input | Pass | Both scroll directions, actual wheel and keyboard inputs, nested panels, panel resize. Real trackpad/touch/scrollbar dragging remain untested. |
| Infinite feed / SPA | Pass, fixture | Append content and navigate with `history.pushState`; correct cumulative movement; no fixture URL/path/query stored in history. This does not certify every live virtualized feed. |
| Reload/navigation | Pass | Reload and navigate away/back preserve totals without duplicates. Immediate first-scroll races and abrupt-close last-batch loss remain beta limitations. |
| Browser restart | Pass | Actual Chromium process close/relaunch; persistent totals and settings retained. |
| Service-worker restart | Pass | Actual worker stop/wake through Chromium lifecycle protocol; same existing collector continues without reset or duplicate totals. |
| Remove website | Pass | Existing tab stops collecting, host permission removed, previous totals retained; re-adding host works. |
| Delete cancellation / confirmation | Pass | Cancel preserves totals; confirm clears history and pauses; old-epoch replay rejected in authorization tests. |
| Wrapped | Pass | Actual PNG preview before explicit download; displayed/downloaded bytes and SHA-256 match; 1200 × 1200 size, frozen totals, explicit refresh/period choice, keyboard dismissal, and cross-tab deletion invalidation verified. Existing downloaded file survives history deletion. No websites/URLs shown on the card. |
| Accessibility | Pass, automated/local keyboard | Axe A/AA checks on dark/light dashboard, popup, selected/all-site settings, privacy notice; keyboard skip-links, selected-period semantics, and data table tested. No VoiceOver conformance claim. |
| Native Chrome 200% zoom | Pass | `chrome.tabs.setZoom(2)` confirmed; CSS-pixel movement unchanged, keyboard/table usable, no document/app horizontal overflow. Viewport screenshot visually inspected. |
| Database unavailable | Pass | A deliberately incompatible database in a disposable profile produces an error, not fake zero stats. Privacy notice still reads; retry recovers once the test fault is removed. Transient open failure also tested without restarting the worker. |
| Midnight / rollback / retries | Pass, simulated | Midnight before a scheduled batch preserves both day counters; same-day wall clock rollback keeps cumulative sequence/distance monotonic; retries stop after three and the next scroll retains unsent counters. |
| DST / timezone | Pass, isolated processes | Actual calendar module tested across New York spring-forward/fall-back and the same instant in Los Angeles, Kolkata, and Kiritimati. No claim of live browser/OS timezone travel or sleep testing. |
| Iframes | Pass for intended exclusion | Frame scroll does not contribute while top-level scroll does. Custom/shadow/canvas/PDF scrollers remain unsupported or unverified. |
| Networking / stored metadata | Pass within observed test scope | Off-fixture HTTP attempts from tested pages/workers are logged/blocked and fail the suite; none observed. Stored fixture totals/checkpoints have no hostname/path/query. This is not an OS-wide packet capture or a statement about Chrome's own networking. |
| Performance | Limited | Tests verify no idle collector messages/recurring timers and bounded automatic retries. No claim of “no lag” on low-powered physical hardware. |

## Regression found and fixed

**Ordinary HTTP pages previously failed to record scrolling.** `crypto.randomUUID()` is unavailable in non-secure HTTP page contexts, including the content script's isolated world. Localhost counts as a trustworthy context, so earlier loopback-IP tests missed this.

Collector IDs now use the bundled `uuid` package, which falls back to cryptographic `getRandomValues` on those pages. The synthetic non-localhost HTTP fixtures exercise the failing context and now pass. IDs remain random and do not contain website/page identifiers.

A separate evidence issue was caught during visual inspection: Chromium full-page screenshots at native zoom can alter emulated metrics and crop the image. The zoom test now checks the actual app geometry and captures the real viewport instead of presenting that cropped screenshot as evidence.

## VS Code integrated-browser follow-up

The actual VS Code browser was opened against a locally served production UI. Its attempt to open **chrome://extensions** was rejected; this environment does not expose the installed ScrollMiles Chrome extension. No extension APIs or activity were mocked to disguise that limitation.

- Dashboard/settings showed their explicit unavailable-statistics state, not fabricated zeros; retry remained usable.
- Navigating to the privacy notice exposed an uncaught access to missing `chrome.storage.local`. This is now guarded, with regressions for browsers with no `chrome` global and browsers with `chrome` but no extension storage.
- After rebuilding, the privacy notice and its contents anchors worked in VS Code. At a 390 × 900 viewport, content width was 390 px, keyboard Tab focused the skip-link, Enter focused the main region, and no page errors were observed during that check.
- The privacy preview was left open locally for inspection. This does not verify installed-extension collection or native Chrome permission dialogs.

The reported **Unknown request** on all-site setup could not be reproduced with the current source/production worker; both contain the handler. A stale UI/worker build is the likely cause, not a confirmed observation of the owner's Chrome runtime. The worker now advertises all-site capability; a new UI does not offer a fresh broad-permission request when that capability is missing. Legacy unknown-request responses become clear instructions to reload ScrollMiles in Chrome and close old tabs, preserving saved data. Component/client tests cover this compatibility behavior; the owner's Chrome instance still needs an explicit extension reload.

## Production manifest review

- Permissions: `storage`, `scripting` only.
- Optional hosts: `https://*/*`, `http://*/*`; no mandatory `host_permissions`.
- No static `content_scripts`; runtime matches are selected only after explicit user opt-in.
- Incognito: `not_allowed`.
- Production extension connection policy: `connect-src 'none'`.
- Icons: locally generated 16/32/48/128 px PNGs; no remote assets.
- Manifest SHA-256 for this execution: `563f5a04e2b96d544123f3555142c1a870e0b3c9c5492293446deb505c8c19ca`.

The host patterns are broad declarations of what Chrome **may** optionally grant. They do not enable broad collection without the explicit all-site policy choice and actual grant. Pause, exclusions, permission checks, sender/frame validation, and stale-message epochs still apply.

## Website insights implementation follow-up

The owner explicitly approved a separate, opt-in expansion of local storage: exact scheme/hostname with date/hour scrolling aggregates. This is not enabled by installing/updating the extension or granting all-site access. The privacy notice and confirmation now disclose the extra detail. No full URLs, queries, paths, video IDs, titles, page content, total browser-use time, or sessions are recorded.

- IndexedDB v2 adds a separate site/hour store without modifying old anonymous history. Old records are never attributed retroactively.
- The worker derives the website from the validated Chrome sender; checkpoint payloads still cannot supply hostnames. Global totals, site/hour deltas, and deduplication commit in one transaction.
- New pure hourly measurement counts continuous bursts once and splits active time at hour/day boundaries. Clock/timezone discontinuities break continuity; repeated local hours merge. Units and existing browser-usage limits remain unchanged.
- The dashboard supports today/seven-day site ranking, site selection, hourly rhythm, a seven-day trend, exact-value tables, real zero states, and detailed-history deletion. Wrapped export still has no site identifiers.
- Turning insights off deletes detail only, leaving anonymous totals. Per-site deletion keeps other sites and combined totals. All insight/delete policy changes rotate epochs; per-site pending deletion intent is durable and completed after worker interruption. Global deletion clears every history store and pauses.
- Added unit/storage migration/concurrency/retention/hour-boundary/consent/replay tests, plus real Chromium tests for two-site consent/no-backfill, exclusions, opt-out erasure, per-site deletion/cancellation, global deletion, restart persistence, both-theme accessibility, and narrow-screen layout.
- A theme-transition contrast issue on the new ghost delete button was caught and fixed by removing its background animation. Dark/light accessibility checks now pass.

GitHub source backups and CI must not include browser profiles, activity exports, raw test output, installed dependencies, built extension output, or credentials. The owner's later README-visuals request permits only [reviewed local-fixture documentation screenshots](images/README.md), clearly labeled as illustrative test activity. The original owner-supplied product context is retained. Repository visibility is not a Chrome Web Store release or license selection.

Latest local execution for this follow-up: **typecheck passed, 100 Vitest tests passed, production build passed, 23 Chromium tests passed, full dependency audit reported 0 known vulnerabilities**. Editor diagnostics reported no errors. Both-theme and narrow site-insights views were inspected with local-fixture activity; the narrow evidence uses a viewport capture to avoid full-page screenshot stitching artifacts.

## Dashboard section-link authorization regression

The owner's screenshot showed **This action is only available in ScrollMiles** at the genuine extension dashboard with `#website-insights`. This was reproduced: the worker compared the entire sender URL to the bare dashboard address and incorrectly rejected its section fragment. It was an authorization bug, not evidence that the owner's database was missing or corrupted.

The worker now parses the sender URL, removes only fragment/query for document identification, and compares the full canonical base URL against the known popup/dashboard/options allowlist. It still requires the current extension ID and rejects non-top-level frames, malformed URLs, foreign origins/extensions, nested lookalike paths, and unknown pages. It does not use a loose prefix or pathname-only match. No history, consent, permissions, or measurement behavior is changed by the fix.

Unit regressions cover anchored/query-bearing known pages and unauthorized lookalikes. The real Chromium insights test now **follows the actual View website insights settings link**, verifies `dashboard.html#website-insights` loads without an alert, reloads that exact address, and continues the data/deletion/accessibility checks. The earlier direct bare-dashboard test did not cover this user navigation path.

After rebuilding, Chrome must reload the installed extension's worker to use the fix. Do not remove/reinstall or clear history. Close old ScrollMiles tabs and reopen via the toolbar or the settings link.

## Website insights readability follow-up

The owner requested a clearer presentation of the real site breakdown. The redesigned panel adds a compact searchable/sortable host list with locally generated monograms, a selected-site distance hero, recorded-site distance share, three explanatory metric cards, and synchronized Today/Last 7 days controls. Host schemes and subdomains remain separate; no favicon/network calls or site-brand guesses were introduced.

One chart switches between hourly/daily data and distance/active-scrolling/burst-start metrics. Its maximum, time scope, selected interval, and exact value are labeled. Hover and roving keyboard focus with Left/Right/Home/End explore bars; accessible exact-value tables remain. Daily mode explicitly shows seven days regardless of the overview period. Search with no matches keeps the field usable; sorting/filtering does not change the recorded-site share denominator. Zero timed durations are explained, and positive sub-second durations show <1s rather than a misleading 0s.

Collection, consent, storage, exports, and detailed deletion behavior are unchanged. Existing anonymous history is not relabeled, and the panel never claims browser usage time or attention. Methodology text is collapsed by default; per-site deletion still requires confirmation.

Added five component tests and expanded the real-browser path to cover search/no-result recovery, sorting, metric and timescale switching, period synchronization, keyboard exploration, and dark/light accessibility. Focused panel screenshots and a narrow viewport screenshot use local fixture activity, not the owner's browsing history. Manual VoiceOver and device checks remain open.

Latest combined local validation: **107 Vitest tests passed in 11 files; all 23 production Chromium tests passed; typecheck/build passed; full npm 11.21.2 audit reported 0 known vulnerabilities**. This includes the anchored overview-link fix, the exact settings-link navigation and reload, both-theme chart/site interactions, and 200% zoom. The pre-existing overview-period browser test was updated to distinguish its controls from the new synchronized website-period controls; collection logic was not changed to satisfy that test.

## Popup quick-glance follow-up

The popup now has a dedicated presentational component backed by the same real snapshot and commands as the dashboard. The existing warm dark/lime/light colors are retained; no unsupported browsing-time/session/personality metrics, demo activity, new permissions, data collection, or networking were introduced.

- A compact distance hero and existing active-scroll/burst metrics replace the large dashboard introduction. Period selection, dates, export period, screen-equivalent labeling, raw pixels, and sub-second durations stay explicit.
- First use shows a smaller genuine zero-distance card and consent-first website setup, not empty metric tiles. Website permission is still requested directly from the submit gesture. Denial/invalid input is recoverable; no optional mode is enabled automatically.
- A status/coverage row distinguishes pause/no-access/selected-host/all-site settings and offers a global pause/resume action only when relevant. On failed refresh the displayed status is unverified and popup pause/export actions are disabled; earlier numbers are not silently replaced with zero.
- Header settings access, insight-consent-aware deep links, full dashboard navigation, and site-free Wrapped download are explicit. Existing website management/exclusion controls remain in settings rather than taking up the default popup.
- First-use and populated default layouts fit within the 390×600px test surface. The actual document has no horizontal overflow at 320px. Additional messages, long values, expanded metric explanations and some empty states may scroll vertically. A theme-transition contrast issue was caught and fixed by switching primary-button colors atomically.

Eight component tests cover period totals/export payload, pause/resume, consent/coverage, permission denial, untimed scrolling, failed loads/retry, stale-data gating, and pause/history preservation. Three new Chromium tests cover actual local activity, consent boundaries, pause/resume, correct exported filename, first-use/height/layout, dark/light/320px accessibility, and actual new-tab navigation from popup to insights/settings.

Latest local run: **115 unit/UI tests passed in 12 files, 26 production Chromium tests passed, typecheck and production build passed, full dependency audit found 0 known vulnerabilities; editor diagnostics showed no errors**. First-use, populated, paused, both-theme, and narrow screenshots use test-only local-fixture activity and were inspected. Native Chrome action-popup window interaction could not be exercised through the available headless Playwright page interface; this result is explicitly a production-popup-document test, not a claim that physical toolbar/native permission behavior has been certified.

## Dashboard polish and actual Wrapped preview follow-up

The overview now follows the popup/insights hierarchy while retaining the existing warm dark/lime/light colors. A distance hero, collection/coverage card, honest active-scrolling/burst/raw-pixel metrics, interactive seven-day chart with exact table, and dedicated Wrapped entry replace the previous dense layout. Website management remains in settings after setup; first use still supports explicit exact-host access. Section links do not change insights consent. No sample production activity or unsupported browser-time, session or attention statistics were added.

Wrapped now opens a native modal in popup/dashboard with the actual locally rendered PNG. It does not download on open. The selected period and dates are shown; Download PNG uses that image's object URL, not a second render. Captured anonymous totals stay frozen through live snapshot refresh and new scrolling. Explicit Refresh preview totals captures new data. Tracking-policy/deletion epoch changes invalidate the preview, including a change from another settings tab. URLs are revoked when replaced/closed; obsolete asynchronous renders cannot replace the selected image. Failed drawing can retry, unavailable statistics gate download, and zero data stays honest.

Seventeen added unit/component tests cover the anonymous data projection, frozen periods/dates, renderer success/failure, explicit-download lifecycle, obsolete render cleanup, refresh/dismissal, zero/stale dashboard controls, and seven-day selection/table. Existing popup tests now verify preview before export. Two new real Chromium tests cover:

- No automatic download, frozen preview during new real scrolling, explicit refresh, Today/seven-day filenames and actual downloaded PNG dimensions.
- Byte-for-byte and SHA-256 equality between the displayed PNG and downloaded file. A **test-only** init script observes Blob bytes while delegating the original `URL.createObjectURL`; this instrumentation does not mock extension APIs, the renderer, Canvas, or measured activity. It exists because blob-image response events are not reliable in this runner and production CSP blocks `fetch`.
- Native modal focus, explicit Tab/Shift+Tab wrap, Escape dismissal and trigger-focus restoration, both-theme Axe A/AA checks, and 390px no-overflow layout.
- Actual cross-tab Delete history invalidates the displayed card; a fresh preview contains zeros, while an already-downloaded export remains outside extension storage.

The existing browser suite also verifies the redesigned dashboard in both themes and at actual 200% Chrome zoom. Its daily-table keyboard check now selects the named disclosure explicitly rather than assuming it is the only disclosure. Local screenshots use temporary fixture activity and are not real browsing history or a certification of native toolbar, VoiceOver or physical-device behavior.

Latest combined local validation: **132 Vitest tests passed in 15 files; all 28 production Chromium tests passed; typecheck/build passed; full npm 11.21.2 audit reported 0 known vulnerabilities**. Production manifest still contains only `storage`/`scripting`, optional HTTP/HTTPS hosts, no mandatory hosts/static scripts, no incognito, and `connect-src 'none'`. Collection, storage schema, permissions, consent, and retention are unchanged by this UI work.

One intervening local rerun failed to observe resumed/initial movement in two pre-existing collection cases and took roughly 15 minutes per failing case despite the configured 45-second test timeout. The cause was not established; no production collection change or weakened assertion was used to dismiss it. Both affected suites then passed (12/12), followed by the complete matrix (28/28) on the same build. The final pass is not a claim that local browser/focus timing is flake-free.

The separate [browser-active time and sessions proposal](BROWSER_TIME_DESIGN.md) is **design only**, not a runtime feature or approved measurement algorithm. It outlines a new opt-in/permission review, conservative eligibility and interruption rules, session boundaries, atomic persistence and acceptance tests. No browser-active duration, sessions, timing consent or `idle` permission has been implemented. Those product/error-bound decisions require separate approval before collection work.

## Reproducible evidence

- [Original production-extension browser suite](../tests/e2e/extension.spec.ts).
- [Expanded beta browser suite](../tests/e2e/beta.spec.ts) and [isolated local fixture](../tests/e2e/beta-fixture.ts).
- [Collector simulations](../tests/collector.test.ts), [timezone/DST checks](../tests/calendar.test.ts), [UI permission checks](../tests/ui.test.tsx), and [background authorization checks](../tests/background.test.ts).
- [Popup component checks](../tests/popup.test.tsx) and [production popup browser checks](../tests/e2e/popup.spec.ts).
- [Dashboard component checks](../tests/dashboard.test.tsx), [Wrapped model/lifecycle checks](../tests/wrapped.test.tsx), [PNG renderer checks](../tests/card-renderer.test.ts), and [actual preview browser checks](../tests/e2e/wrapped.spec.ts).
- Screenshots and PNGs are generated in ignored local test output on each run. They are illustrative test-fixture data, not the owner's activity or store-ready marketing evidence.

Run the typecheck, unit/UI tests, production build, browser tests, and dependency audit described in [README.md](../README.md#development). These results describe the source/build tested today, not future edits.

## Still needs a person, device, or owner decision

- Native Chrome permission-bubble acceptance/denial for individual and all-site access, plus physical toolbar/popup inspection.
- VoiceOver/screen-reader experience, physical trackpad/touch/scrollbar interactions, leaving Chrome for another app, sleep/wake, and low-powered hardware performance.
- Supported stable Chrome versions and other operating systems; live YouTube comments/infinite feeds and other real website layouts; rapid navigation/discarded tabs and custom/shadow/PDF scrollers.
- Browser/OS timezone changes and sleep across midnight/DST beyond the isolated calendar simulations.
- Publisher identity/contact, approved hosted privacy-policy URL, final store privacy disclosures, licensed distribution decisions, and explicit authorization to publish.

Those items remain open in [BETA_CHECKLIST.md](BETA_CHECKLIST.md). **Local checks are green; a complete human/device release review is not claimed.**