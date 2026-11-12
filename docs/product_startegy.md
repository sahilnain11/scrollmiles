# ScrollMiles Product Strategy

**Status:** Agreed product direction  
**Category:** Personal Digital Activity Tracker  
**Primary platform:** Chrome extension (V1)  
**Positioning:** Analytics at the core, fun in the experience, wellness as an optional outcome.

> **ScrollMiles — Your digital life, measured.**
> Understand your digital habits. Discover your patterns. Make more intentional choices.

## 1. Product vision

ScrollMiles helps people understand their digital lives through meaningful statistics, playful discoveries and healthier habits.

The product loop is:

**Measure → Understand → Enjoy → Improve**

- **Measure:** reliably collect the minimum activity data needed.
- **Understand:** turn measurements into accurate, useful insights.
- **Enjoy:** make discovery engaging through journeys, milestones and Wrapped.
- **Improve:** help users reflect on routines and optionally pursue self-defined goals.

ScrollMiles is not a screen-time guilt app, clinical attention assessment, employee-monitoring tool or parental-surveillance product.

## 2. The three pillars

### Analytics — understand your digital life

The foundation must be accurate, transparent and useful. Users should understand how much they scroll, how activity changes over time, which opted-in websites account for activity, when scrolling peaks, and how days and weeks compare. Browser sessions and browser-active time may be added later.

- Every insight must come from actual measurements.
- Show definitions, units, date ranges and comparison baselines.
- Distinguish scrolling duration from browser-active time.
- Show insufficient-data states instead of inventing observations.

### Fun — make statistics enjoyable

This is how ScrollMiles becomes distinctive and shareable:
- Scroll Journey: an illustrative route through milestones.
- Playful personality archetypes based on observed patterns.
- Personal records and collectible achievements.
- Daily, weekly and monthly Wrapped stories.
- Privacy-safe share cards.
- Later, optional private friend challenges.

Fun should create delight, not pressure people to spend more time scrolling.

### Wellness — support informed choices

Wellness is an optional benefit, not a judgment engine:
- Morning and late-night activity patterns.
- User-defined goals and reflection prompts.
- Optional gentle reminders.
- Trends that help users notice changes in their routines.

Never diagnose addiction, attention disorders or mental-health conditions. Never claim to measure psychological attention span. Do not shame users for high activity or reward more screen time. Goals and reminders must be user-controlled.

## 3. Product promise and audience

ScrollMiles should answer four questions:

| User question | Experience |
|---|---|
| How much did I scroll? | Analytics |
| What does my activity look like? | Insights |
| What kind of digital explorer am I? | Fun |
| Is my digital routine working for me? | Optional wellness tools |

Start with people who spend substantial time in Chrome, enjoy personal statistics, are curious about browsing patterns, like visualizations and shareable recaps, and prefer privacy-conscious tools.

Do not initially target clinical assessment, employee surveillance, parental monitoring or treatment use cases.

## 4. V1 scope and current baseline

V1 is a local-first Chrome Manifest V3 extension. The repository README is the source of truth for implementation status.

Current narrow V1 scope:
- Estimated scroll distance.
- Scroll burst/action counts.
- Active scrolling duration.
- Daily and seven-day summaries.
- Optional website-level scrolling insights.
- Local Wrapped preview/export.
- Pause, exclusions, permissions and deletion controls.

Discussed but not automatically part of current V1:
- Browser-active time and session analytics.
- Morning/night routine analytics.
- Goals, reminders and achievements.
- Android/iOS tracking.
- Physical activity integrations.
- Accounts, cloud sync and social features.

Do not silently expand V1. New data collection, permissions, schema changes or tracking algorithms require deliberate product and privacy review.

## 5. Roadmap

### Phase 1 — Understand: make current data meaningful

**Goal:** Improve daily usefulness using existing local aggregates, without expanding data collection.

1. Smart Insight Engine: deterministic daily and weekly observations.
2. Activity heatmap: patterns by hour and day.
3. Personal records: most active day, longest scroll burst and cumulative milestones where supported by existing data.
4. Better comparisons: this week versus the previous comparable period, with absolute and percentage changes.
5. Monthly summary using available aggregates.

Acceptance criteria: deterministic and testable insights; no fabricated statistics; clear zero/insufficient-data states; correct timezone/date-boundary handling; no new permissions or tracking.

### Phase 2 — Enjoy: make ScrollMiles memorable

**Goal:** Create a distinctive identity and a reason to share.

1. Scroll Journey with illustrative progression and milestones.
2. Personality engine with playful archetypes based on real patterns and adequate sample sizes.
3. Achievements for cumulative distance, personal records and consistency—not increased screen time.
4. Wrapped improvements: story cards, accessible layouts and privacy-safe export.
5. Small optional milestone celebrations.

### Phase 3 — Improve: understand time and routines

**Goal:** Add carefully measured context for browsing and routines.

1. Browser-active time, attributed only under explicit documented rules.
2. Session analytics with clear session boundaries.
3. User-configurable morning and nighttime windows.
4. Optional personal goals.
5. Optional gentle reminders.

