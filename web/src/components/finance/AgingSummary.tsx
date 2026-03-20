import { formatCurrency } from '../../lib/utils';
import type { AgingBuckets } from '../../lib/finance';

interface AgingSummaryProps {
  buckets: AgingBuckets;
}

export function AgingSummary({ buckets }: AgingSummaryProps) {
  return (
    <div className="flex items-center gap-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm">
      <span className="text-xs uppercase text-[var(--text-secondary)] tracking-wide">Aging:</span>
      <span><span className="text-[#5A9A5A]">Current:</span> {formatCurrency(buckets.current)}</span>
      <span><span className="text-[#D4873E]">1-30 days:</span> {formatCurrency(buckets.days1to30)}</span>
      <span><span className="text-[#ef4444]">31-60 days:</span> {formatCurrency(buckets.days31to60)}</span>
      <span><span className="text-[#ef4444]">60+ days:</span> {formatCurrency(buckets.days60plus)}</span>
    </div>
  );
}
