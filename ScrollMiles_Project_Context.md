# ScrollMiles --- Product Context & Technical Handoff

> **Tagline:** Your digital life, measured.\
> **Product:** A playful, privacy-first digital-life tracker.\
> **Initial platform:** Chrome extension (Manifest V3).\
> **Product goal:** Turn everyday digital activity into interesting
> personal insights, achievements, and shareable reports.

------------------------------------------------------------------------

## 1. Product vision

ScrollMiles began as a simple idea: measure how much someone scrolls in
a day, how long they spend scrolling, and how many scroll actions they
make.

The idea evolved into a broader personal digital-life tracker. It should
help users understand:

-   How much they scroll each day and week.
-   Which websites consume most of their browser time.
-   How long their browsing sessions last.
-   How frequently they switch between websites.
-   How much they browse after waking up.
-   How much they browse late at night.
-   How their digital activity compares with physical activity in the
    future.

The product should feel like a combination of a fitness tracker, Spotify
Wrapped, and a playful social-statistics app.

It should be **fun enough to share, useful enough to keep, and
privacy-conscious by design**. It must not feel like another screen-time
guilt app.

### Product positioning

**ScrollMiles is a personal digital-life tracker with playful
statistics, habit insights, gamification, and social sharing.**

Potential messaging:

-   Your thumb has traveled places you haven't.
-   You walk miles. You scroll miles. Now count them.
-   How far did you scroll today?
-   Your week, in scrolling.

## 2. Product modules

### 2.1 Digital Activity

-   Scroll distance.
-   Scroll actions.
-   Active scrolling time.
-   Website-wise browser usage.
-   Browsing sessions.
-   Daily and weekly activity summaries.

### 2.2 Attention & Habits

-   Average and median browsing-session duration.
-   Longest uninterrupted browsing session.
-   Website/context switching frequency.
-   Short-session frequency.
-   Morning browsing activity.
-   Nighttime browsing activity.
-   Time from configured wake-up to first browsing session.

**Important:** Psychological attention span cannot be directly measured
from browser events. Describe these as behavioral proxies or "Focus &
Attention Patterns," not as a clinical or definitive attention score.

### 2.3 Physical Activity --- future

Potential integrations:

-   Steps.
-   Walking distance.
-   Workout duration.
-   Active minutes.
-   Android Health Connect.
-   Apple Health / HealthKit.
-   Other supported fitness platforms.

The longer-term opportunity is to compare digital and physical activity,
for example: "You spent six hours online and walked 8,400 steps." This
is not part of V1.

### 2.4 Gamification & Social

-   Daily Wrapped.
-   Weekly Wrapped.
-   Scrolling personality types.
-   Achievements and milestones.
-   Friend challenges.
-   Leaderboards.
-   Annual Wrapped.

Potential personality labels:

-   The Night Explorer.
-   Infinite Scroller.
-   Rabbit Hole Explorer.
-   Weekend Warrior.
-   Marathon Scroller.

Do not make users feel guilty or judged by these labels.

## 3. Product style and audience

### Style

A mix of:

-   Minimal, polished, Apple-like visual design.
-   Playful and quirky details.
-   Gamified achievements and milestones.
-   Social and shareable experiences.

Use a dark-first design with light-theme support, attractive typography,
clear metric cards, and clean charts. Avoid generic admin-dashboard
styling.

### Audience

People who enjoy discovering interesting statistics about themselves,
understanding their digital habits, and sharing amusing results with
friends.

### Viral loop

1.  User installs ScrollMiles.
2.  Browses normally.
3.  Discovers a surprising personal statistic.
4.  Generates a funny, attractive Wrapped card.
5.  Shares it with friends.
6.  Friends install ScrollMiles and compare results.

The strongest early signal is people voluntarily sharing their Wrapped
cards without being prompted.

## 4. Platform strategy

Build the first release for Chrome, while keeping the design extensible
to other platforms.

  Platform                   Potential capabilities                          Phase
  -------------------------- ----------------------------------------------- --------
  Chrome / Edge              Website usage, scrolling, browser sessions      V1
  Android                    App usage and supported scrolling events        V2
  Windows / macOS            Selected desktop application activity           V3
  Android Health Connect     Steps, activity, workouts                       Future
  Apple Health / HealthKit   Physical activity and workouts                  Future
  iOS                        Supported Screen Time and health integrations   Future

