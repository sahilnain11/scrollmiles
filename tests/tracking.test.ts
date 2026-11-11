import { describe, expect, it } from 'vitest';
import { ScrollTracker } from '../src/tracking/ScrollTracker';

describe('scroll measurement', () => {
  it('adds absolute movement in both directions', () => {
    const tracker = new ScrollTracker();
    tracker.record(1_000, 0);
    tracker.record(-500, 100);
    expect(tracker.distancePx).toBe(1_500);
    expect(tracker.actions).toBe(1);
    expect(tracker.activeMs).toBe(100);
  });
  it('starts a new action after a two-second gap without counting idle time', () => {
    const tracker = new ScrollTracker();
    tracker.record(100, 0);
    tracker.record(100, 100);
    tracker.record(100, 3_100);
    expect(tracker.actions).toBe(2);
    expect(tracker.activeMs).toBe(100);
  });
  it('treats the exact timeout as a new burst', () => {
    const tracker = new ScrollTracker();
    tracker.record(10, 0);
    tracker.record(10, 2_000);
    expect(tracker.actions).toBe(2);
    expect(tracker.activeMs).toBe(0);
  });
  it('does not bridge tab switches or pause/resume', () => {
    const tracker = new ScrollTracker();
    tracker.record(10, 0);
    tracker.breakBurst();
    tracker.record(10, 100);
    expect(tracker.actions).toBe(2);
    expect(tracker.activeMs).toBe(0);
  });
  it('ignores zero, malformed and out-of-order samples', () => {
    const tracker = new ScrollTracker();
    tracker.record(0, 0);
    tracker.record(NaN, 1);
    tracker.record(10, 10);
    tracker.record(20, 9);
    tracker.record(10, Infinity);
    expect(tracker.distancePx).toBe(10);
    expect(tracker.actions).toBe(1);
  });
});