Before implementation, review the existing browser-time/session proposal; decide consent and permissions; define focus, idle, tab, window, sleep/wake and restart behavior; explain that active-tab time does not prove the user was looking at the screen; keep scrolling duration separate from browser-active time; test extensively.

### Phase 4 — Connect: expand the ecosystem

Only after the Chrome experience demonstrates sustained value:
1. Android companion using supported OS APIs.
2. Optional accounts and cross-device sync.
3. Private friend challenges and groups.
4. Physical activity integrations.
5. Apple Health / Health Connect integrations where supported.

Do not promise arbitrary cross-app scrolling observation on mobile. Respect platform APIs and policies.

## 6. Prioritization

Evaluate features on user value, reuse of existing data, trust/privacy, delight and engineering/maintenance complexity.

| Feature | Value | Complexity | Decision |
|---|---|---|---|
| Smart insights | High | Low | Build next |
| Activity heatmap | High | Low | Build next |
| Personal records | High | Low | Build next |
| Wrapped improvements | High | Medium | Next |
| Journey progression | High | Medium | Next |
| Personality types | High | Medium | Next |
| Browser-active time | High | High | Later |
| Morning/night analysis | Medium | Medium | Later |
| Goals/reminders | Medium | Medium | Later |
| Social features | Unvalidated | High | Validate first |
| Mobile tracking | Potentially high | Very high | Future |

These are planning estimates, not user-research findings.

## 7. Product principles (constitution)

1. Accuracy over impressive statistics. Never fabricate, overstate or obscure limitations.
2. Insights over raw numbers. Help users understand what data means.
3. Fun without addiction mechanics. Never encourage more scrolling as success.
4. Privacy by default. Collect the minimum data needed for the active feature.
5. Local-first ownership. Users control their activity data.
6. Progressive complexity. Quick popup, focused dashboard, optional deeper analysis.
7. Transparent measurement. Explain units, definitions, date ranges and uncertainty.
8. Consent before expansion. New collection and permissions require explicit review.
9. Accessible, calm UX. Readable charts, keyboard access, reduced-motion support and useful empty states.
10. Validate before expanding. Real feedback and reliability come before more features.

## 8. Metric definitions and language

- **Estimated scroll distance:** sum of observed page scroll movement converted from CSS pixels to a familiar unit. Not literal finger travel or physical walking distance.
- **Active scrolling duration:** duration calculated from observed scroll-event timing under documented burst rules. Not total time spent on a website.
- **Scroll actions/bursts:** groups of scroll events separated according to the implemented inactivity threshold.
- **Browser-active time (future):** time attributed to an active/focused browser tab under documented idle and window rules. Does not prove visual attention.
- **Focus/attention patterns:** behavioral proxies only, never clinical or psychological measurements.

## 9. Success metrics

Measure product value and trust, not activity volume.

| Area | Example metric |
|---|---|
| Activation | Users who complete onboarding and see first meaningful stats |
| Engagement | Weekly active users, insights viewed, dashboard visits |
| Retention | Day-7 and Day-30 retention |
| Sharing | Wrapped exports and, where measurable with consent, actual shares |
| Trust | Permission opt-in, pause usage, successful deletion, privacy complaints |
| Reliability | Crash-free usage, data consistency, duplicate/lost event rate |

Early hypotheses to validate: strong first-session activation; meaningful week-over-week retention; voluntary return visits to insights; voluntary Wrapped exports/shares; no noticeable tracking lag or unexplained data loss.

## 10. Non-goals for the current stage

Do not build without a separate decision:
- Backend or user accounts.
- Cloud sync.
- Social network or public leaderboards.
- AI-generated insights not traceable to measured data.
- Clinical attention or addiction scores.
- Employee or parental monitoring.
- Unnecessary analytics SDKs or third-party transmission.
- Broad mobile tracking beyond supported APIs.

## 11. Engineering and Copilot working agreement

Before significant implementation:
1. Read this document and the README.
2. Inspect repository architecture, tests and relevant technical proposals.
3. Explain the smallest safe implementation plan.
4. Identify data, permission, privacy and migration implications.

During implementation:
- Preserve working behavior.
- Separate UI from tracking, aggregation and persistence.
- Use strict TypeScript and typed interfaces.
- Keep demo data separate from real user data.
- Test algorithms, date boundaries, empty states and failure/restart behavior.
- Avoid unjustified dependencies.
- Do not implement future roadmap features without an explicit decision.

After implementation:
- Run typecheck, unit tests, production build and relevant browser integration tests.
- Fix regressions.
- Report files changed, commands run, results and limitations.

## 12. Immediate next milestone: Smart Insights 1.0

Use existing local scroll aggregates to generate deterministic daily and weekly observations:
- Most active scrolling hour.
- Daily/weekly scroll distance and burst summaries.
- Most active day of the week.
- Comparison with the previous comparable period.
- Activity heatmap.

Constraints:
- No new permissions or tracking data.
- No fabricated insights.
- No unnecessary schema changes.
- Preserve existing privacy controls, popup, dashboard and Wrapped.

This is the next product milestone unless manual beta validation reveals a more urgent reliability issue.
