import { BURST_GAP_MS } from '../analytics/metrics';

/** Pure measurement logic. Does not read the page or know about Chrome. */
export class ScrollTracker {
  private lastEvent: number | undefined;
  distancePx = 0;
  actions = 0;
  activeMs = 0;

  record(delta: number, time: number): void {
    if (!Number.isFinite(delta) || !Number.isFinite(time) || delta === 0) return;
    const gap = this.lastEvent === undefined ? Infinity : time - this.lastEvent;
    if (gap < 0) return;
    this.distancePx += Math.abs(delta);
    if (gap >= BURST_GAP_MS) this.actions += 1;
    else this.activeMs += gap;
    this.lastEvent = time;
  }

  breakBurst(): void {
    this.lastEvent = undefined;
  }
}