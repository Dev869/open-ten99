import { formatCurrency } from '../../lib/utils';

interface KpiCardProps {
  label: React.ReactNode;
  value: number;
  trend?: number;
  subtitle?: string;
  color: 'green' | 'orange' | 'red' | 'accent';
}

const colorMap = {
  green: { bg: 'var(--color-green)', text: 'var(--color-green)' },
  orange: { bg: 'var(--color-orange)', text: 'var(--color-orange)' },
  red: { bg: 'var(--color-red)', text: 'var(--color-red)' },
  accent: { bg: 'var(--accent)', text: 'var(--accent)' },
};

export function KpiCard({ label, value, trend, subtitle, color }: KpiCardProps) {
  const colors = colorMap[color];
  return (
    <div
      className="rounded-xl p-3 md:p-4 overflow-hidden min-w-0"
      style={{ background: `color-mix(in srgb, ${colors.bg} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${colors.bg} 25%, transparent)` }}
    >
      <div className="text-[0.6rem] md:text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] truncate">{label}</div>
      <div className="text-lg md:text-2xl font-bold mt-1 tabular-nums truncate" style={{ color: colors.text }}>{formatCurrency(value)}</div>
      {trend != null && (
        <div className="text-[10px] md:text-xs mt-0.5 truncate" style={{ color: trend >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
        </div>
      )}
      {subtitle && <div className="text-[10px] md:text-xs mt-0.5 text-[var(--text-secondary)] truncate">{subtitle}</div>}
    </div>
  );
}
