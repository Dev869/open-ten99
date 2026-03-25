import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
  PieChart, Pie, Cell,
} from 'recharts';
import { formatCurrency } from '../../lib/utils';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-bold mt-0.5" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// --- Revenue & Expenses Over Time ---

interface RevenueExpenseTrendProps {
  revenueByMonth: Array<{ month: string; amount: number }>;
  expensesByMonth: Array<{ month: string; amount: number }>;
}

export function RevenueExpenseTrend({ revenueByMonth, expensesByMonth }: RevenueExpenseTrendProps) {
  // Merge into a single dataset
  const months = new Set([
    ...revenueByMonth.map((r) => r.month),
    ...expensesByMonth.map((e) => e.month),
  ]);
  const revMap = new Map(revenueByMonth.map((r) => [r.month, r.amount]));
  const expMap = new Map(expensesByMonth.map((e) => [e.month, e.amount]));

  const data = Array.from(months)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((month) => ({
      month,
      revenue: revMap.get(month) ?? 0,
      expenses: expMap.get(month) ?? 0,
    }));

  if (data.length === 0) {
    return (
      <ChartCard title="Revenue vs Expenses">
        <div className="h-[220px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
          No data for this period
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Revenue vs Expenses">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" name="Revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="var(--color-red, #ef4444)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- Net Income Trend ---

interface NetIncomeTrendProps {
  revenueByMonth: Array<{ month: string; amount: number }>;
  expensesByMonth: Array<{ month: string; amount: number }>;
}

export function NetIncomeTrend({ revenueByMonth, expensesByMonth }: NetIncomeTrendProps) {
  const months = new Set([
    ...revenueByMonth.map((r) => r.month),
    ...expensesByMonth.map((e) => e.month),
  ]);
  const revMap = new Map(revenueByMonth.map((r) => [r.month, r.amount]));
  const expMap = new Map(expensesByMonth.map((e) => [e.month, e.amount]));

  const data = Array.from(months)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((month) => ({
      month,
      net: (revMap.get(month) ?? 0) - (expMap.get(month) ?? 0),
    }));

  if (data.length === 0) return null;

  return (
    <ChartCard title="Net Income Trend">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="netIncomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<ChartTooltipContent />} />
          <Area type="monotone" dataKey="net" name="Net Income" stroke="var(--accent)" strokeWidth={2.5} fill="url(#netIncomeGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- Expense Breakdown Pie ---

const PIE_COLORS = [
  '#4BA8A8', '#6366f1', '#f59e0b', '#ef4444', '#10b981',
  '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#84cc16',
];

interface ExpenseBreakdownProps {
  expensesByCategory: Array<{ category: string; amount: number }>;
}

export function ExpenseBreakdown({ expensesByCategory }: ExpenseBreakdownProps) {
  if (expensesByCategory.length === 0) {
    return (
      <ChartCard title="Expense Breakdown">
        <div className="h-[220px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
          No expenses in this period
        </div>
      </ChartCard>
    );
  }

  const data = expensesByCategory.slice(0, 8).map((e) => ({
    name: e.category,
    value: Math.round(e.amount * 100) / 100,
  }));

  return (
    <ChartCard title="Expense Breakdown">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- Revenue by Client Bar ---

interface RevenueByClientProps {
  data: Array<{ clientName: string; amount: number; count: number }>;
}

export function RevenueByClient({ data }: RevenueByClientProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Revenue by Client">
        <div className="h-[220px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
          No revenue data for this period
        </div>
      </ChartCard>
    );
  }

  const chartData = data.slice(0, 8).map((d) => ({
    client: d.clientName.length > 15 ? d.clientName.slice(0, 15) + '...' : d.clientName,
    revenue: d.amount,
  }));

  return (
    <ChartCard title="Revenue by Client">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="client" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={100} />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar dataKey="revenue" name="Revenue" fill="var(--accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- KPI Summary Cards ---

interface KpiRowProps {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  workOrderCount: number;
  avgWorkOrderValue: number;
}

export function KpiRow({ totalRevenue, totalExpenses, netIncome, workOrderCount, avgWorkOrderValue }: KpiRowProps) {
  const kpis = [
    { label: 'Revenue', value: formatCurrency(totalRevenue), color: 'text-[var(--accent)]' },
    { label: 'Expenses', value: formatCurrency(totalExpenses), color: 'text-red-500' },
    { label: 'Net Income', value: formatCurrency(netIncome), color: netIncome >= 0 ? 'text-green-500' : 'text-red-500' },
    { label: 'Work Orders', value: String(workOrderCount), color: 'text-[var(--text-primary)]' },
    { label: 'Avg Value', value: formatCurrency(avgWorkOrderValue), color: 'text-[var(--text-primary)]' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">
            {kpi.label}
          </p>
          <p className={`text-lg font-extrabold mt-1 ${kpi.color}`}>
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  );
}
