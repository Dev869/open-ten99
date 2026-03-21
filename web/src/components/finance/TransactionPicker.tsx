import { useState, useEffect, useMemo } from 'react';
import type { Transaction, Receipt } from '../../lib/types';
import { fetchTransactions } from '../../services/firestore';
import { computeReceiptMatchScoreClient } from '../../lib/receiptMatchClient';
import { formatCurrency, formatDate } from '../../lib/utils';

interface TransactionPickerProps {
  receipt: Receipt;
  onSelect: (transactionId: string) => void;
  onCreateExpense: () => void;
  onClose: () => void;
}

export default function TransactionPicker({ receipt, onSelect, onCreateExpense, onClose }: TransactionPickerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions({ type: 'expense' })
      .then(({ transactions: txs }) => {
        setTransactions(txs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const scored = useMemo(() => {
    return transactions.map((tx) => ({
      tx,
      score: computeReceiptMatchScoreClient(receipt, tx),
    }));
  }, [transactions, receipt]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? scored.filter(({ tx }) =>
          tx.description.toLowerCase().includes(q) ||
          Math.abs(tx.amount).toString().includes(q)
        )
      : scored;
    return list.sort((a, b) => b.score - a.score);
  }, [scored, search]);

  const suggested = filtered.filter(({ score }) => score >= 0.3);
  const rest = filtered.filter(({ score }) => score < 0.3);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="font-semibold text-[var(--text-primary)]">Assign to Transaction</h3>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          &times;
        </button>
      </div>

      <div className="p-4">
        <input
          type="text"
          placeholder="Search by vendor, amount..."
          className="w-full rounded-lg bg-[var(--bg-page)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading transactions...</p>
        ) : (
          <>
            {suggested.length > 0 && (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Suggested Matches
                </p>
                {suggested.map(({ tx, score }) => (
                  <button
                    key={tx.id}
                    className="mb-2 w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border)] p-3 text-left hover:border-[var(--accent)] transition-colors cursor-pointer"
                    onClick={() => onSelect(tx.id)}
                  >
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{tx.description}</span>
                      <span className="text-sm font-bold text-[var(--accent)]">{formatCurrency(Math.abs(tx.amount))}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-[var(--text-secondary)]">{formatDate(tx.date)}</span>
                      <span className="text-xs text-yellow-400">{Math.round(score * 100)}%</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {rest.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  All Transactions
                </p>
                {rest.map(({ tx }) => (
                  <button
                    key={tx.id}
                    className="mb-2 w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border)] p-3 text-left hover:border-[var(--accent)] transition-colors cursor-pointer"
                    onClick={() => onSelect(tx.id)}
                  >
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{tx.description}</span>
                      <span className="text-sm font-bold text-[var(--accent)]">{formatCurrency(Math.abs(tx.amount))}</span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">{formatDate(tx.date)}</span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        <button
          className="w-full rounded-lg bg-[var(--bg-page)] border border-[var(--border)] py-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          onClick={onCreateExpense}
        >
          No match — Create Manual Expense
        </button>
      </div>
    </div>
  );
}
