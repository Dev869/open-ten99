import { useState, useMemo } from 'react';
import type { WorkItem, Client } from '../../lib/types';
import {
  getDateRange,
  calculateRevenue,
  calculateOutstanding,
  calculateOverdue,
  calculateTrend,
  getMonthlyRevenue,
  getRevenueByClient,
} from '../../lib/finance';
import type { DateRangePreset } from '../../lib/finance';
import { DateRangeSelector } from '../../components/finance/DateRangeSelector';
import { KpiCard } from '../../components/finance/KpiCard';
import { RevenueChart } from '../../components/finance/RevenueChart';
import { TopClients } from '../../components/finance/TopClients';
import { ActivityFeed } from '../../components/finance/ActivityFeed';
import { useInsights } from '../../hooks/useFirestore';
import { CashFlowChart } from '../../components/insights/CashFlowChart';
import { RunwayCard } from '../../components/insights/RunwayCard';
import { InsightShimmer } from '../../components/insights/InsightShimmer';

export default function FinanceOverview({ workItems, clients }: { workItems: WorkItem[]; clients: Client[] }) {
  const now = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<DateRangePreset>('mtd');

  const range = useMemo(() => getDateRange(preset, now), [preset, now]);

  // Calculate previous period (same duration ending just before range.start)
  const previousRange = useMemo(() => {
    const durationMs = range.end.getTime() - range.start.getTime();
    const prevEnd = new Date(range.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { start: prevStart, end: prevEnd };
  }, [range]);

  const revenue = useMemo(() => calculateRevenue(workItems, range), [workItems, range]);
  const previousRevenue = useMemo(() => calculateRevenue(workItems, previousRange), [workItems, previousRange]);
  const revenueTrend = useMemo(() => calculateTrend(revenue, previousRevenue), [revenue, previousRevenue]);

  const outstanding = useMemo(() => calculateOutstanding(workItems), [workItems]);
  const overdue = useMemo(() => calculateOverdue(workItems), [workItems]);

  const billedInPeriod = useMemo(() => {
    return workItems
      .filter((item) => {
        if (!item.isBillable || !item.invoiceSentDate) return false;
        return item.invoiceSentDate >= range.start && item.invoiceSentDate <= range.end;
      })
      .reduce((sum, item) => sum + item.totalCost, 0);
  }, [workItems, range]);

  const monthlyRevenue = useMemo(() => getMonthlyRevenue(workItems, 6, now), [workItems, now]);

  const { insights, isGenerating } = useInsights();

  const clientRevenue = useMemo(
    () => getRevenueByClient(workItems, clients, range),
    [workItems, clients, range]
  );

  return (
    <div>
      {/* Mobile: compact finance dashboard that fits viewport */}
      <div className="md:hidden flex flex-col" style={{ minHeight: 'calc(100dvh - 3.5rem - 3.5rem - 2rem - env(safe-area-inset-bottom) - env(safe-area-inset-top))' }}>
        <div className="mb-3">
          <DateRangeSelector value={preset} onChange={setPreset} />
        </div>

        {/* KPI grid — 2x2 compact */}
        <div className="grid grid-cols-2 gap-2 flex-1">
          <KpiCard label="Revenue" value={revenue} trend={revenueTrend} color="green" />
          <KpiCard label="Outstanding" value={outstanding} color="orange" />
          <KpiCard label="Overdue" value={overdue} color="red" />
          <KpiCard label="Billed" value={billedInPeriod} color="accent" />
        </div>

        {/* Quick stats row */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Clients</div>
            <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{clientRevenue.length}</div>
          </div>
          <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Activity</div>
            <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{workItems.filter(i => i.invoiceStatus).length}</div>
          </div>
        </div>
      </div>

      {/* Desktop: full layout */}
      <div className="hidden md:block">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
            Finance
          </h1>
          <DateRangeSelector value={preset} onChange={setPreset} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Revenue" value={revenue} trend={revenueTrend} color="green" />
          <KpiCard label="Outstanding" value={outstanding} subtitle="Awaiting payment" color="orange" />
          <KpiCard label="Overdue" value={overdue} subtitle="Past due date" color="red" />
          <KpiCard label="Billed This Period" value={billedInPeriod} color="accent" />
          {isGenerating ? (
            <InsightShimmer label="Tax savings loading..." />
          ) : insights?.tax ? (
            <KpiCard
              label="Est. Tax Savings"
              value={insights.tax.estimatedSavings}
              subtitle={`$${insights.tax.totalDeductible.toLocaleString()} deductible`}
              color="green"
            />
          ) : null}
          {isGenerating ? (
            <InsightShimmer label="Runway loading..." />
          ) : insights?.cashFlow?.runway ? (
            <RunwayCard runway={insights.cashFlow.runway} />
          ) : null}
        </div>

        {/* Chart + Top Clients */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            <RevenueChart data={monthlyRevenue} />
          </div>
          <div className="lg:col-span-1">
            <TopClients clients={clientRevenue} />
          </div>
        </div>

        {/* Cash Flow Forecast */}
        {isGenerating ? (
          <InsightShimmer className="h-[260px] mb-4" label="Cash flow forecast loading..." />
        ) : insights?.cashFlow?.projections?.length ? (
          <div className="mb-4">
            <CashFlowChart projections={insights.cashFlow.projections} />
          </div>
        ) : null}

        {/* Activity Feed */}
        <ActivityFeed workItems={workItems} clients={clients} />
      </div>
    </div>
  );
}
