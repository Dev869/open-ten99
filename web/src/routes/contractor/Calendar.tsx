import { useState, useMemo } from 'react';
import type { WorkItem, Client, RecurrenceFrequency } from '../../lib/types';
import { typeColor } from '../../lib/theme';
import { WORK_ITEM_TYPE_LABELS, RECURRENCE_LABELS } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { StatusBadge } from '../../components/StatusBadge';
import { useNavigate } from 'react-router-dom';

interface CalendarProps {
  workItems: WorkItem[];
  clients: Client[];
}

type View = 'month' | 'week' | 'list';

/** A calendar entry: either the original work item or a virtual recurring instance. */
interface CalendarItem {
  item: WorkItem;
  /** The date this entry should appear on. For originals, equals itemDate(item). */
  displayDate: Date;
  /** True when this is a generated recurring instance, not the original. */
  isRecurring: boolean;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function itemDate(item: WorkItem): Date {
  return item.scheduledDate ?? item.createdAt;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Advance a date by the given recurrence frequency.
 * Returns a new Date; does not mutate the input.
 */
function advanceByFrequency(date: Date, frequency: RecurrenceFrequency, customDays?: number): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'custom':
      d.setDate(d.getDate() + (customDays ?? 1));
      break;
  }
  return d;
}

/**
 * Generate virtual recurring CalendarItem entries for items that have a recurrence,
 * limited to the window [rangeStart, rangeEnd].
 */
