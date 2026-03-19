import { useMemo } from 'react';
import type { WorkItem, Client } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { StatCard } from '../../components/StatCard';
import { WORK_ITEM_TYPE_LABELS } from '../../lib/types';

interface AnalyticsProps {
  workItems: WorkItem[];
  clients: Client[];
}

export default function Analytics({ workItems, clients }: AnalyticsProps) {
  const active = workItems.filter((i) => i.status !== 'archived');
  const billable = active.filter((i) => i.isBillable);

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const stats = useMemo(() => {
    const thisMonthItems = billable.filter((i) => i.createdAt >= thisMonth);
    const lastMonthItems = billable.filter(
      (i) => i.createdAt >= lastMonth && i.createdAt <= lastMonthEnd
    );

    const thisMonthRevenue = thisMonthItems.reduce((s, i) => s + i.totalCost, 0);
    const lastMonthRevenue = lastMonthItems.reduce((s, i) => s + i.totalCost, 0);
    const thisMonthHours = thisMonthItems.reduce((s, i) => s + i.totalHours, 0);

    const totalRevenue = billable.reduce((s, i) => s + i.totalCost, 0);
    const totalHours = active.reduce((s, i) => s + i.totalHours, 0);
    const avgOrderValue = billable.length > 0 ? totalRevenue / billable.length : 0;

    return {
      thisMonthRevenue,
      lastMonthRevenue,
      thisMonthHours,
      totalRevenue,
      totalHours,
      avgOrderValue,
      totalOrders: active.length,
    };
  }, [active, billable, thisMonth, lastMonth, lastMonthEnd]);

  // Revenue by month (last 6 months)
  const monthlyRevenue = useMemo(() => {
    const months: { label: string; revenue: number; hours: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString('en-US', { month: 'short' });
      const items = billable.filter((w) => w.createdAt >= start && w.createdAt <= end);
      months.push({
        label,
        revenue: items.reduce((s, w) => s + w.totalCost, 0),
        hours: items.reduce((s, w) => s + w.totalHours, 0),
      });
    }
    return months;
  }, [billable, now]);

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  // By type
  const byType = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; hours: number }> = {};
    active.forEach((i) => {
      if (!map[i.type]) map[i.type] = { count: 0, revenue: 0, hours: 0 };
      map[i.type].count++;
      map[i.type].revenue += i.totalCost;
      map[i.type].hours += i.totalHours;
    });
    return map;
  }, [active]);

  // By client
  const byClient = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    const clientNames: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) clientNames[c.id] = c.name; });

    billable.forEach((i) => {
      if (!map[i.clientId]) map[i.clientId] = { count: 0, revenue: 0 };
      map[i.clientId].count++;
      map[i.clientId].revenue += i.totalCost;
    });

    return Object.entries(map)
      .map(([id, data]) => ({ name: clientNames[id] ?? 'Unknown', ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [billable, clients]);

  const typeColors: Record<string, string> = {
    changeRequest: '#4BA8A8',
    featureRequest: '#27AE60',
    maintenance: '#E67E22',
  };

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider mb-6">
        Analytics
      </h1>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="This Month" value={formatCurrency(stats.thisMonthRevenue)} color="#4BA8A8" />
        <StatCard label="Last Month" value={formatCurrency(stats.lastMonthRevenue)} />
        <StatCard label="All-Time Revenue" value={formatCurrency(stats.totalRevenue)} color="#27AE60" />
        <StatCard label="Avg Order" value={formatCurrency(stats.avgOrderValue)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Hours" value={`${stats.totalHours.toFixed(1)}h`} color="#4BA8A8" />
        <StatCard label="Total Orders" value={String(stats.totalOrders)} />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-5 mb-6">
        <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider mb-4">
          Monthly Revenue
        </h2>
        <div className="flex items-end gap-2 sm:gap-3 h-32 sm:h-40 lg:h-48">
          {monthlyRevenue.map((month) => (
            <div key={month.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-[#86868B] hidden sm:inline">
                {month.revenue > 0 ? formatCurrency(month.revenue) : ''}
              </span>
              <div
                className="w-full rounded-t-lg bg-[#4BA8A8] transition-all"
                style={{ height: `${(month.revenue / maxRevenue) * 80}%`, minHeight: month.revenue > 0 ? 4 : 0 }}
              />
              <span className="text-[10px] sm:text-xs font-semibold text-[#86868B]">{month.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* By Type */}
        <div className="bg-white rounded-xl border border-[#E5E5EA] p-5">
          <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider mb-4">
            By Type
          </h2>
          <div className="space-y-3">
            {Object.entries(byType).map(([type, data]) => (
              <div key={type} className="flex items-center gap-3">
                <div
                  className="w-2 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: typeColors[type] ?? '#999' }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[#1A1A2E]">
                    {WORK_ITEM_TYPE_LABELS[type as keyof typeof WORK_ITEM_TYPE_LABELS] ?? type}
                  </div>
                  <div className="text-xs text-[#86868B]">
                    {data.count} items · {data.hours.toFixed(1)}h
                  </div>
                </div>
                <span className="text-sm font-bold text-[#1A1A2E]">
                  {formatCurrency(data.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* By Client */}
        <div className="bg-white rounded-xl border border-[#E5E5EA] p-5">
          <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider mb-4">
            Top Clients
          </h2>
          <div className="space-y-3">
            {byClient.slice(0, 5).map((entry) => (
              <div key={entry.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#4BA8A8] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {entry.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[#1A1A2E]">{entry.name}</div>
                  <div className="text-xs text-[#86868B]">{entry.count} orders</div>
                </div>
                <span className="text-sm font-bold text-[#1A1A2E]">
                  {formatCurrency(entry.revenue)}
                </span>
              </div>
            ))}
            {byClient.length === 0 && (
              <div className="text-sm text-[#86868B] text-center py-4">No data yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
