import { Link } from 'react-router-dom';
import { Sparkline } from './DashboardCharts';
import {
  IconChevronRight,
  IconDocument,
  IconClients,
  IconDollar,
  IconClock,
} from '../icons/Icons';
import type { IconProps } from '../icons/Icons';

/* ── Trend Stat Card ───────────────────────────────── */

interface TrendStatCardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: number; // percentage change
  sparkData: number[];
  sparkColor?: string;
  sparkGradientId: string;
  to: string;
  Icon: (props: IconProps) => React.JSX.Element;
  delay?: number;
}

export function TrendStatCard({
  label,
  value,
  subtext,
  trend,
  sparkData,
  sparkColor = 'var(--accent)',
  sparkGradientId,
  to,
  Icon,
  delay = 0,
}: TrendStatCardProps) {
  const trendUp = trend != null && trend >= 0;
  const trendStr = trend != null
    ? `${trendUp ? '+' : ''}${trend.toFixed(0)}%`
    : null;

  return (
    <Link
      to={to}
      className="group bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 md:p-4 hover-lift block animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-1.5 md:mb-3">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <Icon size={14} color="var(--accent)" />
          </div>
          <span className="text-[9px] md:text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            {label}
          </span>
        </div>
        <IconChevronRight
          size={14}
          className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>

      <div className="flex items-end justify-between gap-2 md:gap-4">
        <div>
          <div className="text-lg md:text-2xl font-extrabold text-[var(--text-primary)] leading-none">
            {value}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-1.5">
            {trendStr && (
              <span
                className="text-[9px] md:text-[10px] font-bold px-1 md:px-1.5 py-0.5 rounded-full"
                style={{
                  color: trendUp ? 'var(--color-green)' : 'var(--color-red)',
                  backgroundColor: trendUp
                    ? 'color-mix(in srgb, var(--color-green) 12%, transparent)'
                    : 'color-mix(in srgb, var(--color-red) 12%, transparent)',
                }}
              >
                {trendStr}
              </span>
            )}
            {subtext && (
              <span className="text-[9px] md:text-[10px] text-[var(--text-secondary)]">{subtext}</span>
            )}
          </div>
        </div>
        <div className="w-16 md:w-24 flex-shrink-0">
          <Sparkline
            data={sparkData}
            color={sparkColor}
            gradientId={sparkGradientId}
            height={28}
          />
        </div>
      </div>
    </Link>
  );
}

/* ── Client Row ────────────────────────────────────── */

interface ClientRowProps {
  name: string;
  hours: number;
  maxHours: number;
  clientId: string;
}

function ClientRow({ name, hours, maxHours, clientId }: ClientRowProps) {
  const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
  return (
    <Link
      to={`/dashboard/clients/${clientId}`}
      className="group flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-[var(--bg-input)]/50 transition-colors"
    >
      <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-[10px] font-extrabold text-[var(--accent)]">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-[var(--text-primary)] truncate">{name}</div>
        <div className="mt-1 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
      </div>
      <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
        {hours.toFixed(1)}h
      </span>
      <IconChevronRight
        size={12}
        className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </Link>
  );
}

/* ── Top Clients Card ──────────────────────────────── */

interface TopClientsCardProps {
  clients: Array<{ id: string; name: string; hours: number }>;
  delay?: number;
}

export function TopClientsCard({ clients, delay = 0 }: TopClientsCardProps) {
  const maxHours = clients.length > 0 ? Math.max(...clients.map((c) => c.hours)) : 0;

  return (
    <div
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 md:p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <IconClients size={16} color="var(--accent)" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            Top Clients
          </span>
        </div>
        <Link
          to="/dashboard/clients"
          className="text-[10px] font-bold text-[var(--accent)] hover:underline"
        >
          View All
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
          No activity yet
        </p>
      ) : (
        <div className="space-y-0.5">
          {clients.map((c) => (
            <ClientRow
              key={c.id}
              name={c.name}
              hours={c.hours}
              maxHours={maxHours}
              clientId={c.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Pipeline Card ─────────────────────────────────── */

interface PipelineStage {
  label: string;
  count: number;
  color: string;
}

interface PipelineCardProps {
  stages: PipelineStage[];
  delay?: number;
}

export function PipelineCard({ stages, delay = 0 }: PipelineCardProps) {
  const total = stages.reduce((s, st) => s + st.count, 0);

  return (
    <div
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 md:p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <IconDocument size={16} color="var(--accent)" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            Work Pipeline
          </span>
        </div>
        <Link
          to="/dashboard/work-items"
          className="text-[10px] font-bold text-[var(--accent)] hover:underline"
        >
          View All
        </Link>
      </div>

      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-[var(--bg-input)] mb-4">
        {stages.map((stage) => {
          const pct = total > 0 ? (stage.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={stage.label}
              className="h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: stage.color,
              }}
              title={`${stage.label}: ${stage.count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-[10px] text-[var(--text-secondary)] truncate">
              {stage.label}
            </span>
            <span className="text-xs font-extrabold text-[var(--text-primary)] ml-auto tabular-nums">
              {stage.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Invoice Summary Card ──────────────────────────── */

interface InvoiceSummaryProps {
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
  delay?: number;
}

export function InvoiceSummaryCard({ draft, sent, paid, overdue, delay = 0 }: InvoiceSummaryProps) {
  const items = [
    { label: 'Draft', count: draft, color: 'var(--text-secondary)' },
    { label: 'Sent', count: sent, color: 'var(--accent)' },
    { label: 'Paid', count: paid, color: 'var(--color-green)' },
    { label: 'Overdue', count: overdue, color: 'var(--color-red)' },
  ];

  return (
    <div
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 md:p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[var(--color-orange)]/10 flex items-center justify-center">
            <IconDollar size={16} color="var(--color-orange)" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            Invoices
          </span>
        </div>
        <Link
          to="/dashboard/finance/invoices"
          className="text-[10px] font-bold text-[var(--accent)] hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div
              className="text-xl font-extrabold tabular-nums"
              style={{ color: item.color }}
            >
              {item.count}
            </div>
            <div className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mt-0.5">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Upcoming Items Card ───────────────────────────── */

interface UpcomingItem {
  id: string;
  subject: string;
  clientName: string;
  date: Date;
}

interface UpcomingCardProps {
  items: UpcomingItem[];
  delay?: number;
}

export function UpcomingCard({ items, delay = 0 }: UpcomingCardProps) {
  return (
    <div
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 md:p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[var(--color-orange)]/10 flex items-center justify-center">
            <IconClock size={16} color="var(--color-orange)" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            Upcoming
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
          Nothing scheduled
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/dashboard/work-items/${item.id}`}
              className="group flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-[var(--bg-input)]/50 transition-colors"
            >
              <div className="text-center flex-shrink-0 w-10">
                <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                  {item.date.toLocaleDateString('en-US', { month: 'short' })}
                </div>
                <div className="text-sm font-extrabold text-[var(--text-primary)] leading-tight">
                  {item.date.getDate()}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {item.subject}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">{item.clientName}</div>
              </div>
              <IconChevronRight
                size={12}
                className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
