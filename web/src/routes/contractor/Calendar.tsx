import { useState, useMemo, useEffect, useCallback } from 'react';
import type { WorkItem, Client, RecurrenceFrequency, App } from '../../lib/types';
import { typeColor } from '../../lib/theme';
import { WORK_ITEM_TYPE_LABELS, RECURRENCE_LABELS } from '../../lib/types';
import { formatCurrency, cn } from '../../lib/utils';
import { StatusBadge } from '../../components/workitems/StatusBadge';
import { useNavigate } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight, IconCalendar as IconCalendarIcon, IconRepeat } from '../../components/icons';

interface CalendarProps {
  workItems: WorkItem[];
  clients: Client[];
  apps: App[];
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

/* ── Date helpers ─────────────────────────────────── */

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
    let next = advanceByFrequency(baseDate, frequency, customDays);
    while (next <= rangeEnd) {
      if (endDate && next > endDate) break;
      if (next >= rangeStart) {
        results.push({ item, displayDate: new Date(next), isRecurring: true });
      }
      next = advanceByFrequency(next, frequency, customDays);
    }
  }
  return results;
}

/* ── Work item type colors (semantic) ─────────────── */
const TYPE_COLORS: Record<string, string> = {
  changeRequest: 'var(--accent)',
  featureRequest: 'var(--color-green)',
  maintenance: 'var(--color-orange)',
};

/* ── Component ────────────────────────────────────── */

/* ── Mobile Month Agenda ─────────────────────────── */

interface MobileMonthAgendaProps {
  monthGrid: (Date | null)[];
  currentMonth: number;
  today: Date;
  itemsForDay: (day: Date) => CalendarItem[];
  calendarItemKey: (ci: CalendarItem) => string;
  clientMap: Record<string, string>;
  appMap: Record<string, string>;
  navigate: (path: string) => void;
}

/**
 * A compact month view for mobile: mini calendar header with dot indicators,
 * followed by a scrollable agenda list of the current month's items.
 */
