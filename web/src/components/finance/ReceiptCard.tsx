import type { Receipt } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

const STATUS_STYLES: Record<Receipt['status'], { bg: string; text: string; label: string }> = {
  processing: { bg: 'bg-[var(--accent)]/15', text: 'text-[var(--accent)]', label: 'Processing' },
  unmatched: { bg: 'bg-[var(--color-red)]/15', text: 'text-[var(--color-red)]', label: 'Unmatched' },
  matched: { bg: 'bg-[var(--color-orange)]/15', text: 'text-[var(--color-orange)]', label: 'Review' },
  confirmed: { bg: 'bg-[var(--color-green)]/15', text: 'text-[var(--color-green)]', label: 'Confirmed' },
};

interface ReceiptCardProps {
  receipt: Receipt;
  onClick: (receipt: Receipt) => void;
}

const FALLBACK_STYLE = { bg: 'bg-[var(--color-gray)]/15', text: 'text-[var(--color-gray)]', label: 'Unknown' };

export default function ReceiptCard({ receipt, onClick }: ReceiptCardProps) {
  const status = STATUS_STYLES[receipt.status] ?? FALLBACK_STYLE;

  return (
    <button
      className="flex flex-col rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 min-h-[160px] text-left transition-all hover:shadow-md hover:border-[var(--accent)]/30 active:scale-[0.98] cursor-pointer"
      onClick={() => onClick(receipt)}
    >
      {/* Preview area */}
      <div className="flex-1 w-full rounded-lg bg-[var(--bg-page)] p-2.5 mb-3 text-[11px]">
        {receipt.status === 'processing' ? (
          <div className="flex h-full items-center justify-center min-h-[48px]">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : (
          <>
            <p className="font-bold text-center text-[var(--text-primary)] truncate">
              {receipt.vendor ?? 'Unknown'}
            </p>
            {receipt.lineItems && receipt.lineItems.length > 0 && (
              <div className="mt-1.5 space-y-0.5 text-[var(--text-secondary)]">
                {receipt.lineItems.slice(0, 2).map((item, i) => (
                  <div key={i} className="flex justify-between gap-1">
                    <span className="truncate">{item.description}</span>
                    <span className="flex-shrink-0">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                {receipt.lineItems.length > 2 && (
                  <p className="text-[var(--text-secondary)]/50 text-[10px]">
                    +{receipt.lineItems.length - 2} more
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
        {receipt.vendor ?? 'Processing...'}
      </p>
      <div className="flex items-center justify-between mt-1 w-full">
        {receipt.amount != null && (
          <span className="text-xs font-bold text-[var(--accent)]">
            {formatCurrency(receipt.amount)}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>
    </button>
  );
}
