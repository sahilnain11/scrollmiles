import { BURST_GAP_MS, localDate } from '../analytics/metrics';

export interface HourDelta {
  date: string;
  hour: number;
  distancePx: number;
  actions: number;
  activeMs: number;
}

function bucket(at: number): HourDelta {
  const date = new Date(at);
  return { date: localDate(date), hour: date.getHours(), distancePx: 0, actions: 0, activeMs: 0 };
}

/** Pure event attribution. Cumulative persistence/batching stays elsewhere. */
export class HourlyScrollTracker {
  private last: { monotonic: number; wall: number; zone: string } | undefined;

  record(delta: number, monotonic: number, wall: number, zone: string): HourDelta[] {
    if (![delta, monotonic, wall].every(Number.isFinite) || delta === 0) return [];
    if (this.last && monotonic < this.last.monotonic) return [];
    const current = bucket(wall);
    current.distancePx = Math.abs(delta);
    const gap = this.last ? monotonic - this.last.monotonic : Infinity;
    const wallGap = this.last ? wall - this.last.wall : Infinity;
    // Break on clock/timezone discontinuities rather than inventing time.
    const continuous = this.last && gap < BURST_GAP_MS && wallGap >= 0
      && Math.abs(wallGap - gap) < 100 && zone === this.last.zone;
    const result = [current];
    if (!continuous) current.actions = 1;
    else {
      const previous = bucket(this.last!.wall);
      if (previous.date === current.date && previous.hour === current.hour) current.activeMs = gap;
      else {
        // A continuous gap is <2s, so at most one hour/day boundary is crossed.
        // Repeated DST hours intentionally merge into the same local hour.
        const date = new Date(wall);
        const intoHour = date.getMinutes() * 60_000 + date.getSeconds() * 1_000 + date.getMilliseconds();
        current.activeMs = Math.min(gap, intoHour);
        previous.activeMs = gap - current.activeMs;
        if (previous.activeMs > 0) result.unshift(previous);
      }
    }
    this.last = { monotonic, wall, zone };
    return result;
  }

  breakBurst(): void { this.last = undefined; }
}