# Smart Insights 1.0 — measurement and acceptance

This implements the immediate milestone in the owner's [product strategy](product_startegy.md). It does not implement all Phase 1/2/3 features. The strategy is preserved as supplied, including its filename.

## Data and privacy boundary

- Use existing anonymous `days` totals for current-day/seven-day observations and comparisons. No page contents, sessions, URLs, input, network services, accounts or telemetry are added.
- The existing authorized `GET_SNAPSHOT` response keeps `days` at seven local dates and adds optional `comparisonDays`: only saved anonymous aggregates from 14 complete dates, yesterday back through 14 days ago. Missing rows remain missing. An older worker omits the field and the UI explains how to reload.
- The response advertises `smartInsights` capability. All snapshot date queries use one local-calendar anchor so a read spanning midnight does not use three different dates. Settings/deletion/aggregation still pass through the existing serialized worker queue.
- Hourly observations require Website insights already enabled and its existing `siteHours` response available. Hourly view models explicitly project only date/hour/numeric totals, not site identities. No new anonymous hourly store is persisted. Opt-out and detailed deletion therefore cannot leave a durable heatmap behind.
- The IndexedDB schema remains **v2**, retention remains **90 calendar days**, the collector/checkpoint algorithms are unchanged, and the production manifest has no new permissions/mandatory hosts/static scripts. Wrapped stays anonymous and site-free.

## Summary rules

Today means the current local date, still in progress. Seven-day summary means six preceding local dates plus partial today. Total distance/bursts/active-scrolling duration retain existing definitions. Dates with no recorded movement do not establish inactivity or a routine.

The leading date is the date with highest recorded distance within that selected window. All nonzero ties are shown in chronological order; zero-only input yields no peak. A single observed Thursday cannot support a claim that Thursdays are typically busiest. This is neither a lifetime personal record nor a streak/goal.

Peak hour is **by recorded-site distance**, not time online. It uses only retained site/hour details in the selected period. Seven-day peak combines each local hour across those seven dates. All tied positive hours are reported. Isolated scrolls can have distance and zero timed duration.

## Comparison policy

Example with today **2026-11-12**:

| Window | Inclusive local dates |
| --- | --- |
| Recent complete period | 2026-11-05 through 2026-11-11 |
| Previous complete period | 2026-10-29 through 2026-11-04 |

Both windows are seven complete calendar dates, and neither includes today. The summary period selector does not change this definition. Calendar arithmetic is local-date based, not a division by 24-hour milliseconds; DST days need not last exactly 24 hours.

Daily storage has **no collection-coverage or installation-date ledger**. A missing aggregate could mean no activity, pause, install/update timing, deletion or a collection failure. Do not infer install time from the oldest checkpoint or fill unknown days as confirmed zero baseline activity.

Consequently, show the available recorded totals and **days with saved aggregates**, but calculate changes only if both periods contain a saved aggregate for every date. This is intentionally conservative: a user with genuine zero-activity days may continue to see insufficient comparable history. It is not a request to scroll every day or a reward for doing so. No new coverage tracking is introduced merely to unlock comparisons. Even full saved-day counts do not prove continuous collection; permissions, errors and pauses can still affect totals.

For supported distance/burst/time metrics:

- Absolute change = recent recorded total minus previous recorded total.
- Percentage = absolute change divided by previous recorded total, only when previous total is positive.
- Previous zero means **no percentage**, never infinite or invented 100% growth. Both zeros may show unchanged absolute totals without a percentage.
- More/less is neutral, never success/failure, wellness improvement or an attention assessment. Exact CSS pixels and milliseconds remain visible for changes, avoiding a small rounded metre change being mistaken for no difference.

## Heatmap rules and access

Seven local dates × 24 stored hour labels, aggregated across retained opted-in sites. Its seven-day scope does not follow the summary's Today switch; its metric can be distance, burst starts or active scrolling. It has no site identifiers and no ability to reconstruct old anonymous hours.

The model distinguishes **a saved row** from **no recorded detail**. A blank cell never proves inactivity or complete collection. Earlier opt-in timing, exclusions, pause, deletion, future hours and failures can leave gaps. Zero active milliseconds in a saved cell can still accompany positive movement. A DST fall-back combines repeated labels; a skipped spring-forward hour may be blank. Historical labels are not shifted after timezone travel.

One grid cell is tabbable. Arrow keys move horizontally/vertically without wrapping across day boundaries. Home/End move to the first/last hour in the same row; Ctrl/Cmd+Home/End move to the first/last cell. Selection has a text readout, exact accessible label and non-color selected outline. An expandable 168-row table exposes all three numeric metrics and whether a record exists. On narrow screens the grid/table scroll internally, and date headers remain visible. There is no celebratory animation or pressure mechanic.

## Verification

- [Pure model checks](../tests/insights.test.ts): ranges, partial today, zero/empty/tied peaks, incomplete and zero comparison baselines, date/year/leap boundaries, explicit anonymous projections, period filtering, multi-site hourly sums, unknown cells and repeated-hour merging.
- [Calendar checks](../tests/calendar.test.ts): actual pure functions run in isolated Node processes in New York (both DST transitions), Kolkata and Kiritimati, without changing the owner's clock/timezone.
- [Storage checks](../tests/database.test.ts) and [worker checks](../tests/background.test.ts): bounded existing reads, unchanged schema, authorization, seven-day API compatibility, and deletion of comparison history through existing global controls.
- [Component checks](../tests/smart-insights-ui.test.tsx): consent off even when input contains detail, zero/legacy/stale states, keyboard grid, exact table, metric switches, tied peaks and neutral changes.
- [Production Chromium checks](../tests/e2e/smart-insights.spec.ts): actual scrolls before/after opt-in, no backfill, keyboard/table/metric interactions, dark/light Axe checks, narrow overflow, per-site deletion/opt-out preserving anonymous totals, and global deletion.
- A separate comparison browser test explicitly writes **synthetic historical daily aggregates in its disposable profile** to exercise the real database/worker/UI read path. It is not a test of collector measurement over 14 real days, not the owner's browsing activity, and never seeds the shipped UI. Current-day collection tests remain unseeded. No extension APIs or renderer are replaced.

Manual device, VoiceOver, native permissions and real-site limitations remain in the [beta checklist](BETA_CHECKLIST.md). Screenshots from test output remain local unless deliberately reviewed for documentation. Monthly reports were outside this initial milestone and are now covered separately by the [retained-history follow-up](HISTORY.md). Browser-active time, sessions, personality/achievement engines, individual burst maxima and new collection remain outside these slices.