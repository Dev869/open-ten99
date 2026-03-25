import type { LineItem } from './types';

interface RetainerLineItemInput {
  mode: 'flat' | 'usage';
  retainerHours: number;
  retainerFlatRate?: number;
  hourlyRate: number;
  periodLabel: string;
  workItems: { description: string; hours: number; cost: number }[];
  usedHours: number;
}

interface RetainerLineItemResult {
  lineItems: LineItem[];
  overageHours: number;
  totalHours: number;
  totalCost: number;
}

export function buildRetainerLineItems(input: RetainerLineItemInput): RetainerLineItemResult {
  const { mode, retainerHours, retainerFlatRate, hourlyRate, periodLabel, workItems, usedHours } = input;
  const overageHours = Math.max(0, usedHours - retainerHours);
  const lineItems: LineItem[] = [];

  if (mode === 'flat') {
    lineItems.push({
      id: crypto.randomUUID(),
      description: `Monthly Retainer — ${periodLabel}`,
      hours: retainerHours,
      cost: retainerFlatRate ?? 0,
    });
  } else {
    for (const wi of workItems) {
      lineItems.push({
        id: crypto.randomUUID(),
        description: wi.description,
        hours: wi.hours,
        cost: wi.cost,
      });
    }
  }

  if (overageHours > 0) {
    const overageCost = overageHours * hourlyRate;
    lineItems.push({
      id: crypto.randomUUID(),
      description: `Overage — ${overageHours.toFixed(1)} hrs beyond retainer @ ${hourlyRate}/hr`,
      hours: overageHours,
      cost: overageCost,
    });
  }

  const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);
  const totalCost = lineItems.reduce((sum, li) => sum + li.cost, 0);

  return { lineItems, overageHours, totalHours, totalCost };
}
