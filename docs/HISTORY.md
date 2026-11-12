# Retained history — daily records and monthly summaries

This continues Phase 1 of the [product strategy](product_startegy.md) after the owner tested Smart Insights 1.0. It is not approval for browser-active/session tracking, achievements, personality types or telemetry.

## Read-only data contract

The existing authorized `GET_SNAPSHOT` request accepts optional boolean `includeHistory`. Only the dashboard sends it; popup/settings keep their smaller response. A non-boolean flag is rejected, and content scripts/foreign documents do not gain access to this UI-only command.

When requested, `history` contains a worker-anchored `startDate`, `endDate` and explicit anonymous projection of existing `{date, distancePx, actions, activeMs}` rows. The indexed read includes today back through 89 preceding local dates, at most 90 daily rows. It excludes expired and future-labeled rows without relocating them. `days` remains the existing seven-day view; `comparisonDays` remains the previous 14 complete dates. Capability `retainedHistory` is additive. An older worker without history triggers reload guidance, not an invented zero history.

There is **no schema migration, new store, checkpoint field, collector algorithm, permission, networking or retention change**. IndexedDB stays v2; history stays 90 local calendar days. Bounds use the same local date anchor as the other snapshot reads. Snapshot handling still joins the serialized settings/checkpoint/deletion queue. Models independently filter against the supplied bounds and project numeric data without site fields or storage references.

## Personal daily records

- Rank daily distance, daily burst starts and daily active-scrolling duration separately.
- Use only saved dates within retention **before the anchored current date**. Today is excluded because it is still in progress.
- Select only positive maxima and expose all tied dates in chronological order. Zero, empty or today-only data must not fabricate a record.
- These are **within retained history**, never all-time, since-install or a complete-coverage claim. Missing dates and partially collected saved dates remain limitations.
- Do not save an achievement/record ledger. On expiry, deletion or late accepted checkpoints, recompute. A record can decrease when an old leading date expires.
- The saved-window subtotal includes partial today, clearly separated from past-date record rankings. It is not lifetime progression or a goal.
- A daily active-time sum is not the longest individual burst. Existing aggregate counters cannot recover per-burst maxima; no claim is inferred and no new collection is added for it.

## Calendar-month summaries

Offer all calendar months intersecting the anchored 90-date window, newest first (at most four). Selection is independent of the overview's Today/Last 7 days switch and survives normal live refresh. If a selected month expires, fall back to an available month.

For each month, clamp included dates to the retention window. Show the included range, saved distance/bursts/active-scrolling subtotal, saved-date count and eligible-date count. Current month includes explicitly labeled **partial today**; the future part is excluded. Older months may be clipped at their start. There are no averages, streaks or month-to-month percentages: unequal coverage cannot establish a behavior trend. Saved-date count is not a coverage percentage or installation-age estimate.

Calendar states are distinct:

| State | Numeric behavior | Meaning |
| --- | --- | --- |
| Saved aggregate | Show actual counters, including explicit zeros | A row exists, not proof of continuous collection |
| No saved record | Show unknown text / em dash in exact table | Could be inactivity, permission/pause, timing or failure; not verified zero |
| Outside retained window | Excluded, no numeric value | Date predates the 90-date read window; not a claim about whether it once had data |
| Future date | Excluded, no numeric value | Later than the worker's anchored current date |

The calendar has seven Sunday-first weekday columns and actual month length (28/29/30/31). Date arithmetic uses local calendar dates, never fixed 24-hour millisecond division. Historical local date labels are not regrouped after timezone travel; repeated/short DST days remain single calendar dates.

One date is tabbable. Arrow keys move by day/week, Home/End within the calendar row, Ctrl/Cmd+Home/End to the first/last date. Every date remains inspectable, including missing/future/outside-retention states. The accessible name includes the visible day number, exact date, state and saved CSS pixels if present. Selection readout and an expandable full table expose actual values/state without relying on color. Colors are relative within the chosen month, not targets. Missing rows use em dashes, not fabricated numeric zeros. No animation or celebration is added.

## Deletion and failure

Website insights consent is not needed for anonymous history. Enabling/disabling detailed storage or deleting a site's detail does not subtract anonymous monthly totals. Existing global Delete history clears all source rows and pauses; the views recompute empty states. No export or permanent record cache is created. A failed refresh suppresses observations and explains that current statistics cannot be verified.

## Acceptance evidence

- [Model checks](../tests/history.test.ts): retained boundaries, expiry/recomputation, ties and independent metric maxima, today-only/zero/empty, clipping, future/missing/saved-zero states, invalid months, year/leap/month boundaries and anonymous reference-safe projections.
- [Component checks](../tests/history-ui.test.tsx): ties, exact text states, keyboard controls, partial today, month persistence, old-worker guidance, stale-data gating and deletion-derived empty views.
- [Storage](../tests/database.test.ts), [authorization](../tests/background.test.ts) and [App request tests](../tests/ui.test.tsx): read bounds, no metadata retention, unchanged DB version, explicit dashboard request, flag validation, content-script denial, detailed deletion preservation and global erasure.
- [Calendar checks](../tests/calendar.test.ts): actual pure modules execute in isolated New York DST/Kolkata/Kiritimati processes; no owner's OS clock or timezone is changed.
- [Production Chromium checks](../tests/e2e/history.spec.ts): actual anonymous scrolling appears while detailed insights is off; opted-in site deletion and opt-out preserve totals; global deletion removes them. Separate synthetic historical rows in a disposable profile exercise records, retention, ties, month selection, exact missing values, keyboard, dark/light Axe checks and 390px layout. That synthetic fixture tests the DB/worker/UI read path, **not 90 days of measured collection**, and never seeds the shipped extension.

Native Chrome permission bubbles, physical toolbar/device experience, VoiceOver and remaining real-site checks stay manual in the [beta checklist](BETA_CHECKLIST.md). Raw screenshots remain ignored unless reviewed and deliberately promoted for documentation.