function generateRecurrences(
  items: WorkItem[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarItem[] {
  const results: CalendarItem[] = [];

  for (const item of items) {
    if (!item.recurrence) continue;

    const baseDate = itemDate(item);
    const { frequency, customDays, endDate } = item.recurrence;

    // Walk forward from the base date, generating occurrences
    let next = advanceByFrequency(baseDate, frequency, customDays);
    while (next <= rangeEnd) {
      // Stop if past the recurrence end date
      if (endDate && next > endDate) break;

      // Only include if within the visible range
      if (next >= rangeStart) {
        results.push({
          item,
          displayDate: new Date(next),
          isRecurring: true,
        });
      }
      next = advanceByFrequency(next, frequency, customDays);
    }
  }

  return results;
}

export default function Calendar({ workItems, clients }: CalendarProps) {
  const [view, setView] = useState<View>('month');
  const [current, setCurrent] = useState(new Date());
  const navigate = useNavigate();

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

  const active = workItems.filter((i) => i.status !== 'archived');

  /** The visible date range for the current view. */
  const visibleRange = useMemo<{ start: Date; end: Date }>(() => {
    if (view === 'week') {
      const start = startOfWeek(current);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    // month and list views both show the full month
    const year = current.getFullYear();
    const month = current.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [current, view]);

  /** All calendar entries: originals + virtual recurring instances. */
  const calendarItems = useMemo<CalendarItem[]>(() => {
    // Original items
    const originals: CalendarItem[] = active.map((item) => ({
      item,
      displayDate: itemDate(item),
      isRecurring: false,
    }));

    // Virtual recurring occurrences within the visible range
    const recurrences = generateRecurrences(active, visibleRange.start, visibleRange.end);

    return [...originals, ...recurrences];
  }, [active, visibleRange]);

  function prev() {
    const d = new Date(current);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrent(d);
  }

  function next() {
    const d = new Date(current);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrent(d);
  }

  const monthLabel = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Month grid
  const monthGrid = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth();
    const totalDays = daysInMonth(year, month);
    const firstDow = new Date(year, month, 1).getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [current]);

  // Week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(current);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [current]);

  // List items for current month
  const listItems = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth();
    return calendarItems
      .filter((ci) => {
        const d = ci.displayDate;
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime());
  }, [current, calendarItems]);

  function itemsForDay(day: Date): CalendarItem[] {
    return calendarItems.filter((ci) => sameDay(ci.displayDate, day));
  }

  const today = new Date();

  /** Build a unique key for a CalendarItem (avoids duplicate React keys for recurring instances). */
  function calendarItemKey(ci: CalendarItem): string {
    const id = ci.item.id ?? 'no-id';
    return ci.isRecurring ? `${id}-rec-${ci.displayDate.toISOString()}` : id;
  }

  // --- Month View day cell ---
  function renderDayCell(day: Date | null, index: number) {
    if (!day) {
      return (
        <div
          key={`empty-${index}`}
          className="min-h-[110px] bg-[#FAFAF7] border-b border-r border-[#F2F2F7]"
        />
      );
    }
    const items = itemsForDay(day);
    const isToday = sameDay(day, today);
    const maxVisible = 3;

    return (
      <div
        key={day.toISOString()}
        className="min-h-[110px] border-b border-r border-[#F2F2F7] p-2 group hover:bg-white/80 transition-colors cursor-default"
      >
        {/* Day number */}
        <div className="flex items-center justify-start mb-1.5">
          <span
            className={`
              inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full transition-colors
              ${isToday
                ? 'bg-[#4BA8A8] text-white shadow-sm'
                : 'text-[#86868B] group-hover:text-[#1A1A2E]'
              }
            `}
          >
            {day.getDate()}
          </span>
        </div>
        {/* Work items */}
        <div className="space-y-1">
          {items.slice(0, maxVisible).map((ci) => (
            <button
              key={calendarItemKey(ci)}
              onClick={() => navigate(`/dashboard/work-items/${ci.item.id}`)}
              className={`block w-full text-left text-[10px] leading-snug px-2 py-1 rounded-md truncate text-white font-medium shadow-sm hover:shadow-md hover:brightness-110 transition-all ${
                ci.isRecurring ? 'opacity-70 border border-dashed border-white/60' : ''
              }`}
              style={{ backgroundColor: typeColor(ci.item.type) }}
              title={`${ci.item.subject} - ${ci.item.totalHours.toFixed(1)} hrs${ci.isRecurring && ci.item.recurrence ? ` (${ci.item.recurrence.frequency === 'custom' ? `Every ${ci.item.recurrence.customDays} days` : RECURRENCE_LABELS[ci.item.recurrence.frequency]})` : ''}`}
            >
              {ci.item.subject}
              <span className="ml-1 opacity-70">{ci.item.totalHours.toFixed(1)}h</span>
            </button>
          ))}
          {items.length > maxVisible && (
            <span className="inline-block text-[10px] font-semibold text-[#4BA8A8] bg-[#4BA8A8]/10 px-2 py-0.5 rounded-full">
              +{items.length - maxVisible} more
            </span>
          )}
        </div>
      </div>
    );
  }

  // --- View toggle segmented control ---
  const viewOptions: View[] = ['month', 'week', 'list'];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider">
          Calendar
        </h1>
        {/* Segmented Control */}
        <div className="inline-flex bg-[#F2F2F7] rounded-lg p-0.5 shadow-inner">
          {viewOptions.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                view === v
                  ? 'bg-white text-[#4BA8A8] shadow-sm'
                  : 'text-[#86868B] hover:text-[#1A1A2E]'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={prev}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E5EA] text-[#86868B] hover:bg-white hover:text-[#1A1A2E] hover:shadow-sm transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm font-bold text-[#1A1A2E] min-w-[160px] text-center">
          {monthLabel}
        </span>
        <button
          onClick={next}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E5EA] text-[#86868B] hover:bg-white hover:text-[#1A1A2E] hover:shadow-sm transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={() => setCurrent(new Date())}
          className="ml-2 px-3 py-1.5 text-xs font-semibold text-[#4BA8A8] bg-[#4BA8A8]/10 hover:bg-[#4BA8A8]/20 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

      {/* ===== Month View ===== */}
      {view === 'month' && (
        <div className="bg-white rounded-xl border border-[#E5E5EA] overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 bg-[#FAFAF7]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-bold text-[#86868B] uppercase tracking-wider py-3 border-b border-r border-[#F2F2F7]"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {monthGrid.map((day, idx) => renderDayCell(day, idx))}
          </div>
        </div>
      )}

      {/* ===== Week View ===== */}
      {view === 'week' && (
        <div className="bg-white rounded-xl border border-[#E5E5EA] overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-[#FAFAF7] border-b border-[#F2F2F7]">
            {weekDays.map((day) => {
              const isToday = sameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={`text-center py-3 border-r last:border-r-0 border-[#F2F2F7] transition-colors ${
                    isToday ? 'bg-[#4BA8A8]/10' : ''
                  }`}
                >
                  <div className="text-[10px] text-[#86868B] uppercase tracking-wide font-semibold">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="mt-0.5">
                    <span
                      className={`
                        inline-flex items-center justify-center w-8 h-8 text-base font-bold rounded-full
                        ${isToday ? 'bg-[#4BA8A8] text-white shadow-sm' : 'text-[#1A1A2E]'}
                      `}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Day columns - full height, no truncation */}
          <div className="grid grid-cols-7 items-start">
            {weekDays.map((day) => {
              const isToday = sameDay(day, today);
              const items = itemsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`border-r last:border-r-0 border-[#F2F2F7] min-h-[160px] p-2 space-y-2 ${
                    isToday ? 'bg-[#4BA8A8]/5' : ''
                  }`}
                >
                  {items.map((ci) => (
                    <button
                      key={calendarItemKey(ci)}
                      onClick={() => navigate(`/dashboard/work-items/${ci.item.id}`)}
                      className={`block w-full text-left p-2.5 rounded-lg text-white shadow-sm hover:shadow-md hover:brightness-110 transition-all ${
                        ci.isRecurring ? 'opacity-70 border border-dashed border-white/60' : ''
                      }`}
                      style={{ backgroundColor: typeColor(ci.item.type) }}
                    >
                      {/* Subject */}
                      <div className="text-xs font-bold leading-snug mb-1">{ci.item.subject}</div>
                      {/* Client */}
                      <div className="text-[10px] text-white/80 font-medium">
                        {clientMap[ci.item.clientId] ?? 'Unknown'}
                      </div>
                      {/* Hours + type badge row */}
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-semibold">
                          {ci.item.totalHours.toFixed(1)} hrs
                        </span>
                        <span className="text-[9px] bg-white/15 px-1.5 py-0.5 rounded">
                          {WORK_ITEM_TYPE_LABELS[ci.item.type]}
                        </span>
                      </div>
                      {/* Billing type */}
                      <div className="text-[9px] text-white/60 mt-1 font-medium">
                        {ci.item.deductFromRetainer ? 'Retainer' : 'Hourly'}
                      </div>
                      {/* Recurrence */}
                      {ci.item.recurrence && (
                        <div className="text-[9px] text-white/60 mt-0.5 flex items-center gap-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                          </svg>
                          {ci.item.recurrence.frequency === 'custom' ? `Every ${ci.item.recurrence.customDays} days` : RECURRENCE_LABELS[ci.item.recurrence.frequency]}
                        </div>
                      )}
                    </button>
                  ))}
                  {items.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[#E5E5EA]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 opacity-40" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== List View ===== */}
      {view === 'list' && (
        <div className="space-y-3">
          {listItems.length === 0 && (
            <div className="text-center py-20">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-[#E5E5EA] mb-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <p className="text-[#86868B] font-medium">No items this month</p>
            </div>
          )}
          {listItems.map((ci) => {
            const d = ci.displayDate;
            const isToday = sameDay(d, today);
            return (
              <button
                key={calendarItemKey(ci)}
                onClick={() => navigate(`/dashboard/work-items/${ci.item.id}`)}
                className={`w-full flex items-start gap-5 bg-white rounded-xl border border-[#F2F2F7] p-5 text-left hover:shadow-md hover:border-[#E5E5EA] transition-all group ${
                  ci.isRecurring ? 'border-dashed opacity-80' : ''
                }`}
              >
                {/* Date block */}
                <div
                  className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
                    isToday
                      ? 'bg-[#4BA8A8] text-white shadow-sm'
                      : 'bg-[#F5F5F7] text-[#1A1A2E]'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-white/80' : 'text-[#86868B]'}`}>
                    {d.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
                </div>
                {/* Color stripe */}
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: typeColor(ci.item.type) }}
                />
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#1A1A2E] group-hover:text-[#4BA8A8] transition-colors truncate">
                        {ci.item.subject}
                      </div>
                      <div className="text-xs text-[#86868B] mt-0.5">
                        {clientMap[ci.item.clientId] ?? 'Unknown'}
                      </div>
                    </div>
                    <StatusBadge status={ci.item.status} />
                  </div>
                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: typeColor(ci.item.type) }}
                    >
                      {WORK_ITEM_TYPE_LABELS[ci.item.type]}
                    </span>
                    <span className="text-xs text-[#86868B] font-semibold">
                      {ci.item.totalHours.toFixed(1)} hrs
                    </span>
                    <span className="text-xs text-[#86868B]">
                      {formatCurrency(ci.item.totalCost)}
                    </span>
                    <span className="text-[10px] text-[#86868B] bg-[#F5F5F7] px-2 py-0.5 rounded-full font-medium">
                      {ci.item.deductFromRetainer ? 'Retainer' : 'Hourly'}
                    </span>
                    {ci.item.recurrence && (
                      <span className="text-[10px] text-[#4BA8A8] bg-[#4BA8A8]/10 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        {ci.item.recurrence.frequency === 'custom' ? `Every ${ci.item.recurrence.customDays} days` : RECURRENCE_LABELS[ci.item.recurrence.frequency]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
