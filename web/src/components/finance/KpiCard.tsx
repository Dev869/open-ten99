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
    <div className="rounded-xl p-4" style={{ background: `color-mix(in srgb, ${colors.bg} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${colors.bg} 25%, transparent)` }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: colors.text }}>{formatCurrency(value)}</div>
      {trend != null && (
        <div className="text-xs mt-0.5" style={{ color: trend >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </div>
      )}
      {subtitle && <div className="text-xs mt-0.5 text-[var(--text-secondary)]">{subtitle}</div>}
    </div>
  );
}
