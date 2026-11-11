export const PRIVACY_UPDATED = '2026-11-11';

export const privacySections = [
  {
    title: 'What stays on your device',
    paragraphs: [
      'ScrollMiles stores daily vertical scroll distance in CSS pixels, burst counts, and estimated active scrolling duration. Daily totals combine enabled websites; they do not contain website identifiers.',
      'Optional Website insights is off by default. Only after a separate in-app confirmation, new scrolling is also grouped by exact scheme/hostname, local date, and hour. These local aggregates contain distance, burst-start counts, and active scrolling time. They can reveal which sites you scrolled on and roughly when. Existing anonymous history is never backfilled. No additional Chrome permission is requested.',
      'Local settings contain your approved and excluded website schemes and hostnames (such as https://example.com), all-site and insights opt-in choices, the insights enable time, pause state, theme, a random policy identifier, and any pending site-history deletion intent. Retry-safe checkpoints contain random document/bucket identifiers, cumulative measurements, date, optional hour, timezone, sequence, and the most recent checkpoint timestamp. Checkpoints do not contain hostnames, page titles, paths, or content.',
    ],
  },
  {
    title: 'What the collector reads—and what it does not',
    paragraphs: [
      'On websites covered by your selected-site permissions or explicit all-site opt-in, the collector reads vertical scroll positions, container dimensions, event timing, visibility, and focus. Exclusions stop measurement. Pointer, wheel, and touch events are used only to establish scroll geometry; their input values are not recorded. Automatic page scrolling can be included.',
      'It does not read page text, form values, passwords, keystrokes, search queries, screenshots, or audio. The browser supplies a sender URL in memory so the extension can validate website access. Only the scheme and hostname are used for that check; full URLs, paths, queries, and fragments are not saved or sent elsewhere. Incognito tracking is prohibited.',
    ],
  },
  {
    title: 'Website access is always your choice',
    paragraphs: [
      'By default, nothing is tracked until you enter a website and grant Chrome access. Individual permissions cover all paths and ports for an exact scheme and hostname; subdomains and HTTP/HTTPS are separate. You can instead explicitly opt in to All supported websites in settings. Chrome then asks once for access to HTTP and HTTPS websites, including subdomains. This is off by default and is never enabled by an update or by an existing wider Chrome permission alone.',
      'All-site mode includes sensitive banking, health, or work sites unless you exclude them. Exclusions use exact scheme/hostname matches; excluding an apex domain does not exclude its www or other subdomains. Exclusions prevent ScrollMiles collection but do not revoke Chrome’s broader permission. Browser-protected pages and incognito are never supported.',
      'Website insights is a separate choice from website access and all-site mode. When enabled it applies to future scrolling on the websites your access controls allow. Pause, permission removal, and exclusions still stop collection. Merely watching a video, being on a tab, or spending time on a website is not measured by this feature.',
      'Chrome describes website access broadly because it technically allows an extension to read and change website data. ScrollMiles uses it only to run its scrolling collector. Decline a request, pause collection, remove an individual enabled website, exclude a website in all-site mode, or revoke access in Chrome. Pause keeps permissions and choices for later. Turning off all-site access revokes wildcard and covered host permissions, returns to an empty selected-site list, and preserves earlier totals and exclusions. If broad permission is partially revoked externally, ScrollMiles fails closed to no enabled websites.',
    ],
  },
  {
    title: 'No servers, accounts, or analytics',
    paragraphs: [
      'The production extension makes no external network requests and includes no accounts, cloud sync, advertising, remote fonts, or third-party analytics. The developer does not receive your activity or enabled website list. Dependencies and icons are packaged locally.',
      'This notice describes the production beta, not development tooling, Chrome itself, operating-system backups, or services you separately choose to use.',
    ],
  },
  {
    title: 'Retention and deletion',
    paragraphs: [
      'Anonymous totals, optional website/hour aggregates, and retry checkpoints are limited to the most recent 90 local calendar days. Older records are removed when the extension next starts or processes statistics; no always-running cleanup timer is used. The dashboard reads a rolling seven days. Website access choices, exclusions, insight preference, and theme remain until you change them or uninstall the extension.',
      'Turn off & delete website insights stops detailed recording and erases all website/hour aggregates while keeping anonymous totals. Delete website history removes all retained details for one exact website without changing combined totals; future scrolling can be recorded again while insights remains on. Pause or exclude/remove a website separately to stop future activity. Deletion invalidates old messages; pending detailed deletion is completed again after a worker interruption.',
      'Delete history removes all recorded anonymous and detailed totals and checkpoints and pauses collection. Website choices, exclusions, insights and all-site preferences/permissions, and theme stay saved; delete is not permission revocation. Removing or excluding a website stops future tracking but does not erase existing history automatically. Uninstalling removes extension-managed data from that Chrome profile; it cannot erase separate backups or exported files.',
    ],
  },
  {
    title: 'Wrapped is a file you control',
    paragraphs: [
      'Wrapped images are drawn locally and downloaded only when you choose. They contain the selected daily or seven-day totals, not browsing history or website names. Nothing is uploaded or posted automatically.',
      'A downloaded PNG remains outside extension storage. Delete or share that file yourself; clearing history cannot remove existing exports, copies, or images you have shared.',
    ],
  },
  {
    title: 'Beta limits and future changes',
    paragraphs: [
      'Screen-equivalent distance is an estimate, not physical finger travel or exercise. Active scrolling time is not total browser usage or a measure of psychological attention. Abrupt closure can lose an unacknowledged batch.',
      'This notice covers the current local-only beta. New collection, networking, or permissions require an updated notice and an explicit product decision. No public release or store submission is authorized by this notice. A publisher identity and support/contact route must be added before public distribution.',
    ],
  },
] as const;