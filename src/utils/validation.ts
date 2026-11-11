import { daysAgo, localDate, RETENTION_DAYS } from '../analytics/metrics';
import type { Checkpoint } from '../types';

const UUID = /^[a-f0-9-]{36}$/i;
const CHECKPOINT_KEYS = new Set([
  'date', 'distancePx', 'actions', 'activeMs', 'epoch', 'streamId',
  'sequence', 'timezone', 'recordedAt', 'hour',
]);

export function isCheckpoint(value: unknown, now = Date.now()): value is Checkpoint {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  // Never persist arbitrary message fields (e.g. a mistakenly attached URL).
  if (Object.keys(data).some((key) => !CHECKPOINT_KEYS.has(key))) return false;
  const finite = (key: string, max: number) => typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0 && data[key] <= max;
  return typeof data.epoch === 'string' && UUID.test(data.epoch)
    && typeof data.streamId === 'string' && UUID.test(data.streamId)
    && typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
    && !Number.isNaN(Date.parse(`${data.date}T12:00:00Z`))
    && new Date(`${data.date}T12:00:00Z`).toISOString().slice(0, 10) === data.date
    && data.date >= daysAgo(RETENTION_DAYS - 1, new Date(now)) && data.date <= localDate(new Date(now))
    && typeof data.timezone === 'string' && data.timezone.length <= 100
    && finite('sequence', Number.MAX_SAFE_INTEGER) && Number.isInteger(data.sequence)
    && finite('distancePx', 1e12) && finite('actions', 1e7) && Number.isInteger(data.actions)
    && finite('activeMs', 86_400_000)
    && (data.hour === undefined || (finite('hour', 23) && Number.isInteger(data.hour)))
    && typeof data.recordedAt === 'number' && Number.isFinite(data.recordedAt)
    && data.recordedAt <= now + 60_000 && data.recordedAt >= now - 86_400_000;
}