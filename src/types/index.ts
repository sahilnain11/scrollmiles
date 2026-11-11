export interface Settings {
  trackingEnabled: boolean;
  approvedSites: string[];
  allSitesEnabled: boolean;
  excludedSites: string[];
  siteInsightsEnabled: boolean;
  siteInsightsSince: number | null;
  /** Durable delete intent, completed again after a worker interruption. */
  pendingSiteDeletion?: string;
  epoch: string;
  theme: 'dark' | 'light';
}

export interface DayStats {
  date: string;
  distancePx: number;
  actions: number;
  activeMs: number;
}

/** Cumulative counters, not increments: resending a checkpoint is safe. */
export interface Checkpoint extends DayStats {
  /** Present only for opted-in hourly collection. Never contains a hostname. */
  hour?: number;
  epoch: string;
  streamId: string;
  sequence: number;
  timezone: string;
  recordedAt: number;
}

export interface SiteHourStats extends DayStats {
  site: string;
  hour: number;
}

export interface Snapshot {
  settings: Settings;
  days: DayStats[];
  siteHours?: SiteHourStats[];
  /** Absent in an older worker: the UI must not request unsupported access. */
  capabilities?: { allSiteAccess: boolean; siteInsights?: boolean };
}

export type Request =
  | { type: 'GET_SNAPSHOT' }
  | { type: 'GET_SETTINGS' }
  | { type: 'CHECKPOINT'; checkpoint: Checkpoint }
  | { type: 'SET_TRACKING'; enabled: boolean }
  | { type: 'SET_THEME'; theme: Settings['theme'] }
  | { type: 'ADD_SITE'; site: string }
  | { type: 'REMOVE_SITE'; site: string }
  | { type: 'SET_ALL_SITES'; enabled: boolean }
  | { type: 'EXCLUDE_SITE'; site: string }
  | { type: 'INCLUDE_SITE'; site: string }
  | { type: 'SET_SITE_INSIGHTS'; enabled: boolean }
  | { type: 'DELETE_SITE_INSIGHTS'; site: string }
  | { type: 'CLEAR_DATA' };

export type Response<T> = { ok: true; data: T } | { ok: false; error: string };