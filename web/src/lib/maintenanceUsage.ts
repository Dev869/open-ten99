import type { Client, WorkItem } from './types';
import { getRetainerPeriodStart, getRetainerPeriodEnd } from './utils';

export interface MaintenanceUsage {
  allotted: number;
  used: number;
  remaining: number;
  overageHours: number;
  overageRate: number;
  overageCost: number;
  periodStart: Date;
  periodEnd: Date;
  paused: boolean;
}

/**
 * Computes maintenance hours used against a client's monthly allotment.
 *
 * Counted: work items whose `type === 'maintenance'`, are not in `draft` or
 * `archived` status, and were last updated within the current renewal period.
 *
 * If the client has no allotment configured, returns null.
 */
export function calculateMaintenanceUsage(
  client: Pick<
    Client,
    | 'maintenanceHoursAllotted'
    | 'maintenanceRenewalDay'
    | 'maintenancePaused'
    | 'maintenanceOverageRate'
  >,
  workItems: WorkItem[],
  fallbackHourlyRate: number,
  now: Date = new Date(),
): MaintenanceUsage | null {
  const allotted = client.maintenanceHoursAllotted;
  const renewalDay = client.maintenanceRenewalDay;
  if (!allotted || !renewalDay) return null;

  const periodStart = getRetainerPeriodStart(renewalDay, now);
  const periodEnd = getRetainerPeriodEnd(renewalDay, now);
  // periodEnd from utils is the last day of the period; we filter < day after.
  const periodEndExclusive = new Date(periodEnd);
  periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);

  const used = workItems
    .filter((i) => {
      if (i.type !== 'maintenance') return false;
      if (i.status === 'draft' || i.status === 'archived') return false;
      // When the work was done — scheduledDate if set, else createdAt.
      // updatedAt (last-modified) is wrong: editing an item after the period
      // ends would drop it, and an old item touched this period would be
      // miscounted against the current allotment.
      const when = i.scheduledDate ?? i.createdAt;
      return when >= periodStart && when < periodEndExclusive;
    })
    .reduce((sum, i) => sum + (i.totalHours || 0), 0);

  const overageHours = Math.max(0, used - allotted);
  const overageRate = client.maintenanceOverageRate ?? fallbackHourlyRate;
  const overageCost = overageHours * overageRate;

  return {
    allotted,
    used,
    remaining: allotted - used,
    overageHours,
    overageRate,
    overageCost,
    periodStart,
    periodEnd,
    paused: client.maintenancePaused ?? false,
  };
}
