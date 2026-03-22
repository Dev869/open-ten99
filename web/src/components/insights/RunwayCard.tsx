import { type RunwayEstimate } from '../../lib/types';
import { IconSparkle } from '../icons';

interface RunwayCardProps {
  runway: RunwayEstimate;
}

const statusColors: Record<string, string> = {
  comfortable: 'var(--color-green)',
  caution: 'var(--color-orange)',
  critical: 'var(--color-red)',
};

export function RunwayCard({ runway }: RunwayCardProps) {
  const color = statusColors[runway.status] ?? 'var(--accent)';

  return (
    <div className="rounded-xl p-4" style={{
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] flex items-center gap-1"><IconSparkle size={10} /> Cash Runway</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>
        {runway.months} mo
      </div>
      <div className="text-xs mt-0.5 text-[var(--text-secondary)]">{runway.status}</div>
    </div>
  );
}
