import { formatCurrency } from '../../lib/utils';
import type { AgingBuckets } from '../../lib/finance';

interface AgingSummaryProps {
  buckets: AgingBuckets;
}

export function AgingSummary({ buckets }: AgingSummaryProps) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)]">
      <span className="text-xs uppercase text-[var(--text-secondary)] tracking-wide block mb-2 sm:hidden">Aging</span>
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6">
        <span className="text-xs uppercase text-[var(--text-secondary)] tracking-wide hidden sm:inline">Aging:</span>
        <span><span style={{ color: 'var(--color-green)' }}>Current:</span> {formatCurrency(buckets.current)}</span>
        <span><span style={{ color: 'var(--color-orange)' }}>1-30 days:</span> {formatCurrency(buckets.days1to30)}</span>
        <span><span style={{ color: 'var(--color-red)' }}>31-60 days:</span> {formatCurrency(buckets.days31to60)}</span>
        <span><span style={{ color: 'var(--color-red)' }}>60+ days:</span> {formatCurrency(buckets.days60plus)}</span>
      </div>
    </div>
  );
}