### Platform limitations

-   A Chrome extension can observe supported browser-page scrolling and
    browser tab activity, but not activity inside native desktop apps.
-   It cannot measure scrolling inside the native Instagram, WhatsApp,
    or YouTube mobile apps.
-   Android `UsageStatsManager` can provide app-level usage with
    user-granted Usage Access.
-   Android accessibility services have technical, policy, disclosure,
    and approval constraints. Do not assume a recreational tracker will
    be approved for broad scrolling surveillance.
-   iOS does not allow arbitrary observation of scrolling inside other
    apps. Screen Time and HealthKit APIs have specific capabilities,
    permissions, and entitlements.

Never promise cross-app tracking where the operating system does not
permit it.

## 5. V1 scope: Chrome extension

### Included

1.  Scroll distance in CSS pixels.
2.  Scroll action counting using scrolling bursts.
3.  Active scrolling duration.
4.  Website-wise browser usage.
5.  Website selection and exclusions.
6.  Daily statistics.
7.  Weekly statistics.
8.  Morning activity.
9.  Nighttime activity.
10. Session-duration and context-switching insights.
11. Daily and weekly charts.
12. Shareable daily and weekly Wrapped cards.
13. Privacy controls, pause, and delete-data functionality.
14. Local-first storage.

### Excluded from V1

-   Android or iOS apps.
-   Native desktop application tracking.
-   Physical activity integrations.
-   Accounts and authentication.
-   Cloud synchronization.
-   Friend leaderboards.
-   Social networking.
-   AI-generated insights.
-   Backend services.
-   Third-party analytics.

**V1 objective:** Ship a reliable, useful browser extension before
expanding to native platforms.

## 6. Technology stack

  Component                        Technology
  -------------------------------- ------------------------
  Browser extension framework      WXT
  UI framework                     React
  Language                         TypeScript
  Extension standard               Chrome Manifest V3
  Styling                          Tailwind CSS
  Charts                           Recharts
  Historical activity storage      IndexedDB
  Settings and lightweight state   `chrome.storage.local`
  Background coordination          MV3 service worker
  Scroll collection                Content scripts
  Extension messaging              `chrome.runtime`
  Browser tab state                `chrome.tabs`
  Browser window focus             `chrome.windows`
  Idle detection                   `chrome.idle`
  Image generation                 Canvas API
  Unit tests                       Vitest
  Browser integration tests        Playwright
  Package manager                  npm

Avoid introducing a backend, Redis, Kafka, RabbitMQ, or Kubernetes in
V1. They are not justified by the initial product requirements.

## 7. High-level architecture

``` text
Chrome Browser
  |
  +-- Content Scripts
  |     |
  |     +-- Scroll event collection
  |     +-- Scroll position deltas
  |     +-- Scroll burst detection
  |     +-- Batching and throttling
  |
  +-- Background Service Worker
  |     |
  |     +-- Runtime message handling
  |     +-- Active tab/window coordination
  |     +-- Idle-state coordination
  |     +-- Input validation
  |     +-- Aggregation coordination
  |
  +-- Activity Aggregation Engine
  |     |
  |     +-- Daily totals
  |     +-- Hourly buckets
  |     +-- Session analytics
  |     +-- Morning/night insights
  |     +-- Weekly statistics
  |
  +-- Local Persistence
  |     |
  |     +-- IndexedDB: historical activity aggregates
  |     +-- chrome.storage.local: settings and lightweight state
  |
  +-- React UI
        |
        +-- Extension popup
        +-- Full-page dashboard
        +-- Settings page
        +-- Daily/weekly charts
        +-- Wrapped preview and export
```

### Component responsibilities

**Content scripts** - Listen to supported page scroll events. - Track
scroll positions and deltas. - Detect scrolling bursts. - Batch
samples. - Send normalized data to the background service worker. -
Avoid collecting page text or other content.

**Background service worker** - Receive and validate activity
messages. - Coordinate active tab and window state. - Aggregate and
persist activity. - Handle browser lifecycle events. - Recover state
after service-worker suspension or restart.

**Activity aggregation engine** - Calculate daily totals. - Group
activity into hourly buckets. - Calculate session lengths. - Calculate
morning/night usage. - Generate weekly statistics.

