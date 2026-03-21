import type { Receipt } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

const STATUS_STYLES: Record<Receipt['status'], { bg: string; text: string; label: string }> = {
  processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processing' },
  unmatched: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Unmatched' },
  matched: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Review Match' },
  confirmed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Confirmed' },
};

interface ReceiptCardProps {
  receipt: Receipt;
  onClick: (receipt: Receipt) => void;
}

export default function ReceiptCard({ receipt, onClick }: ReceiptCardProps) {
  const status = STATUS_STYLES[receipt.status];

  return (
    <button
      className="flex flex-col rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 text-left transition-shadow hover:shadow-lg cursor-pointer"
      onClick={() => onClick(receipt)}
    >
      {/* Rendered extraction preview */}
      <div className="mb-3 flex-1 rounded-lg bg-[var(--bg-page)] p-3 text-xs">
        {receipt.status === 'processing' ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : (
          <>
            <p className="font-bold text-center text-[var(--text-primary)]">
              {receipt.vendor ?? 'Unknown'}
            </p>
            {receipt.lineItems && receipt.lineItems.length > 0 && (
              <div className="mt-2 space-y-0.5 text-[var(--text-secondary)]">
                {receipt.lineItems.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate mr-2">{item.description}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                {receipt.lineItems.length > 3 && (
                  <p className="text-[var(--text-secondary)]/60">
                    +{receipt.lineItems.length - 3} more
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Vendor + amount */}
      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
        {receipt.vendor ?? 'Processing...'}
      </p>
      {receipt.amount != null && (
        <p className="text-sm font-bold text-[var(--accent)]">
          {formatCurrency(receipt.amount)}
        </p>
      )}

      {/* Status badge */}
      <span className={`mt-2 inline-block self-start rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
        {status.label}
      </span>
    </button>
  );
}
