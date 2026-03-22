import { type Utilization } from '../../lib/types';

interface UtilizationGaugeProps {
  utilization: Utilization;
}

export function UtilizationGauge({ utilization }: UtilizationGaugeProps) {
  const pct = Math.round(utilization.currentRate * 100);
  const color = pct >= 80 ? 'var(--color-green)' : pct >= 50 ? 'var(--color-orange)' : 'var(--color-red)';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - utilization.currentRate);

  return (
    <div className="rounded-xl p-4 flex flex-col items-center" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] mb-2">Utilization</div>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          fill="var(--text-primary)" fontSize="20" fontWeight="bold">
          {pct}%
        </text>
      </svg>
      <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
        {utilization.trend === 'up' ? '↑' : utilization.trend === 'down' ? '↓' : '→'}
        {utilization.trend}
      </div>
    </div>
  );
}
