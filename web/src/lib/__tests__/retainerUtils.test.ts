import { describe, it, expect } from 'vitest';
import { getRetainerPeriodEnd } from '../utils';
import { buildRetainerLineItems } from '../retainerInvoice';

// ---------------------------------------------------------------------------
// getRetainerPeriodEnd
// ---------------------------------------------------------------------------

describe('getRetainerPeriodEnd', () => {
  it('returns one day before next renewal when today >= renewalDay', () => {
    // renewalDay = 15, today = Mar 20 → period started Mar 15, ends Apr 14
    const now = new Date(2026, 2, 20); // March 20, 2026
    const end = getRetainerPeriodEnd(15, now);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3); // April (0-indexed)
    expect(end.getDate()).toBe(14);
  });

  it('returns one day before next renewal when today < renewalDay', () => {
    // renewalDay = 15, today = Mar 10 → period started Feb 15, ends Mar 14
    const now = new Date(2026, 2, 10); // March 10, 2026
    const end = getRetainerPeriodEnd(15, now);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(2); // March (0-indexed)
    expect(end.getDate()).toBe(14);
  });

  it('handles month-end overflow: renewalDay=31 in February', () => {
    // renewalDay = 31, today = Feb 28 → period started Jan 31
    // Jan 31 + 1 month = Feb 31 (JS overflows to Mar 3), then - 1 day = Mar 2
    const now = new Date(2026, 1, 28); // Feb 28, 2026
    const end = getRetainerPeriodEnd(31, now);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(2); // March (0-indexed)
    expect(end.getDate()).toBe(2);
  });

  it('period on exact renewal day: today == renewalDay', () => {
    // renewalDay = 1, today = Mar 1 → period started Mar 1, ends Mar 31
    const now = new Date(2026, 2, 1); // March 1, 2026
    const end = getRetainerPeriodEnd(1, now);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(2); // March (0-indexed)
    expect(end.getDate()).toBe(31);
  });
});

// ---------------------------------------------------------------------------
// buildRetainerLineItems
// ---------------------------------------------------------------------------

describe('buildRetainerLineItems', () => {
  it('flat-fee: single retainer line item, no overage', () => {
    const result = buildRetainerLineItems({
      mode: 'flat',
      retainerHours: 20,
      retainerFlatRate: 2000,
      hourlyRate: 100,
      periodLabel: 'March 2026',
      workItems: [],
      usedHours: 15,
    });

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toContain('Monthly Retainer');
    expect(result.lineItems[0].description).toContain('March 2026');
    expect(result.lineItems[0].hours).toBe(20);
    expect(result.lineItems[0].cost).toBe(2000);
    expect(result.overageHours).toBe(0);
    expect(result.totalHours).toBe(20);
    expect(result.totalCost).toBe(2000);
  });

  it('flat-fee with overage: appends overage line item', () => {
    const result = buildRetainerLineItems({
      mode: 'flat',
      retainerHours: 20,
      retainerFlatRate: 2000,
      hourlyRate: 150,
      periodLabel: 'March 2026',
      workItems: [],
      usedHours: 25,
    });

    expect(result.lineItems).toHaveLength(2);
    expect(result.overageHours).toBe(5);
    const overage = result.lineItems[1];
    expect(overage.description).toContain('Overage');
    expect(overage.hours).toBe(5);
    expect(overage.cost).toBe(750); // 5 * 150
    expect(result.totalHours).toBe(25); // 20 retainer + 5 overage
    expect(result.totalCost).toBe(2750); // 2000 + 750
  });

  it('usage-based: one line item per work item, no overage', () => {
    const result = buildRetainerLineItems({
      mode: 'usage',
      retainerHours: 40,
      hourlyRate: 100,
      periodLabel: 'March 2026',
      workItems: [
        { description: 'Feature A', hours: 10, cost: 1000 },
        { description: 'Bug Fix B', hours: 5, cost: 500 },
      ],
      usedHours: 15,
    });

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0].description).toBe('Feature A');
    expect(result.lineItems[1].description).toBe('Bug Fix B');
    expect(result.overageHours).toBe(0);
    expect(result.totalHours).toBe(15);
    expect(result.totalCost).toBe(1500);
  });

  it('usage-based with overage: appends overage line item', () => {
    const result = buildRetainerLineItems({
      mode: 'usage',
      retainerHours: 10,
      hourlyRate: 120,
      periodLabel: 'March 2026',
      workItems: [
        { description: 'Feature A', hours: 8, cost: 960 },
        { description: 'Feature B', hours: 6, cost: 720 },
      ],
      usedHours: 14,
    });

    expect(result.lineItems).toHaveLength(3);
    expect(result.overageHours).toBe(4);
    const overage = result.lineItems[2];
    expect(overage.description).toContain('4.0 hrs');
    expect(overage.cost).toBe(480); // 4 * 120
  });

  it('usage-based with no work items returns only overage when over', () => {
    const result = buildRetainerLineItems({
      mode: 'usage',
      retainerHours: 5,
      hourlyRate: 100,
      periodLabel: 'March 2026',
      workItems: [],
      usedHours: 8,
    });

    expect(result.lineItems).toHaveLength(1);
    expect(result.overageHours).toBe(3);
    expect(result.lineItems[0].description).toContain('Overage');
  });

  it('usage-based with no work items and no overage returns empty line items', () => {
    const result = buildRetainerLineItems({
      mode: 'usage',
      retainerHours: 20,
      hourlyRate: 100,
      periodLabel: 'March 2026',
      workItems: [],
      usedHours: 0,
    });

    expect(result.lineItems).toHaveLength(0);
    expect(result.overageHours).toBe(0);
    expect(result.totalHours).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});
