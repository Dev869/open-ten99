import { useState } from 'react';
import { useReceipts } from '../../hooks/useFirestore';
import type { Receipt } from '../../lib/types';
import ReceiptGrid from '../../components/finance/ReceiptGrid';
import ReceiptDetail from '../../components/finance/ReceiptDetail';

export default function Receipts() {
  const { receipts, loading } = useReceipts();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep selected receipt in sync with real-time data
  const currentReceipt = selectedReceipt
    ? receipts.find((r) => r.id === selectedReceipt.id) ?? selectedReceipt
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Receipts</h1>
        <div className="flex gap-2 text-xs text-[var(--text-secondary)]">
          <span>{receipts.filter((r) => r.status === 'unmatched').length} unmatched</span>
          <span>·</span>
          <span>{receipts.filter((r) => r.status === 'matched').length} to review</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <ReceiptGrid
        receipts={receipts}
        onReceiptClick={setSelectedReceipt}
        onUploadError={setError}
      />

      {/* Detail slide-over */}
      {currentReceipt && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedReceipt(null)} />
          <div className="relative ml-auto w-full max-w-2xl bg-[var(--bg-card)] shadow-xl">
            <ReceiptDetail
              receipt={currentReceipt}
              onClose={() => setSelectedReceipt(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