**Dashboard** - Display daily metrics. - Display website breakdown. -
Render daily and weekly charts. - Show habit insights. - Generate
Wrapped cards.

MV3 service workers can be suspended. Do not depend on permanent
in-memory state or long-running background timers. Persist important
state and make aggregation safe across restarts.

## 8. Chrome APIs and permissions

Potential APIs:

  API                      Purpose
  ------------------------ -------------------------------------------
  `chrome.storage.local`   Settings and lightweight persistent state
  `chrome.runtime`         Messaging between extension components
  `chrome.tabs`            Active tab and tab changes
  `chrome.windows`         Browser window focus
  `chrome.idle`            Browser user idle state
  Content scripts          Page scroll collection
  `chrome.scripting`       Dynamic script injection if needed
  IndexedDB                Historical activity aggregates
  `chrome.action`          Toolbar popup
  Canvas API               Wrapped image rendering

Use the minimum permissions necessary.

Consider optional host permissions and an explicit onboarding choice: -
Enable tracking on supported websites after granting host access. - Or
select specific websites through optional host permissions.

Explain clearly why website access is needed. Do not silently assume
broad access.

A preliminary Manifest V3 example (adapt to WXT's generated
configuration):

``` json
{
  "manifest_version": 3,
  "name": "ScrollMiles",
  "version": "0.1.0",
  "description": "Your digital life, measured.",
  "permissions": ["storage"],
  "optional_host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/index.js",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html"
  }
}
```

Do not copy this blindly into a WXT project; configure the manifest
through WXT's supported configuration and entrypoint conventions.

## 9. Measurement definitions and algorithms

### 9.1 Scroll distance

Canonical metric: cumulative absolute vertical displacement in CSS
pixels.

\[ D = `\sum`{=tex}*{i=1}\^{n} \|y_i-y*{i-1}\| \]

Example: - Scroll down 500 px. - Scroll up 200 px. - Total distance =
700 CSS px.

Keep CSS pixels as the source of truth. Any conversion to metres or
kilometres is an estimated screen-equivalent distance, not actual
physical finger travel.

### 9.2 Scroll actions

A scroll action is one continuous scrolling burst, not one DOM event.

Starting idle timeout: 2 seconds.

Example: - Several scroll events within two seconds count as one
action. - A pause longer than two seconds followed by scrolling starts a
new action.

### 9.3 Active scrolling time

Estimate active scrolling duration from consecutive scroll-event
timestamps, capping gaps at the idle timeout.

\[ T = `\sum`{=tex}*i `\min`{=tex}(t_i-t*{i-1}, 2000) \]

Use a monotonic clock such as `performance.now()` inside the
content-script context.

Do not use a service-worker `setInterval()` as the source of truth. The
service worker may be suspended.

### 9.4 Website usage time

Attribute time only when: - The browser window is focused. - The tab is
active. - The browser user state is not idle. - Tracking is enabled. -
The website is selected and supported.

This measures browser-active time, not proof that a user is looking at
the screen.

### 9.5 Attention proxies

Measure: - Average and median session length. - Longest uninterrupted
browsing session. - Website/context switches. - Number of short
sessions. - Time spent in continuous activity.

Do not claim to measure psychological attention span.

### 9.6 Morning and nighttime activity

Let users configure their own wake-up and bedtime.

Example: - Wake-up: 07:00. - Morning window: first 60 minutes after
waking. - Night window: 22:00--06:00.

Calculate: - Morning browsing duration. - Time until first browsing
session. - Night browsing duration. - Number of late-night sessions.

Initial preference: manually configured wake-up and bedtime. Automatic
routine detection can be considered later.

## 10. Storage model

Use IndexedDB for historical activity aggregates and
`chrome.storage.local` for settings.

Proposed logical entities:

``` text
daily_summary
  date
  timezone
  total_active_time
  total_scroll_distance
  total_scroll_actions
  morning_usage
  night_usage

site_daily_stats
  date
  site_id
  active_time
  scroll_distance
  scroll_actions
  sessions

activity_sessions
  session_id
  site_id
  started_at
  ended_at
  duration_ms
  scroll_distance

hourly_stats
  date
  hour
  active_time
  scroll_distance
  scroll_actions

settings
  tracking_enabled
  selected_sites
  excluded_sites
  wake_time
  bedtime
  morning_window
  night_window
  idle_timeout
  theme
```

