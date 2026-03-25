import { IconSparkle } from '../icons';

interface InsightShimmerProps {
  className?: string;
  label?: string;
}

export function InsightShimmer({ className = '', label = 'AI insights updating...' }: InsightShimmerProps) {
  return (
    <div className={`animate-pulse rounded-xl p-4 ${className}`} style={{
      background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
    }}>
      <div className="text-[0.6rem] uppercase tracking-wide text-[var(--text-secondary)] flex items-center gap-1"><IconSparkle size={10} /> {label}</div>
      <div className="mt-2 h-6 w-24 rounded bg-[var(--bg-card)]" />
    </div>
  );
}
