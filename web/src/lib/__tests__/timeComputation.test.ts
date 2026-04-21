import { describe, it, expect } from 'vitest';
import {
  roundToQuarterHour,
  computeLineItemHours,
  computeLineItemCost,
  computeLineItemEffectiveHours,
} from '../timeComputation';
import type { TimeEntry } from '../types';

function makeEntry(overrides: Partial<TimeEntry> & { durationSeconds: number; lineItemId?: string }): TimeEntry {
  return {
    id: crypto.randomUUID(),
    ownerId: 'owner1',
    clientId: 'client1',
    description: '',
    isBillable: true,
    startedAt: new Date(),
    endedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('roundToQuarterHour', () => {
  it('returns 0 for 0 seconds', () => {
    expect(roundToQuarterHour(0)).toBe(0);
  });

  it('rounds down 1-7 minutes past a quarter boundary', () => {
    // 22 minutes = 15 + 7 → round down to 15 min = 0.25h
    expect(roundToQuarterHour(22 * 60)).toBe(0.25);
  });

  it('rounds up 8-14 minutes past a quarter boundary', () => {
    // 23 minutes = 15 + 8 → round up to 30 min = 0.5h
    expect(roundToQuarterHour(23 * 60)).toBe(0.5);
  });

  it('does not change exact quarter boundaries', () => {
    expect(roundToQuarterHour(15 * 60)).toBe(0.25);
    expect(roundToQuarterHour(30 * 60)).toBe(0.5);
    expect(roundToQuarterHour(45 * 60)).toBe(0.75);
    expect(roundToQuarterHour(60 * 60)).toBe(1);
  });

  it('handles 2h 22m → 2h 15m (spec example)', () => {
    expect(roundToQuarterHour(142 * 60)).toBe(2.25);
  });

  it('handles 2h 23m → 2h 30m (spec example)', () => {
    expect(roundToQuarterHour(143 * 60)).toBe(2.5);
  });

  it('rounds down at exactly 7 minutes past', () => {
    // 7 minutes = 0 + 7 → round down to 0
    expect(roundToQuarterHour(7 * 60)).toBe(0);
  });

  it('rounds up at exactly 8 minutes past', () => {
    // 8 minutes = 0 + 8 → round up to 15 min
    expect(roundToQuarterHour(8 * 60)).toBe(0.25);
  });
});

describe('computeLineItemHours', () => {
  it('returns 0 when no entries match', () => {
    const entries = [makeEntry({ durationSeconds: 3600, lineItemId: 'other' })];
    expect(computeLineItemHours(entries, 'target', false)).toBe(0);
  });

  it('sums matching entries and converts to hours', () => {
    const entries = [
      makeEntry({ durationSeconds: 3600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 1800, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 3600, lineItemId: 'other' }),
    ];
    expect(computeLineItemHours(entries, 'target', false)).toBeCloseTo(1.5);
  });

  it('applies rounding when enabled', () => {
    const entries = [
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
    ];
    expect(computeLineItemHours(entries, 'target', true)).toBe(0.5);
  });

  it('applies rounding to aggregate sum not per-entry', () => {
    const entries = [
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
    ];
    expect(computeLineItemHours(entries, 'target', true)).toBe(0.5);
  });
});

describe('computeLineItemCost', () => {
  it('returns hours × hourlyRate when no override', () => {
    expect(computeLineItemCost(2.5, 75, undefined)).toBe(187.5);
  });

  it('prefers hoursOverride × rate over tracked hours', () => {
    expect(computeLineItemCost(2.5, 75, undefined, 4)).toBe(300);
  });

  it('prefers hoursOverride × rate over a legacy costOverride', () => {
    expect(computeLineItemCost(2.5, 75, 500, 4)).toBe(300);
  });

  it('falls back to legacy costOverride when hoursOverride absent', () => {
    expect(computeLineItemCost(2.5, 75, 200, undefined)).toBe(200);
  });

  it('returns 0 when hours are 0 and no override', () => {
    expect(computeLineItemCost(0, 75, undefined)).toBe(0);
  });
});

describe('computeLineItemEffectiveHours', () => {
  it('returns tracked hours when override is undefined', () => {
    expect(computeLineItemEffectiveHours(3, undefined)).toBe(3);
  });

  it('returns override when set, ignoring tracked hours', () => {
    expect(computeLineItemEffectiveHours(3, 5)).toBe(5);
  });

  it('treats NaN override as absent', () => {
    expect(computeLineItemEffectiveHours(3, Number.NaN)).toBe(3);
  });
});
