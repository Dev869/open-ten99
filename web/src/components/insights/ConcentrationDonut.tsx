import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type ClientScore } from '../../lib/types';
import { IconSparkle } from '../icons';

interface ConcentrationDonutProps {
  scores: ClientScore[];
}

const COLORS = [
  'var(--accent)',
  'var(--color-green)',
  'var(--color-orange)',
  'var(--color-red)',
  'var(--text-secondary)',
];

export function ConcentrationDonut({ scores }: ConcentrationDonutProps) {
  if (scores.length === 0) return null;

  const data = scores.map((s) => ({
    name: s.clientName,
    value: Math.round(s.revenueShare * 100),
  }));

  return (
    <div className="rounded-xl p-4" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] mb-3 flex items-center gap-1">
        <IconSparkle size={10} /> Revenue Concentration
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
