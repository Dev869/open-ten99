import { formatCurrency } from '../../lib/utils';

interface KpiCardProps {
  label: string;
  value: number;
  trend?: number;
  subtitle?: string;
  color: 'green' | 'orange' | 'red' | 'accent';
}

const colorMap = {
  green: { bg: 'rgba(90, 154, 90, 0.1)', border: 'rgba(90, 154, 90, 0.25)', text: '#5A9A5A' },
  orange: { bg: 'rgba(212, 135, 62, 0.1)', border: 'rgba(212, 135, 62, 0.25)', text: '#D4873E' },
  red: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', text: '#ef4444' },
  accent: { bg: 'rgba(75, 168, 168, 0.1)', border: 'rgba(75, 168, 168, 0.25)', text: 'var(--accent)' },
};

export function KpiCard({ label, value, trend, subtitle, color }: KpiCardProps) {
  const colors = colorMap[color];
  return (
    <div className="rounded-xl p-4" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: colors.text }}>{formatCurrency(value)}</div>
      {trend != null && (
        <div className="text-xs mt-0.5" style={{ color: trend >= 0 ? '#5A9A5A' : '#ef4444' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </div>
      )}
      {subtitle && <div className="text-xs mt-0.5 text-[var(--text-secondary)]">{subtitle}</div>}
    </div>
  );
}
