import { describe, it, expect } from 'vitest';
import { calculateMaintenanceUsage } from '../maintenanceUsage';
import type { WorkItem } from '../types';

const now = new Date(2026, 2, 20); // March 20, 2026

function makeItem(overrides: Partial<WorkItem>): WorkItem {
  return {
    type: 'maintenance',
    status: 'completed',
    clientId: 'c1',
    sourceEmail: '',
    subject: 'Routine maintenance',
    lineItems: [],
    totalHours: 0,
    totalCost: 0,
    isBillable: true,
    createdAt: new Date(2026, 2, 18),
    updatedAt: new Date(2026, 2, 18),
    ...overrides,
  };
}

describe('calculateMaintenanceUsage', () => {
  it('returns null when allotment is not configured', () => {
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: undefined, maintenanceRenewalDay: 1 },
      [],
      100,
      now,
    );
    expect(result).toBeNull();
  });

  it('returns null when renewal day is not configured', () => {
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: 10, maintenanceRenewalDay: undefined },
      [],
      100,
      now,
    );
    expect(result).toBeNull();
  });

  it('sums maintenance hours within the current period', () => {
    const items: WorkItem[] = [
      makeItem({ totalHours: 3, updatedAt: new Date(2026, 2, 16) }),
      makeItem({ totalHours: 2, updatedAt: new Date(2026, 2, 18) }),
    ];
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: 10, maintenanceRenewalDay: 15 },
      items,
      100,
      now,
    );
    expect(result).not.toBeNull();
    expect(result!.used).toBe(5);
    expect(result!.remaining).toBe(5);
    expect(result!.overageHours).toBe(0);
    expect(result!.overageCost).toBe(0);
  });

  it('excludes draft and archived work items', () => {
    const items: WorkItem[] = [
      makeItem({ totalHours: 3, status: 'draft' }),
      makeItem({ totalHours: 4, status: 'archived' }),
      makeItem({ totalHours: 2, status: 'inReview' }),
    ];
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: 10, maintenanceRenewalDay: 15 },
      items,
      100,
      now,
    );
    expect(result!.used).toBe(2);
  });

  it('excludes non-maintenance work items', () => {
    const items: WorkItem[] = [
      makeItem({ totalHours: 3, type: 'changeRequest' }),
      makeItem({ totalHours: 5, type: 'featureRequest' }),
      makeItem({ totalHours: 2, type: 'maintenance' }),
    ];
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: 10, maintenanceRenewalDay: 15 },
      items,
      100,
      now,
    );
    expect(result!.used).toBe(2);
  });

  it('excludes items outside the current period', () => {
    const items: WorkItem[] = [
      makeItem({ totalHours: 5, updatedAt: new Date(2026, 2, 10) }), // before Mar 15
      makeItem({ totalHours: 3, updatedAt: new Date(2026, 2, 18) }),
    ];
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: 10, maintenanceRenewalDay: 15 },
      items,
      100,
      now,
    );
    expect(result!.used).toBe(3);
  });

  it('computes overage at the configured maintenance rate', () => {
    const items: WorkItem[] = [
      makeItem({ totalHours: 8, updatedAt: new Date(2026, 2, 18) }),
      makeItem({ totalHours: 5, updatedAt: new Date(2026, 2, 19) }),
    ];
    const result = calculateMaintenanceUsage(
      {
        maintenanceHoursAllotted: 10,
        maintenanceRenewalDay: 15,
        maintenanceOverageRate: 150,
      },
      items,
      100,
      now,
    );
    expect(result!.used).toBe(13);
    expect(result!.overageHours).toBe(3);
    expect(result!.overageRate).toBe(150);
    expect(result!.overageCost).toBe(450);
    expect(result!.remaining).toBe(-3);
  });

  it('falls back to the global hourly rate when no override is set', () => {
    const items: WorkItem[] = [
      makeItem({ totalHours: 12, updatedAt: new Date(2026, 2, 18) }),
    ];
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: 10, maintenanceRenewalDay: 15 },
      items,
      125,
      now,
    );
    expect(result!.overageHours).toBe(2);
    expect(result!.overageRate).toBe(125);
    expect(result!.overageCost).toBe(250);
  });

  it('reflects the paused flag', () => {
    const result = calculateMaintenanceUsage(
      { maintenanceHoursAllotted: 10, maintenanceRenewalDay: 15, maintenancePaused: true },
      [],
      100,
      now,
    );
    expect(result!.paused).toBe(true);
  });
});
