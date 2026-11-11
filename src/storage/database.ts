import { openDB, type DBSchema } from 'idb';
import { daysAgo, emptyDay, localDate, RETENTION_DAYS } from '../analytics/metrics';
import type { Checkpoint, DayStats, SiteHourStats } from '../types';

export const STATS_DB_VERSION = 2;

interface StatsDatabase extends DBSchema {
  days: { key: string; value: DayStats };
  checkpoints: { key: string; value: Checkpoint; indexes: { date: string } };
  siteHours: { key: [string, string, number]; value: SiteHourStats; indexes: { date: string; site: string } };
}

export function openStatsDatabase(name = 'scrollmiles') {
  return openDB<StatsDatabase>(name, STATS_DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('days', { keyPath: 'date' });
        db.createObjectStore('checkpoints').createIndex('date', 'date');
      }
      if (oldVersion < 2) {
        const store = db.createObjectStore('siteHours', { keyPath: ['site', 'date', 'hour'] });
        store.createIndex('date', 'date');
        store.createIndex('site', 'site');
      }
    },
  });
}

export type StatsConnection = Awaited<ReturnType<typeof openStatsDatabase>>;

export async function applyCheckpoint(db: StatsConnection, incoming: Checkpoint, site?: string): Promise<void> {
  if (site !== undefined && incoming.hour === undefined) throw new Error('Hourly collector required for website insights. Reload the website.');
  // Both the counters and their deduplication checkpoint commit atomically.
  const transaction = db.transaction(['days', 'checkpoints', 'siteHours'], 'readwrite');
  const checkpoints = transaction.objectStore('checkpoints');
  const key = `${incoming.epoch}:${incoming.streamId}:${incoming.date}${incoming.hour === undefined ? '' : `:${incoming.hour}`}`;
  const previous = await checkpoints.get(key);
  if (previous && incoming.sequence <= previous.sequence) {
    await transaction.done;
    return;
  }
  if (previous && (incoming.distancePx < previous.distancePx || incoming.actions < previous.actions || incoming.activeMs < previous.activeMs)) {
    transaction.abort();
    await transaction.done.catch(() => undefined);
    throw new Error('Counters cannot move backwards.');
  }
  const days = transaction.objectStore('days');
  const day = await days.get(incoming.date) ?? emptyDay(incoming.date);
  const delta = {
    distancePx: incoming.distancePx - (previous?.distancePx ?? 0),
    actions: incoming.actions - (previous?.actions ?? 0),
    activeMs: incoming.activeMs - (previous?.activeMs ?? 0),
  };
  day.distancePx += delta.distancePx;
  day.actions += delta.actions;
  day.activeMs += delta.activeMs;
  await days.put(day);
  if (site !== undefined && incoming.hour !== undefined) {
    const hours = transaction.objectStore('siteHours');
    const detail = await hours.get([site, incoming.date, incoming.hour])
      ?? { ...emptyDay(incoming.date), site, hour: incoming.hour };
    detail.distancePx += delta.distancePx;
    detail.actions += delta.actions;
    detail.activeMs += delta.activeMs;
    await hours.put(detail);
  }
  await checkpoints.put(incoming, key);
  await transaction.done;
}

export async function pruneHistory(db: StatsConnection, now = new Date()): Promise<void> {
  const cutoff = daysAgo(RETENTION_DAYS - 1, now);
  const transaction = db.transaction(['days', 'checkpoints', 'siteHours'], 'readwrite');
  await transaction.objectStore('days').delete(IDBKeyRange.upperBound(cutoff, true));
  let cursor = await transaction.objectStore('checkpoints').index('date').openCursor(IDBKeyRange.upperBound(cutoff, true));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  let detail = await transaction.objectStore('siteHours').index('date').openCursor(IDBKeyRange.upperBound(cutoff, true));
  while (detail) {
    await detail.delete();
    detail = await detail.continue();
  }
  await transaction.done;
}

export async function clearHistory(db: StatsConnection): Promise<void> {
  const transaction = db.transaction(['days', 'checkpoints', 'siteHours'], 'readwrite');
  await transaction.objectStore('days').clear();
  await transaction.objectStore('checkpoints').clear();
  await transaction.objectStore('siteHours').clear();
  await transaction.done;
}

export async function getWeek(db: StatsConnection): Promise<DayStats[]> {
  return db.getAll('days', IDBKeyRange.bound(daysAgo(6), localDate()));
}

export async function getSiteWeek(db: StatsConnection): Promise<SiteHourStats[]> {
  return db.getAllFromIndex('siteHours', 'date', IDBKeyRange.bound(daysAgo(6), localDate()));
}

/** Detailed deletion never deletes anonymous totals or deduplication state. */
export async function clearSiteHistory(db: StatsConnection, site?: string): Promise<void> {
  const transaction = db.transaction('siteHours', 'readwrite');
  if (site === undefined) await transaction.store.clear();
  else {
    let cursor = await transaction.store.index('site').openCursor(IDBKeyRange.only(site));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await transaction.done;
}