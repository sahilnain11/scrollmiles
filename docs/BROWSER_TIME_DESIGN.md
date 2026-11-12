# Browser-active time and sessions — proposed next slice

**Design only. Not implemented, not collected, and not authorized as part of this UI milestone.**

ScrollMiles currently measures scrolling movement, bursts, and event-to-event active scrolling time. A video can play for 25 minutes with no scroll. It must not be presented as 25 minutes of scrolling or proof that the user watched it.

## Proposed product definition

| Metric | Proposed meaning | Not a claim of |
| --- | --- | --- |
| Browser-active time | Estimated time for one eligible active tab while its Chrome window is focused, browser idle state is active, and collection is opted in/unpaused/permitted | Watching, reading, attention, productivity, video duration, or time in another app |
| Site session | One contiguous eligible interval for an exact site, under explicit boundary rules below | A psychological focus session or a recorded page-visit history |

Example for a future UI: **YouTube — 25m estimated browser-active time; 2m active scrolling.** Show separate labels/tooltips and never add the durations together. No values are displayed before the feature actually ships and collects them.

## Explicit consent and permission proposal

- Add a **separate off-by-default** Browser activity opt-in for new/existing users. Existing host permission, all-site access, and Website insights consent are not consent for timing.
- Explain that focused/active browser status is an imperfect estimate and can include a video left open. Idle rules can undercount long reading/video intervals; do not silently override them based on media/page content.
- Evaluate `chrome.idle` as a new **optional** permission requested only during an explicit user gesture. Proposed idle threshold: 60s, clearly disclosed and tested. If permission is denied, timing stays off and scrolling still works.
- Reuse existing exact-host access, all-site consent/exclusions, global pause and no-incognito boundaries. Do not add mandatory broad hosts, `tabs`, or other APIs unless a documented capability gap justifies them. Request neither history nor webNavigation for page-level logging.
- Anonymous timing totals could be available with the new timing opt-in; per-site timing would require both timing opt-in and explicit detailed-history consent. The current Website insights notice would need to be updated and re-confirmed for the expanded data type before site timing is stored.

## Proposed deterministic session boundaries

Start a session only when **all** conditions are verified: tracking on, timing opt-in on, active visible supported tab, focused owning window, non-idle/non-locked browser, permitted/non-excluded exact host, and no incognito context.

End the session at a known event when any condition stops being true: active-tab switch, window focus loss, browser idle/lock, navigation to another host or unsupported page, exclusion/access revocation, pause/opt-out/delete, tab/window closure. Switching to another tab on the same host still ends the old interval and starts a new one; users can understand and reproduce this rule. SPA path changes on the same tab/host do not create another session, and no paths are saved.

After idle or refocus, a verified interval begins a new session. No 5-minute merge or inferred overnight continuation in the first version. A worker restart alone should not double-count a start if the durable verified interval is still the same; uncertain gaps should be marked/capped, not filled as activity. A browser restart, discard/reload with unverified continuity, or sleep gap starts a new verified interval without assuming the missing time was active.

Session counts are not inherently “good” or “bad.” Explain that changing tabs creates boundaries; never label a high count as poor focus. Defer average/median/longest session metrics until session completion, partial intervals, retention, and quality flags have been defined and tested. The first release can stick to duration and count.

## Engineering approach to review before implementation

1. **Eligibility coordinator:** register Chrome tab activation, window focus, tab/window removal, permission/settings changes and idle-state listeners synchronously. Inspect only transient browser identifiers needed for eligibility. Never read page content, media title/state, full URL history, input, or screenshots. Derive and persist only the approved scheme/hostname when detail is consented.
2. **Durable lease, not an always-running worker timer:** persist a random interval ID, epoch, current eligibility/lease bounds, cumulative duration and latest accepted monotonic/wall checkpoint. Content/UI event-triggered checkpoints can extend a bounded verified lease while eligible. Proposed flush/lease sizes must be measured and chosen; do not multiply a periodic timer count to invent duration. Service-worker suspension must remain safe.
3. **Conservative gaps:** cap any unverified extension at a short documented lease; don't add minutes/hours merely because `Date.now()` advanced while Chrome slept. Clock rollback/timezone jumps cannot make durations negative or bridge unknown gaps. Monotonic time is valid only within its context; never compare it across document/worker restarts without a durable interval model.
4. **Exactly one attribution owner:** multiple active windows/tabs, popup focus, rapid events and resumed workers must not produce overlapping time. Revalidate sender/frame/permissions/epoch and current active-tab/focused-window state, rather than trusting collector claims. A focused extension dashboard/settings/popup itself must not accrue website time.
5. **Atomic persistence:** commit anonymous duration/count deltas, optional site/hour timing deltas, and deduplication/lease ownership in one indexed transaction. Keep timing streams/schema separate from scroll measurement. Site timing rows contain no paths/titles/queries. Do not introduce read-modify-write races or lifetime dependencies on in-memory state.
6. **Bound all state:** capped retry/backlog, retention (initial proposal: 90 local calendar days), finite payloads, and minimal interval checkpoints. Prefer aggregates and in-progress interval state, not permanent raw session timelines. If richer distributions later need extra storage, propose/disclose it first.
7. **Privacy recovery:** opt-out erases corresponding timing data, detailed opt-out erases detail while anonymous totals remain, per-site deletion preserves unrelated totals, and durable pending-deletion plus epochs prevents stale replay after interruption. Keep site identifiers out of default Wrapped unless the owner explicitly approves a separate sharing change; this proposal makes no such change.

This lease sketch is not a finished algorithm. Before writing runtime code, enumerate precisely what each API event proves, which gaps can be counted, maximum loss/overcount bounds, and how the first lease/session start commits atomically. Use a short technical decision record to approve those bounds rather than claiming exact dwell time.

## UI integration when implemented

- Distinct cards for **Active scrolling** and **Estimated browser-active time**; neither replaces the other.
- Show session counts with a definition, not an attention/personality score. Suppress unsupported averages or trend comparisons for insufficient data.
- Timing off, permission denial, paused, unsupported tab, idle/sleep gaps, storage errors, partial/estimated periods, and insufficient data must have explicit states.
- Existing history is not backfilled. Scrolling history cannot reconstruct past browsing duration or sessions.
- Review disclosure text and retained-data controls before opening the feature to beta testers.

## Required acceptance tests

- One focused tab accrues only verified eligible duration; zero when paused, idle, locked, excluded, denied, incognito, unsupported, or Chrome loses focus.
- Two tabs/windows never overlap attribution. Active switches, popup/settings focus, rapid navigation/redirects and SPA same-host changes follow the stated session boundaries.
- Permission denied/revoked mid-interval cannot store time beyond the accepted eligibility boundary; scrolling remains unaffected.
- Worker stop/restart, browser restart, tab discard/reload, crash, lost acknowledgment and repeated checkpoints neither duplicate duration nor session starts.
- Sleep/resume and clock rollback cannot turn a lease into hours of fabricated time. Split supported intervals at local midnight/hour boundaries without changing duration; define repeated DST hour behavior.
- Atomic failure rollback, concurrent event ordering, retention, opt-out erasure, per-site/delete-all and interrupted deletion are exercised in real Chromium and unit/storage tests.
- Final production manifest still has no mandatory website hosts/static all-site collector. No page content, remote transmission, accounts or additional infrastructure.

## Decisions needing owner approval later

Consent wording, whether detailed timing needs a new opt-in/versioned consent, idle threshold, conservative lease/flush bounds, session definition, retention, how uncertainty is shown, and minimum useful metrics. **Do not implement this proposal merely to match the visual reference.**