import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type CashFlowProjection } from '../../lib/types';

interface CashFlowChartProps {
  projections: CashFlowProjection[];
}

export function CashFlowChart({ projections }: CashFlowChartProps) {
  if (projections.length === 0) return null;

  return (
    <div className="rounded-xl p-4" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] mb-3">
        Cash Flow Forecast
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={projections}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="inflow" name="Inflow" fill="var(--color-green)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outflow" name="Outflow" fill="var(--color-red)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="netCash" name="Net" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
