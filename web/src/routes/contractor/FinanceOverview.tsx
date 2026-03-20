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

  const clientRevenue = useMemo(
    () => getRevenueByClient(workItems, clients, range),
    [workItems, clients, range]
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Finance
        </h1>
        <DateRangeSelector value={preset} onChange={setPreset} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Revenue"
          value={revenue}
          trend={revenueTrend}
          color="green"
        />
        <KpiCard
          label="Outstanding"
          value={outstanding}
          subtitle="Awaiting payment"
          color="orange"
        />
        <KpiCard
          label="Overdue"
          value={overdue}
          subtitle="Past due date"
          color="red"
        />
        <KpiCard
          label="Billed This Period"
          value={billedInPeriod}
          color="accent"
        />
      </div>

      {/* Chart + Top Clients (2/3 + 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <RevenueChart data={monthlyRevenue} />
        </div>
        <div className="lg:col-span-1">
          <TopClients clients={clientRevenue} />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed workItems={workItems} clients={clients} />
    </div>
  );
}