Storage principles: - Do not persist full browsing URLs. - Use a minimal
site identifier, such as an approved hostname or normalized domain. -
Keep schema versions and migrations. - Serialize aggregate updates. -
Make batch application idempotent. - Use bounded deduplication
records. - Apply retention to historical data. - Recover correctly after
service-worker termination.

## 11. Dashboard and Wrapped

### Daily dashboard

Display: - Total browser-active time. - Scroll distance. - Scroll
actions. - Website-wise time breakdown. - Morning activity. - Night
activity. - Hourly activity chart. - Scrolling personality.

### Weekly dashboard

Display: - Weekly scroll distance. - Total active time. - Total scroll
actions. - Average daily activity. - Most active day. - Hourly
heatmap. - Previous-week comparison.

### Wrapped image generation

Use the browser Canvas API to generate PNGs locally.

Recommended dimensions:

  Format            Dimensions
  ----------------- -------------
  Instagram Story   1080 × 1920
  Square post       1200 × 1200

Card ideas: - Your scrolling personality. - Your longest session. - Your
biggest scrolling day. - Morning versus nighttime habits. - Your weekly
distance. - Your most active hour.

Offer download and, where supported, native share functionality. Do not
include browsing history, full URLs, or personally identifying
information by default.

## 12. Privacy and security

Privacy is a core product requirement.

### Allowed data

-   Scroll distance.
-   Scroll action counts.
-   Activity duration.
-   Minimal website identifiers required for aggregation.
-   Hourly activity summaries.

### Never collect

-   Page text or DOM contents.
-   Passwords.
-   Keystrokes.
-   Search queries.
-   Screenshots.
-   Form input.
-   Full browsing history.

### Safeguards

1.  Local-first storage.
2.  Explicit website permissions.
3.  Optional website selection.
4.  Global tracking pause.
5.  Sensitive-site exclusions.
6.  Incognito tracking disabled by default.
7.  Clear-all-data control.
8.  No third-party analytics.
9.  No external network requests in V1.
10. Accurate Chrome Web Store privacy disclosures.
11. Validate message types, payload sizes, and sender context.
12. Avoid unnecessary permissions and dependencies.

## 13. Development environment

The developer will use: - VS Code. - GitHub Copilot Business. -
GitHub. - Node.js. - npm. - Git.

Repository: - Name: `scrollmiles`. - Visibility: private initially. -
README enabled. - Node `.gitignore`. - No license until public
distribution decisions are made.

If Copilot Business is employer-provided, verify organizational policy
before using it for personal-project development.

### Initial setup

Create a private repository on GitHub, then:

``` bash
git clone https://github.com/YOUR_USERNAME/scrollmiles.git
cd scrollmiles
code .
```

Verify tooling:

``` bash
node -v
npm -v
git --version
```

Initialize WXT:

``` bash
npx wxt@latest init
```

Select React, TypeScript, and npm where prompted.

Then:

``` bash
npm install
npm run dev
```

Load the generated Chromium build through `chrome://extensions` with
Developer Mode enabled.

## 14. Copilot repository instructions

Create `.github/copilot-instructions.md` with these principles:

``` markdown
# ScrollMiles — Copilot Instructions

## Product
ScrollMiles is a playful, privacy-first digital-life tracker.

It measures digital activity and turns it into interesting statistics,
insights, achievements, and shareable reports.

Tagline: Your digital life, measured.

## V1
Build a Chrome Extension using Manifest V3.

Features:
- Scroll distance
- Scroll actions
- Active scrolling time
- Website usage time
- Morning and nighttime usage
- Browsing session analytics
- Daily and weekly dashboards
- Shareable Wrapped cards

## Technology
- WXT
- React
- TypeScript
- Tailwind CSS
- Recharts
- IndexedDB
- chrome.storage.local
- Vitest
- Playwright

## Architecture
Separate tracking, aggregation, storage, analytics, UI, and Wrapped generation.

Use content scripts for scroll collection and an MV3 service worker for coordination.

## Privacy
- Local-first.
- No backend in V1.
- Never collect page contents.
- Never collect passwords or keystrokes.
- Do not persist full URLs.
- Do not track incognito sessions by default.
- Request minimum permissions.
- Allow users to pause and delete tracking data.

## Engineering
- Strict TypeScript.
- Small modular components.
- Unit tests for tracking algorithms.
- Handle service-worker restarts.
- Make aggregation idempotent.
- Avoid duplicate counting.
- Avoid unnecessary dependencies.

## Product Design
- Minimal and playful.
- Dark-first, with light theme.
- Attractive charts and metric cards.
- Gamification without guilt or judgment.
- Clearly label estimated metrics.
- Treat attention metrics as behavioral proxies, not diagnoses.

## Workflow
- Implement one milestone at a time.
- Inspect existing files before modifying them.
- Explain architectural changes.
- Run build and tests after implementation.
- Do not overwrite working configuration without reason.
```