function MobileMonthAgenda({
  monthGrid,
  currentMonth,
  today,
  itemsForDay,
  calendarItemKey,
  clientMap,
  appMap,
  navigate,
}: MobileMonthAgendaProps) {
  const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Collect days in the current month that have items
  const daysWithItems = useMemo(() => {
    const result: { day: Date; items: CalendarItem[] }[] = [];
    for (const day of monthGrid) {
      if (!day || day.getMonth() !== currentMonth) continue;
      const items = itemsForDay(day);
      if (items.length > 0) {
        result.push({ day, items });
      }
    }
    return result;
  }, [monthGrid, currentMonth, itemsForDay]);

  return (
    <div className="flex flex-col h-full">
      {/* Mini calendar grid with dot indicators */}
      <div className="flex-shrink-0 border-b border-[var(--border)] px-2 pt-2 pb-1">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {dayLetters.map((letter, i) => (
            <div
              key={`mhdr-${i}`}
              className="text-center text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider"
            >
              {letter}
            </div>
          ))}
        </div>
        {/* Compact day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {monthGrid.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const isCurrentMonth = day.getMonth() === currentMonth;
            const isToday = sameDay(day, today);
            const hasItems = itemsForDay(day).length > 0;
            return (
              <div
                key={day.toISOString()}
                className="flex flex-col items-center py-0.5"
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 text-[11px] font-semibold rounded-full',
                    !isCurrentMonth && 'opacity-30',
                    isToday
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-primary)]'
                  )}
                >
                  {day.getDate()}
                </span>
                {/* Dot indicator for days with items */}
                <div className="h-1 mt-px">
                  {hasItems && isCurrentMonth && (
                    <span className="block w-1 h-1 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {daysWithItems.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-3">
              <IconCalendarIcon size={28} color="var(--accent)" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No items this month</p>
            <p className="text-xs text-[var(--text-secondary)]">Work items scheduled for this month will appear here</p>
          </div>
        )}
        {daysWithItems.map(({ day, items }) => {
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()}>
              {/* Date header */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border)]',
                  isToday
                    ? 'text-[var(--accent)] bg-[var(--accent)]/5'
                    : 'text-[var(--text-secondary)] bg-[var(--bg-input)]/40'
                )}
              >
                <span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span>{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                {isToday && <span className="text-[8px] bg-[var(--accent)]/15 px-1.5 py-px rounded-full">Today</span>}
              </div>
              {/* Items for this day */}
              {items.map((ci) => (
                <button
                  key={calendarItemKey(ci)}
                  onClick={() => navigate(`/dashboard/work-items/${ci.item.id}`)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-[var(--border)] hover:bg-[var(--bg-input)]/40 transition-colors min-h-[44px]',
                    ci.isRecurring && 'opacity-75'
                  )}
                >
                  {/* Color stripe */}
                  <div
                    className="w-0.5 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[ci.item.type] ?? typeColor(ci.item.type) }}
                  />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {ci.item.subject}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {clientMap[ci.item.clientId] ?? 'Unknown'}
                        {ci.item.appId && appMap[ci.item.appId] && (
                          <> · {appMap[ci.item.appId]}</>
                        )}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-semibold">
                        {ci.item.totalHours.toFixed(1)}h
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {formatCurrency(ci.item.totalCost)}
                      </span>
                      <span
                        className="text-[8px] font-bold px-1.5 py-px rounded-full text-white"
                        style={{ backgroundColor: TYPE_COLORS[ci.item.type] ?? typeColor(ci.item.type) }}
                      >
                        {WORK_ITEM_TYPE_LABELS[ci.item.type]}
                      </span>
                      {ci.item.recurrence && (
                        <span className="text-[8px] text-[var(--accent)] font-medium flex items-center gap-0.5">
                          <IconRepeat size={8} color="currentColor" />
                          {ci.item.recurrence.frequency === 'custom'
                            ? `${ci.item.recurrence.customDays}d`
                            : RECURRENCE_LABELS[ci.item.recurrence.frequency]}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Status badge */}
                  <StatusBadge status={ci.item.status} />
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Number of days to show in mobile week view. */
const MOBILE_WEEK_DAYS = 3;

export default function Calendar({ workItems, clients, apps }: CalendarProps) {
  const [view, setView] = useState<View>('month');
  const [current, setCurrent] = useState(new Date());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const navigate = useNavigate();

  // Track viewport for mobile detection
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

  const appMap = useMemo(() => {
    const map: Record<string, string> = {};
    apps.forEach((a) => { if (a.id) map[a.id] = a.name; });
    return map;
  }, [apps]);

  const active = workItems.filter((i) => i.status !== 'archived');

  const visibleRange = useMemo<{ start: Date; end: Date }>(() => {
    if (view === 'week') {
      if (isMobile) {
        // Mobile week: centered around current day
        const offset = Math.floor(MOBILE_WEEK_DAYS / 2);
        const start = new Date(current);
        start.setDate(start.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        const end = new Date(current);
        end.setDate(end.getDate() + (MOBILE_WEEK_DAYS - 1 - offset));
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      const start = startOfWeek(current);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const year = current.getFullYear();
    const month = current.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [current, view, isMobile]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const originals: CalendarItem[] = active.map((item) => ({
      item,
      displayDate: itemDate(item),
      isRecurring: false,
    }));
    const recurrences = generateRecurrences(active, visibleRange.start, visibleRange.end);
    return [...originals, ...recurrences];
  }, [active, visibleRange]);

  const prev = useCallback(() => {
    const d = new Date(current);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week' && isMobile) d.setDate(d.getDate() - MOBILE_WEEK_DAYS);
    else d.setDate(d.getDate() - 7);
    setCurrent(d);
  }, [current, view, isMobile]);

  const next = useCallback(() => {
    const d = new Date(current);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week' && isMobile) d.setDate(d.getDate() + MOBILE_WEEK_DAYS);
    else d.setDate(d.getDate() + 7);
    setCurrent(d);
  }, [current, view, isMobile]);

  const monthLabel = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthGrid = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth();
    const totalDays = daysInMonth(year, month);
    const firstDow = new Date(year, month, 1).getDay();
    const cells: (Date | null)[] = [];
    // Fill leading days from previous month
    if (firstDow > 0) {
      const prevMonthDays = daysInMonth(year, month - 1);
      for (let i = firstDow - 1; i >= 0; i--) {
        cells.push(new Date(year, month - 1, prevMonthDays - i));
      }
    }
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
    // Fill trailing days from next month
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push(new Date(year, month + 1, nextDay++));
    }
    return cells;
  }, [current]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(current);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [current]);

  /** On mobile, show MOBILE_WEEK_DAYS centered around `current`. */
  const mobileWeekDays = useMemo(() => {
    const offset = Math.floor(MOBILE_WEEK_DAYS / 2);
    return Array.from({ length: MOBILE_WEEK_DAYS }, (_, i) => {
      const d = new Date(current);
      d.setDate(d.getDate() - offset + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [current]);

  /** The days to actually render in week view (responsive). */
  const visibleWeekDays = isMobile ? mobileWeekDays : weekDays;

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
  const currentMonth = current.getMonth();

  function calendarItemKey(ci: CalendarItem): string {
    const id = ci.item.id ?? 'no-id';
    return ci.isRecurring ? `${id}-rec-${ci.displayDate.toISOString()}` : id;
  }

  const numRows = monthGrid.length / 7;

  const viewOptions: View[] = ['month', 'week', 'list'];

  /* ── Day header labels ──────────────────────────── */
  const dayLetters = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Make <main> a non-scrolling flex container so the calendar fills it
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    main.style.overflow = 'hidden';
    main.style.display = 'flex';
    main.style.flexDirection = 'column';
    main.style.paddingBottom = '0.5rem';
    return () => {
      main.style.overflow = '';
      main.style.display = '';
      main.style.flexDirection = '';
      main.style.paddingBottom = '';
    };
  }, []);

  // Global empty state when no work items exist at all
  if (workItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4">
        <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4">
          <IconCalendarIcon size={32} color="var(--accent)" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1 text-center">Your calendar is empty</h2>
        <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs">
          Work items with due dates will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 pb-14 md:pb-0">

      {/* ══ Header Bar ══════════════════════════════════ */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 pb-3">
          {/* Left: nav + month label */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={prev}
              className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-all"
              aria-label="Previous"
            >
              <IconChevronLeft size={14} />
            </button>
            <button
              onClick={next}
              className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-all"
              aria-label="Next"
            >
              <IconChevronRight size={14} />
            </button>
            <button
              onClick={() => setCurrent(new Date())}
              className="px-2.5 py-1 min-h-[44px] md:min-h-0 text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-lg transition-colors"
            >
              Today
            </button>
            <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] ml-2 tracking-tight">
              {monthLabel}
            </h1>
          </div>

          {/* Right: segmented view toggle */}
          <div className="inline-flex bg-[var(--bg-input)] rounded-lg p-0.5">
            {viewOptions.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 min-h-[44px] md:min-h-0 rounded-md text-[11px] font-semibold transition-all',
                  view === v
                    ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ══ Calendar Body ═══════════════════════════════ */}
        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">

          {/* ── Month View ──────────────────────────────── */}
          {view === 'month' && !isMobile && (
            <div className="flex flex-col h-full">
              {/* Day-of-week headers */}
              <div className="flex-shrink-0 grid grid-cols-7 border-b border-[var(--border)]">
                {dayLetters.map((letter, i) => {
                  const isWeekend = i === 0 || i === 6;
                  return (
                    <div
                      key={`hdr-${i}`}
                      className={cn(
                        'text-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest py-2',
                        i < 6 && 'border-r border-[var(--border)]',
                        isWeekend && 'bg-[var(--bg-input)]/40'
                      )}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>

              {/* Day grid — fills remaining space */}
              <div
                className="flex-1 min-h-0 grid grid-cols-7"
                style={{ gridTemplateRows: `repeat(${numRows}, 1fr)` }}
              >
                {monthGrid.map((day, idx) => {
                  if (!day) return null;
                  const items = itemsForDay(day);
                  const isToday = sameDay(day, today);
                  const isCurrentMonth = day.getMonth() === currentMonth;
                  const dow = idx % 7;
                  const isWeekend = dow === 0 || dow === 6;
                  const maxVisible = 2;

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'flex flex-col p-1.5 overflow-hidden border-b border-r border-[var(--border)] transition-colors cursor-default group',
                        isWeekend && 'bg-[var(--bg-input)]/30',
                        !isCurrentMonth && 'opacity-30',
                        isToday && 'bg-[var(--accent)]/8',
                        'hover:bg-[var(--bg-input)]/50'
                      )}
                    >
                      {/* Day number */}
                      <div className="flex-shrink-0 mb-1">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-6 h-6 text-[11px] font-bold rounded-full',
                            isToday
                              ? 'bg-[var(--accent)] text-white shadow-sm'
                              : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                          )}
                        >
                          {day.getDate()}
                        </span>
                      </div>

                      {/* Work items — colored pills */}
                      <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-hidden">
                        {items.slice(0, maxVisible).map((ci) => {
                          const color = TYPE_COLORS[ci.item.type] ?? typeColor(ci.item.type);
                          return (
                            <button
                              key={calendarItemKey(ci)}
                              onClick={() => navigate(`/dashboard/work-items/${ci.item.id}`)}
                              className={cn(
                                'w-full text-left rounded-md px-1.5 py-0.5 transition-all hover:brightness-95 min-w-0',
                                ci.isRecurring && 'opacity-70'
                              )}
                              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
                              title={`${ci.item.subject} — ${clientMap[ci.item.clientId] ?? 'Unknown'} — ${ci.item.totalHours.toFixed(1)}h`}
                            >
                              <span
                                className="text-[9px] leading-tight font-semibold truncate block"
                                style={{ color }}
                              >
                                {ci.item.subject}
                              </span>
                            </button>
                          );
                        })}
                        {items.length > maxVisible && (
                          <span className="text-[9px] font-bold text-[var(--accent)] px-1.5 cursor-default">
                            +{items.length - maxVisible} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Month View (Mobile Agenda) ───────────────── */}
          {view === 'month' && isMobile && (
            <MobileMonthAgenda
              monthGrid={monthGrid}
              currentMonth={currentMonth}
              today={today}
              itemsForDay={itemsForDay}
              calendarItemKey={calendarItemKey}
              clientMap={clientMap}
              appMap={appMap}
              navigate={navigate}
            />
          )}

          {/* ── Week View ───────────────────────────────── */}
          {view === 'week' && (
            <div className="flex flex-col h-full">
              {/* Day headers */}
              <div
                className="flex-shrink-0 grid border-b border-[var(--border)]"
                style={{ gridTemplateColumns: `repeat(${visibleWeekDays.length}, 1fr)` }}
              >
                {visibleWeekDays.map((day, i) => {
                  const isToday = sameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'text-center py-2 transition-colors',
                        i < visibleWeekDays.length - 1 && 'border-r border-[var(--border)]',
                        isToday && 'bg-[var(--accent)]/10'
                      )}
                    >
                      <div className="text-[9px] md:text-[10px] text-[var(--text-secondary)] uppercase tracking-wide font-semibold">
                        {isMobile
                          ? day.toLocaleDateString('en-US', { weekday: 'short' })
                          : dayLetters[day.getDay()]
                        }
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-7 h-7 md:w-6 md:h-6 text-xs font-bold rounded-full mt-0.5',
                          isToday
                            ? 'bg-[var(--accent)] text-white'
                            : 'text-[var(--text-primary)]'
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Day columns — fill remaining height */}
              <div
                className="flex-1 min-h-0 grid"
                style={{ gridTemplateColumns: `repeat(${visibleWeekDays.length}, 1fr)` }}
              >
                {visibleWeekDays.map((day, i) => {
                  const isToday = sameDay(day, today);
                  const items = itemsForDay(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'flex flex-col gap-1.5 p-1.5 md:p-1.5 overflow-y-auto',
                        i < visibleWeekDays.length - 1 && 'border-r border-[var(--border)]',
                        isToday && 'bg-[var(--accent)]/5'
                      )}
                    >
                      {items.map((ci) => (
                        <button
                          key={calendarItemKey(ci)}
                          onClick={() => navigate(`/dashboard/work-items/${ci.item.id}`)}
                          className={cn(
                            'block w-full text-left p-2 md:p-2 rounded-lg text-white transition-all hover:brightness-110 flex-shrink-0 min-h-[44px]',
                            ci.isRecurring && 'opacity-70 border border-dashed border-white/50'
                          )}
                          style={{ backgroundColor: TYPE_COLORS[ci.item.type] ?? typeColor(ci.item.type) }}
                        >
                          <div className="text-[11px] md:text-[11px] font-bold leading-snug truncate">
                            {ci.item.subject}
                          </div>
                          <div className="text-[10px] md:text-[9px] text-white/75 font-medium truncate mt-0.5">
                            {clientMap[ci.item.clientId] ?? 'Unknown'}
                            {ci.item.appId && appMap[ci.item.appId] && (
                              <> · {appMap[ci.item.appId]}</>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className="text-[9px] md:text-[8px] bg-black/15 px-1 py-px rounded font-semibold">
                              {ci.item.totalHours.toFixed(1)}h
                            </span>
                            <span className="hidden md:inline text-[8px] bg-black/10 px-1 py-px rounded">
                              {WORK_ITEM_TYPE_LABELS[ci.item.type]}
                            </span>
                          </div>
                          {ci.item.recurrence && (
                            <div className="hidden md:flex text-[8px] text-white/55 mt-0.5 items-center gap-0.5">
                              <IconRepeat size={8} color="currentColor" />
                              {ci.item.recurrence.frequency === 'custom'
                                ? `${ci.item.recurrence.customDays}d`
                                : RECURRENCE_LABELS[ci.item.recurrence.frequency]}
                            </div>
                          )}
                        </button>
                      ))}
                      {items.length === 0 && (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-[var(--border)]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── List View ───────────────────────────────── */}
          {view === 'list' && (
            <div className="flex flex-col h-full overflow-y-auto">
              {listItems.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-3">
                    <IconCalendarIcon size={28} color="var(--accent)" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No items this month</p>
                  <p className="text-xs text-[var(--text-secondary)]">Work items scheduled for this month will appear here</p>
                </div>
              )}
              {listItems.map((ci, idx) => {
                const d = ci.displayDate;
                const isToday = sameDay(d, today);
                // Group separator: show date header when date changes
                const prevDate = idx > 0 ? listItems[idx - 1].displayDate : null;
                const showDateHeader = !prevDate || !sameDay(prevDate, d);

                return (
                  <div key={calendarItemKey(ci)}>
                    {showDateHeader && (
                      <div
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border)]',
                          isToday
                            ? 'text-[var(--accent)] bg-[var(--accent)]/5'
                            : 'text-[var(--text-secondary)] bg-[var(--bg-input)]/40'
                        )}
                      >
                        <span>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {isToday && <span className="text-[8px] bg-[var(--accent)]/15 px-1.5 py-px rounded-full">Today</span>}
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/dashboard/work-items/${ci.item.id}`)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 md:py-2 text-left border-b border-[var(--border)] hover:bg-[var(--bg-input)]/40 transition-colors group min-h-[44px]',
                        ci.isRecurring && 'opacity-75'
                      )}
                    >
                      {/* Color stripe */}
                      <div
                        className="w-0.5 self-stretch rounded-full flex-shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[ci.item.type] ?? typeColor(ci.item.type) }}
                      />
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                            {ci.item.subject}
                          </span>
                          <StatusBadge status={ci.item.status} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {clientMap[ci.item.clientId] ?? 'Unknown'}
                            {ci.item.appId && appMap[ci.item.appId] && (
                              <> · {appMap[ci.item.appId]}</>
                            )}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)] font-semibold">
                            {ci.item.totalHours.toFixed(1)}h
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {formatCurrency(ci.item.totalCost)}
                          </span>
                          <span
                            className="text-[8px] font-bold px-1.5 py-px rounded-full text-white"
                            style={{ backgroundColor: TYPE_COLORS[ci.item.type] ?? typeColor(ci.item.type) }}
                          >
                            {WORK_ITEM_TYPE_LABELS[ci.item.type]}
                          </span>
                          {ci.item.recurrence && (
                            <span className="text-[8px] text-[var(--accent)] font-medium flex items-center gap-0.5">
                              <IconRepeat size={8} color="currentColor" />
                              {ci.item.recurrence.frequency === 'custom'
                                ? `${ci.item.recurrence.customDays}d`
                                : RECURRENCE_LABELS[ci.item.recurrence.frequency]}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );
}
