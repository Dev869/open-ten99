import type { TimeEntry } from './types';

/**
 * Round total seconds to the nearest quarter hour.
 * 1-7 min past boundary → round down. 8-14 min → round up. 0 min → no change.
 */
export function roundToQuarterHour(totalSeconds: number): number {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const quarterMinutes = 15;
  const remainder = totalMinutes % quarterMinutes;
  const base = totalMinutes - remainder;

  if (remainder === 0) return base / 60;
  if (remainder <= 7) return base / 60;
  return (base + quarterMinutes) / 60;
}

/**
 * Compute total hours for a line item from its linked time entries.
 * Filters by lineItemId, sums durationSeconds, optionally rounds to quarter hour.
 */
export function computeLineItemHours(
  timeEntries: TimeEntry[],
  lineItemId: string,
  roundToQuarter: boolean
): number {
  const totalSeconds = timeEntries
    .filter((te) => te.lineItemId === lineItemId)
    .reduce((sum, te) => sum + te.durationSeconds, 0);

  if (totalSeconds === 0) return 0;
  if (roundToQuarter) return roundToQuarterHour(totalSeconds);
  return totalSeconds / 3600;
}

/**
 * Cost for a line item: hours * hourly rate, no exceptions. Line-item
 * hours come exclusively from TimeEntry records (timer or manually
 * created entries) via computeLineItemHours, so the work-order total
 * always equals the sum of its line items' tracked time.
 */
export function computeLineItemCost(
  hours: number,
  hourlyRate: number
): number {
  return hours * hourlyRate;
}
