import { useMemo, useState, useCallback, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { WorkItemCard } from '../../components/WorkItemCard';
import { Onboarding } from '../../components/Onboarding';
import { useAuth } from '../../hooks/useAuth';
import { useSettings, useTimeEntries, useInsights } from '../../hooks/useFirestore';
import { UtilizationGauge } from '../../components/insights/UtilizationGauge';
import { InsightShimmer } from '../../components/insights/InsightShimmer';
import {
  IconDocument,
  IconClients,
  IconDollar,
  IconClock,
  IconCamera,
  IconCar,
  IconPlus,
} from '../../components/icons/Icons';
import { TrendChart, VerticalBarChart } from '../../components/dashboard/DashboardCharts';
import {
  TrendStatCard,
  TopClientsCard,
  PipelineCard,
  InvoiceSummaryCard,
  UpcomingCard,
} from '../../components/dashboard/DashboardCards';
import {
  useDashboardWidgets,
  WidgetConfigurator,
  WidgetSettingsButton,
} from '../../components/dashboard/WidgetConfigurator';

import type { WorkItem, Client, App } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

/* ── Widget section labels ────────────────────────── */

const WIDGET_SECTIONS: Record<string, string> = {
  'quick-actions': 'Quick Links',
  'stat-cards': 'Quick Links',
  'work-time': 'Analytics',
  'weekly-hours': 'Analytics',
  'info-grid': 'Analytics',
  'revenue-chart': 'Analytics',
  'utilization-gauge': 'Analytics',
  'needs-attention': 'Activity',
  'recent-completed': 'Activity',
};

class WidgetErrorBoundary extends Component<
  { widgetId: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Widget "${this.props.widgetId}"]`, error.message, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, background: '#FEE2E2', borderRadius: 8, marginBottom: 12, fontFamily: 'monospace', fontSize: 12 }}>
          <strong>Widget "{this.props.widgetId}" crashed:</strong> {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

interface DashboardProps {
  workItems: WorkItem[];
  clients: Client[];
  apps: App[];
}

export default function Dashboard({ workItems, clients, apps }: DashboardProps) {
  const { user } = useAuth();
  const { settings } = useSettings(user?.uid);
  const { entries: timeEntries } = useTimeEntries();
  const { insights, isGenerating } = useInsights();
  const navigate = useNavigate();
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('oc-onboarded') === 'true'
  );

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingDismissed(true);
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

  const showOnboarding =
    !onboardingDismissed &&
    clients.length === 0 &&
    workItems.length === 0 &&
    user != null;

  const pending = workItems.filter(
    (i) => i.status === 'draft' || i.status === 'inReview'
  );

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekHours = workItems
    .filter((i) => i.updatedAt >= weekStart && i.status !== 'archived')
    .reduce((s, i) => s + i.totalHours, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = workItems
    .filter(
      (i) =>
        i.isBillable &&
        i.invoiceStatus === 'paid' &&
        i.invoicePaidDate != null &&
        i.invoicePaidDate >= monthStart
    )
    .reduce((s, i) => s + i.totalCost, 0);

  const recentCompleted = workItems
    .filter((i) => i.status === 'approved' || i.status === 'completed')
    .slice(0, 5);



  /* ── Desktop: Daily hours for the past 7 days ──── */
  const dailyHoursData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(now.getDate() - d);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      const hours = workItems
        .filter((i) => i.status !== 'archived' && i.updatedAt >= date && i.updatedAt < nextDay)
        .reduce((s, i) => s + i.totalHours, 0);
      days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: parseFloat(hours.toFixed(1)),
      });
    }
    return days;
  }, [workItems, now.toDateString()]);

  /* ── Desktop: Monthly revenue for 6 months ─────── */
  const monthlyRevenueData = useMemo(() => {
    const months: { label: string; value: number }[] = [];
    for (let m = 5; m >= 0; m--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
      const rev = workItems
        .filter(
          (i) =>
            i.isBillable &&
            i.invoiceStatus === 'paid' &&
            i.invoicePaidDate != null &&
            i.invoicePaidDate >= mStart &&
            i.invoicePaidDate < mEnd
        )
        .reduce((s, i) => s + i.totalCost, 0);
      months.push({
        label: mStart.toLocaleDateString('en-US', { month: 'short' }),
        value: parseFloat(rev.toFixed(0)),
      });
    }
    return months;
  }, [workItems, now.getMonth()]);

  /* ── Desktop: Sparkline data (last 7 values) ───── */
  const hoursSparkData = useMemo(() => dailyHoursData.map((d) => d.value), [dailyHoursData]);
  const revenueSparkData = useMemo(() => monthlyRevenueData.map((d) => d.value), [monthlyRevenueData]);

  /* ── Desktop: Previous week hours for trend % ──── */
  const prevWeekHours = useMemo(() => {
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    return workItems
      .filter((i) => i.status !== 'archived' && i.updatedAt >= prevStart && i.updatedAt < weekStart)
      .reduce((s, i) => s + i.totalHours, 0);
  }, [workItems, weekStart.getTime()]);

  const hoursTrend = prevWeekHours > 0 ? ((thisWeekHours - prevWeekHours) / prevWeekHours) * 100 : null;

  /* ── Desktop: Previous month revenue for trend % ── */
  const prevMonthRevenue = useMemo(() => {
    const pmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return workItems
      .filter(
        (i) =>
          i.isBillable &&
          i.invoiceStatus === 'paid' &&
          i.invoicePaidDate != null &&
          i.invoicePaidDate >= pmStart &&
          i.invoicePaidDate < monthStart
      )
      .reduce((s, i) => s + i.totalCost, 0);
  }, [workItems, monthStart.getTime()]);

  const revenueTrend = prevMonthRevenue > 0
    ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
    : null;

  /* ── Desktop: Top clients by hours (last 30 days) ── */
  const topClients = useMemo(() => {
    const thirtyAgo = new Date(now);
    thirtyAgo.setDate(now.getDate() - 30);
    const byClient: Record<string, number> = {};
    workItems
      .filter((i) => i.status !== 'archived' && i.updatedAt >= thirtyAgo)
      .forEach((i) => {
        byClient[i.clientId] = (byClient[i.clientId] ?? 0) + i.totalHours;
      });
    return Object.entries(byClient)
      .map(([id, hours]) => ({ id, name: clientMap[id] ?? 'Unknown', hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [workItems, clientMap, now.toDateString()]);

  /* ── Desktop: Pipeline stages ──────────────────── */
  const pipelineStages = useMemo(() => {
    const counts: Record<string, number> = { draft: 0, inReview: 0, approved: 0, completed: 0 };
    workItems
      .filter((i) => i.status !== 'archived')
      .forEach((i) => { counts[i.status] = (counts[i.status] ?? 0) + 1; });
    return [
      { label: 'Draft', count: counts.draft, color: 'var(--text-secondary)' },
      { label: 'In Review', count: counts.inReview, color: 'var(--color-orange)' },
      { label: 'Approved', count: counts.approved, color: 'var(--accent)' },
      { label: 'Completed', count: counts.completed, color: 'var(--color-green)' },
    ];
  }, [workItems]);

  /* ── Desktop: Invoice status counts ────────────── */
  const invoiceCounts = useMemo(() => {
    const c = { draft: 0, sent: 0, paid: 0, overdue: 0 };
    workItems
      .filter((i) => i.isBillable && i.invoiceStatus)
      .forEach((i) => {
        if (i.invoiceStatus === 'draft') c.draft++;
        else if (i.invoiceStatus === 'sent') c.sent++;
        else if (i.invoiceStatus === 'paid') c.paid++;
        else if (i.invoiceStatus === 'overdue') c.overdue++;
      });
    return c;
  }, [workItems]);

  /* ── Desktop: Upcoming scheduled items ─────────── */
  const upcoming = useMemo(() => {
    return workItems
      .filter((i) => i.scheduledDate && i.scheduledDate >= now && i.status !== 'archived')
      .sort((a, b) => (a.scheduledDate!.getTime()) - (b.scheduledDate!.getTime()))
      .slice(0, 4)
      .map((i) => ({
        id: i.id!,
        subject: i.subject,
        clientName: clientMap[i.clientId] ?? 'Unknown',
        date: i.scheduledDate!,
      }));
  }, [workItems, clientMap, now.toDateString()]);

  /* ── Work Time: daily tracked hours (last 7 days) ── */
  const timeEntryDailyData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(now.getDate() - d);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      const hours = timeEntries
        .filter((e) => e.endedAt >= date && e.endedAt < nextDay)
        .reduce((s, e) => s + e.durationSeconds / 3600, 0);
      days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: parseFloat(hours.toFixed(1)),
      });
    }
    return days;
  }, [timeEntries, now.toDateString()]);

  const weekTrackedHours = useMemo(() =>
    timeEntries
      .filter((e) => e.endedAt >= weekStart)
      .reduce((s, e) => s + e.durationSeconds / 3600, 0),
    [timeEntries, weekStart.getTime()]
  );

  const weekBillableHours = useMemo(() =>
    timeEntries
      .filter((e) => e.endedAt >= weekStart && e.isBillable)
      .reduce((s, e) => s + e.durationSeconds / 3600, 0),
    [timeEntries, weekStart.getTime()]
  );

  /* ── Widget customization ──────────────────────── */
  const { config: widgetConfig, isVisible, toggleWidget, moveWidget, resetToDefault } = useDashboardWidgets();
  const [widgetPanelOpen, setWidgetPanelOpen] = useState(false);


  /* ── Widget render map ─────────────────────────── */
  const quickActions = [
    { label: 'Invoice', Icon: IconDollar, color: 'var(--color-orange)', action: () => navigate('/dashboard/finance/invoices') },
    { label: 'Receipt', Icon: IconCamera, color: 'var(--accent)', action: () => navigate('/dashboard/finance/receipts') },
    { label: 'Client', Icon: IconPlus, color: 'var(--color-green)', action: () => navigate('/dashboard/clients') },
    { label: 'Trip', Icon: IconCar, color: 'var(--text-secondary)', action: () => navigate('/dashboard/finance/mileage') },
  ];

  const widgetRenderers: Record<string, () => React.ReactNode> = {
    'quick-actions': () => (
      <div className="flex gap-2 mb-3 md:mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {quickActions.map(({ label, Icon, color, action }) => (
          <button
            key={label}
            onClick={action}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-input)] active:scale-[0.97] transition-all flex-shrink-0 border-l-[3px] shadow-sm"
            style={{ borderLeftColor: color }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
            >
              <Icon size={16} color={color} />
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>
    ),

    'stat-cards': () => (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-6">
        <TrendStatCard
          label="This Week"
          value={`${thisWeekHours.toFixed(1)}h`}
          subtext="vs last week"
          trend={hoursTrend ?? undefined}
          sparkData={hoursSparkData}
          sparkColor="var(--accent)"
          sparkGradientId="spark-hours"
          to="/dashboard/work-items"
          Icon={IconClock}
          delay={0}
        />
        <TrendStatCard
          label="Revenue"
          value={formatCurrency(monthRevenue)}
          subtext="this month"
          trend={revenueTrend ?? undefined}
          sparkData={revenueSparkData}
          sparkColor="var(--color-orange)"
          sparkGradientId="spark-revenue"
          to="/dashboard/finance"
          Icon={IconDollar}
          delay={60}
        />
        <TrendStatCard
          label="Pending"
          value={String(pending.length)}
          subtext="work orders"
          sparkData={pipelineStages.map((s) => s.count)}
          sparkColor="var(--color-orange)"
          sparkGradientId="spark-pending"
          to="/dashboard/work-items"
          Icon={IconDocument}
          delay={120}
        />
        <TrendStatCard
          label="Clients"
          value={String(clients.length)}
          subtext="active"
          sparkData={topClients.map((c) => c.hours)}
          sparkColor="var(--accent)"
          sparkGradientId="spark-clients"
          to="/dashboard/clients"
          Icon={IconClients}
          delay={180}
        />
      </div>
    ),

    'work-time': () => {
      const weekNonBillable = weekTrackedHours - weekBillableHours;
      return (
        <div
          className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 md:p-5 mb-3 md:mb-6 animate-fade-in-up"
          style={{ animationDelay: '150ms' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                <IconClock size={16} color="var(--accent)" />
              </div>
              <h2 className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                Work Time
              </h2>
            </div>
          </div>
          <div className="flex items-baseline gap-3 md:gap-4 mt-1 md:mt-2 mb-2 md:mb-3">
            <div>
              <span className="text-xl md:text-2xl font-extrabold text-[var(--text-primary)]">
                {weekTrackedHours.toFixed(1)}h
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] ml-1">tracked</span>
            </div>
            <div>
              <span className="text-base md:text-lg font-bold text-[var(--accent)]">
                {weekBillableHours.toFixed(1)}h
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] ml-1">billable</span>
            </div>
            {weekNonBillable > 0.05 && (
              <div>
                <span className="text-base md:text-lg font-bold text-[var(--text-secondary)]">
                  {weekNonBillable.toFixed(1)}h
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] ml-1">other</span>
              </div>
            )}
          </div>
          {timeEntryDailyData.some((d) => d.value > 0) ? (
            <TrendChart
              data={timeEntryDailyData}
              color="var(--accent)"
              gradientId="chart-work-time"
              height={100}
              valueFormatter={(v) => `${v}h`}
            />
          ) : (
            <div className="hidden md:flex items-center justify-center h-[140px] text-sm text-[var(--text-secondary)]">
              No tracked time yet this week
            </div>
          )}
        </div>
      );
    },

    'weekly-hours': () => (
      <div
        className="hidden md:block bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-3 md:mb-6 animate-fade-in-up"
        style={{ animationDelay: '200ms' }}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
              This Week
            </h2>
            <div className="flex items-baseline gap-4 mt-1">
              <div>
                <span className="text-2xl font-extrabold text-[var(--text-primary)]">
                  {thisWeekHours.toFixed(1)}h
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] ml-1">hours</span>
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[var(--color-orange)]">
                  {formatCurrency(monthRevenue)}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] ml-1">revenue</span>
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[var(--accent)]">
                  {pending.length}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] ml-1">pending</span>
              </div>
            </div>
          </div>
          <Link
            to="/dashboard/finance/reports"
            className="text-[10px] font-bold text-[var(--accent)] hover:underline"
          >
            Full Report
          </Link>
        </div>
        <div className="mt-4">
          <VerticalBarChart
            data={dailyHoursData}
            color="var(--accent)"
            gradientId="chart-weekly-hours"
            height={160}
            valueFormatter={(v) => `${v}h`}
          />
        </div>
      </div>
    ),

    'info-grid': () => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-6">
        <TopClientsCard clients={topClients} delay={280} />
        <PipelineCard stages={pipelineStages} delay={340} />
        <div className="space-y-4">
          <InvoiceSummaryCard
            draft={invoiceCounts.draft}
            sent={invoiceCounts.sent}
            paid={invoiceCounts.paid}
            overdue={invoiceCounts.overdue}
            delay={400}
          />
          <UpcomingCard items={upcoming} delay={460} />
        </div>
      </div>
    ),

    'revenue-chart': () => (
      <div
        className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 md:p-5 mb-3 md:mb-6 animate-fade-in-up"
        style={{ animationDelay: '500ms' }}
      >
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[var(--color-orange)]/10 flex items-center justify-center">
              <IconDollar size={16} color="var(--color-orange)" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
              Revenue — 6 Months
            </span>
          </div>
          <Link
            to="/dashboard/finance/reports"
            className="text-[10px] font-bold text-[var(--accent)] hover:underline"
          >
            Details
          </Link>
        </div>
        <VerticalBarChart
          data={monthlyRevenueData}
          color="var(--color-orange)"
          gradientId="chart-monthly-rev"
          height={100}
          valueFormatter={(v) => formatCurrency(v)}
          showYAxis
        />
      </div>
    ),

    'needs-attention': () =>
      pending.length > 0 ? (
        <div className="mb-3 md:mb-6">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Needs Attention
            </h2>
            <Link
              to="/dashboard/work-items"
              className="text-[10px] font-bold text-[var(--accent)] hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 5).map((item, i) => (
              <div
                key={item.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${550 + i * 50}ms` }}
              >
                <WorkItemCard
                  item={item}
                  clientName={clientMap[item.clientId] ?? 'Unknown'}
                  appName={item.appId ? appMap[item.appId] : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null,

    'utilization-gauge': () =>
      isGenerating ? (
        <div className="mb-3 md:mb-6">
          <InsightShimmer label="Utilization loading..." />
        </div>
      ) : insights?.projects?.utilization ? (
        <div className="mb-3 md:mb-6">
          <UtilizationGauge utilization={insights.projects.utilization} />
        </div>
      ) : null,

    'recent-completed': () =>
      recentCompleted.length > 0 ? (
        <div className="mb-3 md:mb-6">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Recently Completed
            </h2>
          </div>
          <div className="space-y-2">
            {recentCompleted.map((item, i) => (
              <div
                key={item.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${600 + i * 50}ms` }}
              >
                <WorkItemCard
                  item={item}
                  clientName={clientMap[item.clientId] ?? 'Unknown'}
                  appName={item.appId ? appMap[item.appId] : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null,
  };

  if (showOnboarding) {
    return (
      <Onboarding
        user={user}
        settings={settings}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <div className="hidden md:block">
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
            {now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}
            {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="md:hidden" />
        <WidgetSettingsButton onClick={() => setWidgetPanelOpen(true)} />
      </div>

      {/* Concentration risk warning banner */}
      {insights?.clients?.concentrationRisk?.level === 'dangerous' && (
        <div className="rounded-xl p-3 text-sm flex items-center gap-2 mb-3 md:mb-6" style={{
          background: 'color-mix(in srgb, var(--color-orange) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-orange) 25%, transparent)',
          color: 'var(--color-orange)',
        }}>
          <span className="font-medium">Revenue concentration risk:</span>
          {insights.clients.concentrationRisk.recommendation}
        </div>
      )}

      {/* Render widgets in user-configured order, with section labels */}
      {widgetConfig.order
        .filter((id) => isVisible(id) && widgetRenderers[id])
        .map((widgetId, idx, visible) => {
          const section = WIDGET_SECTIONS[widgetId] ?? '';
          const prevSection = idx > 0 ? (WIDGET_SECTIONS[visible[idx - 1]] ?? '') : '';
          const showHeader = section !== '' && section !== prevSection;
          return (
            <div key={widgetId}>
              {showHeader && (
                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 md:mb-3 mt-1 md:mt-2">
                  {section}
                </h2>
              )}
              <WidgetErrorBoundary widgetId={widgetId}>
                {widgetRenderers[widgetId]()}
              </WidgetErrorBoundary>
            </div>
          );
        })}

      {/* Widget configurator modal */}
      {widgetPanelOpen && (
        <WidgetConfigurator
          config={widgetConfig}
          onToggle={toggleWidget}
          onMove={moveWidget}
          onReset={resetToDefault}
          onClose={() => setWidgetPanelOpen(false)}
        />
      )}
    </div>
  );
}
