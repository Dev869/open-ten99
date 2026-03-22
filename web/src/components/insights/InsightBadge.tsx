import { type RiskLevel } from '../../lib/types';
import { IconSparkle } from '../icons';

interface InsightBadgeProps {
  label: string;
  level: RiskLevel | 'info' | 'warning' | 'deductible';
  tooltip?: string;
}

const levelColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'var(--color-green)', text: 'var(--color-green)' },
  medium: { bg: 'var(--color-orange)', text: 'var(--color-orange)' },
  high: { bg: 'var(--color-red)', text: 'var(--color-red)' },
  info: { bg: 'var(--accent)', text: 'var(--accent)' },
  warning: { bg: 'var(--color-orange)', text: 'var(--color-orange)' },
  deductible: { bg: 'var(--color-green)', text: 'var(--color-green)' },
};

export function InsightBadge({ label, level, tooltip }: InsightBadgeProps) {
  const colors = levelColors[level] ?? levelColors.info;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium"
      style={{
        background: `color-mix(in srgb, ${colors.bg} 15%, transparent)`,
        color: colors.text,
      }}
      title={tooltip}
    >
      <IconSparkle size={10} />
      {label}
    </span>
  );
}