## 15. First Copilot task

Use GitHub Copilot Chat in Agent Mode with this prompt:

``` text
We are starting development of ScrollMiles.

Product vision:
ScrollMiles is a playful, privacy-first digital-life tracker
that measures how people spend their time online.

V1 is a Chrome extension.

Technology:
- WXT
- React
- TypeScript
- Tailwind CSS
- Manifest V3
- IndexedDB
- chrome.storage.local
- Recharts
- Vitest

First task: inspect the generated WXT project and implement
the application foundation.

Requirements:

1. Keep the existing WXT configuration working.
2. Create a React-based popup.
3. Create a full-page dashboard.
4. Create an options/settings page.
5. Organize source into tracking, storage, analytics,
   components, types and wrapped modules.
6. Configure Tailwind CSS.
7. Configure Vitest.
8. Enable strict TypeScript.
9. Add a README.
10. Add .github/copilot-instructions.md.

Design:
- ScrollMiles branding.
- Tagline: Your digital life, measured.
- Dark-first design with light theme support.
- Modern, minimal and slightly playful.
- Attractive metric cards and typography.
- Avoid generic admin-dashboard styling.

Constraints:
- Do not implement tracking yet.
- Do not add a backend.
- Do not add authentication.
- Do not request unnecessary permissions.
- Do not add external analytics.
- Do not collect browsing data yet.

Before implementation:
1. Inspect the current project.
2. Explain the folder structure.
3. Explain dependencies.
4. Explain architectural decisions.

After implementation:
1. Run the production build.
2. Run tests.
3. Fix errors.
4. Report files created.
5. Explain remaining issues.

Do not overwrite working WXT configuration unnecessarily.
```

## 16. Repository structure target

``` text
scrollmiles/
│
├── .github/
│   └── copilot-instructions.md
│
├── entrypoints/
│   ├── background.ts
│   ├── content.ts
│   ├── popup/
│   │   ├── index.html
│   │   └── App.tsx
│   ├── dashboard/
│   │   ├── index.html
│   │   └── App.tsx
│   └── options/
│       ├── index.html
│       └── App.tsx
│
├── src/
│   ├── tracking/
│   │   ├── ScrollTracker.ts
│   │   ├── ScrollSession.ts
│   │   ├── UsageTracker.ts
│   │   └── BatchManager.ts
│   ├── aggregation/
│   │   ├── ActivityAggregator.ts
│   │   └── DailyAggregator.ts
│   ├── storage/
│   │   ├── StatsRepository.ts
│   │   ├── SettingsRepository.ts
│   │   └── migrations.ts
│   ├── analytics/
│   │   ├── DailyStats.ts
│   │   ├── WeeklyStats.ts
│   │   └── DateUtils.ts
│   ├── wrapped/
│   │   ├── CardRenderer.ts
│   │   ├── ExportService.ts
│   │   └── templates/
│   ├── components/
│   ├── types/
│   └── utils/
│
├── tests/
│   ├── tracking/
│   ├── aggregation/
│   ├── storage/
│   └── analytics/
│
├── public/
│   └── icons/
│
├── README.md
├── package.json
├── tsconfig.json
└── wxt.config.ts
```

This is a target structure. Do not create empty files for every module
on day one. Let the implementation grow as features are developed.

## 17. Development roadmap

  Milestone   Deliverable                            Estimated duration
  ----------- ------------------------------------ --------------------
  M1          Project foundation                              1--2 days
  M2          Scroll tracking engine                          3--4 days
  M3          Website usage and session tracking              2--3 days
  M4          Local storage and aggregation                      2 days
  M5          Daily and weekly analytics                         3 days
  M6          Wrapped and achievements                        2--3 days
  M7          Testing, privacy and beta                          3 days

