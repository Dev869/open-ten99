import { useState, useEffect } from 'react';
import { useReceipts } from '../../hooks/useFirestore';
import type { Receipt } from '../../lib/types';
import ReceiptGrid from '../../components/finance/ReceiptGrid';
import ReceiptDetail from '../../components/finance/ReceiptDetail';
import { uploadReceiptFile } from '../../services/firestore';
import { IconDocument } from '../../components/icons';

export default function Receipts() {
  const { receipts, loading } = useReceipts();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('shared') !== 'true') return;

    (async () => {
      try {
        const cache = await caches.open('share-target');
        const keys = await cache.keys();
        for (const key of keys) {
          const response = await cache.match(key);
          if (!response) continue;
          const blob = await response.blob();
          const fileName = response.headers.get('X-Filename') ?? 'shared-receipt.jpg';
          const file = new File([blob], fileName, { type: blob.type });
          await uploadReceiptFile(file);
        }
        await caches.delete('share-target');
      } catch (err) {
        console.error('Failed to process shared receipts:', err);
      }
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard/finance/receipts');
    })();
  }, []);

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
        <h1 className="hidden md:block text-2xl font-bold text-[var(--text-primary)]">Receipts</h1>
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

      {receipts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4">
            <IconDocument size={32} color="var(--accent)" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1 text-center">No receipts yet</h2>
          <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs">
            Upload or scan receipts to track expenses
          </p>
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
          <div className="relative ml-auto w-full sm:max-w-2xl bg-[var(--bg-card)] shadow-xl">
            <ReceiptDetail
              receipt={currentReceipt}
              onClose={() => setSelectedReceipt(null)}
              onDeleted={() => setSelectedReceipt(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
