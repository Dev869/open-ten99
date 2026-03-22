import { useState, useEffect } from 'react';
import type { Receipt, Transaction } from '../../lib/types';
import { confirmReceiptMatch, reassignReceipt, createExpenseFromReceipt, fetchTransactions, deleteReceipt } from '../../services/firestore';
import { formatCurrency, formatDate } from '../../lib/utils';
import TransactionPicker from './TransactionPicker';

interface ReceiptDetailProps {
  receipt: Receipt;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function ReceiptDetail({ receipt, onClose, onDeleted }: ReceiptDetailProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [matchedTx, setMatchedTx] = useState<Transaction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    if (receipt.transactionId) {
      fetchTransactions({ type: 'expense' }).then(({ transactions }) => {
        const tx = transactions.find((t) => t.id === receipt.transactionId);
        if (tx) setMatchedTx(tx);
      });
    }
  }, [receipt.transactionId]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await confirmReceiptMatch(receipt.id);
    } finally {
      setConfirming(false);
    }
  };

  const handleReassign = async (newTxId: string) => {
    await reassignReceipt(receipt.id, receipt.transactionId, newTxId);
    setShowPicker(false);
  };

  const handleCreateExpense = async () => {
    await createExpenseFromReceipt(receipt.id, receipt);
    setShowPicker(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this receipt? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteReceipt(receipt.id, receipt.imageUrl);
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  };

  if (showPicker) {
    return (
      <TransactionPicker
        receipt={receipt}
        onSelect={handleReassign}
        onCreateExpense={handleCreateExpense}
        onClose={() => setShowPicker(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="font-semibold text-[var(--text-primary)]">Receipt Detail</h3>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          &times;
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1">
        {/* Left: Rendered extraction */}
        <div className="flex-1 p-4 border-b lg:border-b-0 lg:border-r border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Receipt</p>
            <button
              className="text-xs text-[var(--accent)] hover:underline"
              onClick={() => setShowImage(!showImage)}
            >
              {showImage ? 'Show Extraction' : 'Show Original'}
            </button>
          </div>

          {showImage ? (
            <img
              src={receipt.imageUrl}
              alt="Receipt"
              className="w-full rounded-lg border border-[var(--border)]"
            />
          ) : (
            <div className="rounded-lg bg-[var(--bg-page)] p-4 font-mono text-xs leading-relaxed">
              <p className="text-center font-bold text-sm text-[var(--text-primary)]">
                {receipt.vendor ?? 'Unknown Vendor'}
              </p>
              {receipt.date && (
                <p className="text-center text-[var(--text-secondary)] mt-1">
                  {formatDate(receipt.date)}
                </p>
              )}

              {receipt.lineItems && receipt.lineItems.length > 0 && (
                <div className="mt-3 border-t border-dashed border-[var(--border)] pt-2 space-y-1">
                  {receipt.lineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-[var(--text-primary)]">
                      <span className="truncate mr-2">{item.description}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {receipt.amount != null && (
                <div className="mt-2 border-t border-dashed border-[var(--border)] pt-2">
                  <div className="flex justify-between font-bold text-sm text-[var(--text-primary)]">
                    <span>TOTAL</span>
                    <span>{formatCurrency(receipt.amount)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Extracted data + match */}
        <div className="flex-1 p-4">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Vendor</p>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              {receipt.vendor ?? 'Unknown'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Amount</p>
              <p className="text-base font-bold text-[var(--accent)]">
                {receipt.amount != null ? formatCurrency(receipt.amount) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Date</p>
              <p className="text-base text-[var(--text-primary)]">
                {receipt.date ? formatDate(receipt.date) : '—'}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Category</p>
            <p className="text-sm text-[var(--text-primary)]">
              {receipt.category ?? 'Uncategorized'}
            </p>
          </div>

          {(receipt.status === 'matched' || receipt.status === 'confirmed') && matchedTx && (
            <div className="border-t border-[var(--border)] pt-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Matched Transaction
                </p>
                {receipt.matchConfidence != null && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                    {Math.round(receipt.matchConfidence * 100)}% match
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-[var(--bg-page)] border border-[var(--border)] p-3">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{matchedTx.description}</span>
                  <span className="text-sm font-bold text-[var(--accent)]">
                    {formatCurrency(Math.abs(matchedTx.amount))}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {formatDate(matchedTx.date)}
                </p>
              </div>
            </div>
          )}

          {receipt.status === 'unmatched' && (
            <div className="border-t border-[var(--border)] pt-4 mb-4">
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                No Match Found
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Assign to a transaction or create a manual expense.
              </p>
            </div>
          )}

          {receipt.status !== 'processing' && receipt.status !== 'confirmed' && (
            <div className="flex gap-2 mt-4">
              {receipt.status === 'matched' && (
                <button
                  className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  onClick={handleConfirm}
                  disabled={confirming}
                >
                  {confirming ? 'Confirming...' : 'Confirm Match'}
                </button>
              )}
              <button
                className="flex-1 rounded-lg bg-[var(--bg-page)] border border-[var(--border)] py-2.5 text-sm text-[var(--text-primary)] hover:border-[var(--accent)]"
                onClick={() => setShowPicker(true)}
              >
                {receipt.status === 'unmatched' ? 'Assign Transaction' : 'Reassign'}
              </button>
            </div>
          )}

          <button
            className="w-full mt-3 rounded-lg border border-red-500/30 py-2.5 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