These are estimates for focused development, not committed deadlines.

Suggested feature branches:

``` text
main
├── feature/project-setup
├── feature/scroll-tracking
├── feature/activity-engine
├── feature/local-storage
├── feature/dashboard
└── feature/wrapped
```

Example commits:

``` bash
git commit -m "chore: initialize ScrollMiles extension"
git commit -m "feat: implement scroll tracking"
git commit -m "feat: add activity aggregation"
git commit -m "feat: add daily analytics dashboard"
git commit -m "feat: generate wrapped cards"
```

## 18. Testing requirements

Measurement reliability matters more than dashboard polish.

  Test                       Expected behavior
  -------------------------- --------------------------------------
  Scroll down 1,000 px       Add 1,000 px
  Scroll up 500 px           Add 500 px
  Continuous scroll events   One scroll action
  Pause for 3 seconds        Next scroll starts a new action
  Switch tabs                Stop attributing activity to old tab
  Inactive browser           No active browsing time
  Multiple tabs              Correct aggregation
  Browser restart            Previous totals retained
  Service-worker restart     No duplicate increments
  Delete data                All historical statistics removed
  Timezone change            Correct daily grouping

Also test: - Infinite-scroll pages. - Nested scrollable panels. -
Single-page applications. - Zoom levels. - Browser sleep and resume. -
Daylight-saving changes. - Long sessions. - Browser crashes.

Performance goals: - No perceptible browsing lag. - No synchronous disk
writes in event handlers. - Bounded message queues. - No unnecessary
background polling. - Low memory consumption. - No external network
requests in V1.

## 19. Success criteria

Initial beta targets (hypotheses to validate, not industry benchmarks):

  Metric                              Initial target
  --------------------------------- ----------------
  Installation → first statistics               80%+
  Day-7 retention                               25%+
  Weekly share-card creation                    15%+
  Crash-free sessions                           99%+
  Noticeable tracking lag                       None

The most important early signal is users voluntarily sharing their
ScrollMiles Wrapped.

## 20. Future roadmap

  Version   Scope
  --------- -----------------------------------------
  V1        Chrome digital activity tracker
  V2        Android app usage and insights
  V3        Accounts, cloud sync, friend challenges
  V4        Physical activity integrations
  V5        Cross-platform digital-life dashboard

Potential future integrations: - Android Health Connect. - Apple
Health. - Fitness tracking services. - Wearables. - Other supported
application integrations.

Do not build these before validating V1.

## 21. Current project status

At the time of this handoff:

-   Product vision: defined.
-   V1 scope: defined.
-   Technical architecture: planned.
-   Technology stack: selected.
-   Development environment: VS Code.
-   AI coding assistant: GitHub Copilot Business.
-   Repository: `scrollmiles` planned, not yet confirmed created.
-   WXT project: not yet confirmed initialized.
-   First extension build: pending.
-   Scroll tracking implementation: pending.

## 22. Immediate next steps

1.  Create a private GitHub repository named `scrollmiles`.
2.  Clone it into VS Code.
3.  Verify Node.js, npm, and Git.
4.  Initialize WXT with React and TypeScript.
5.  Configure GitHub Copilot Agent Mode.
6.  Add `.github/copilot-instructions.md`.
7.  Give Copilot the initial project setup prompt.
8.  Run the extension locally in Chrome.
9.  Review the generated project structure.
10. Commit the working foundation.

Do not start implementing the tracking engine until the extension
foundation builds and loads successfully.

## 23. Instruction for future AI assistants

Act as the senior software architect, product engineering partner, and
code reviewer for ScrollMiles.

Help build the product incrementally. Do not implement the entire
product in one task.

First establish a working extension foundation. Then implement scroll
tracking, activity attribution, storage, analytics, Wrapped, and
testing.

Be opinionated about engineering decisions. Identify browser and
operating-system limitations. Challenge unnecessary complexity.
Prioritize a reliable, polished, privacy-conscious product over shipping
many features.

The immediate milestone is simple:

**Get ScrollMiles running inside Chrome for the first time.**
