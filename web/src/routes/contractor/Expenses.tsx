import { useState, useEffect, useMemo } from 'react';
import type { Transaction, ExpenseAnomaly, CategoryTrend } from '../../lib/types';
import { EXPENSE_CATEGORIES } from '../../lib/types';
import { fetchTransactions, createManualExpense, reassignReceipt } from '../../services/firestore';
import { useInsights } from '../../hooks/useFirestore';
import { InsightBadge } from '../../components/insights/InsightBadge';
import { ExpenseForm } from '../../components/finance/ExpenseForm';
import ReceiptBadge from '../../components/finance/ReceiptBadge';
import { DateRangeSelector } from '../../components/finance/DateRangeSelector';
import { getDateRange } from '../../lib/finance';
import type { DateRangePreset } from '../../lib/finance';
import { formatCurrency, formatDate, sanitizeUrl } from '../../lib/utils';
import { IconBook } from '../../components/icons';

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border)]">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[var(--border)] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCategoryCard() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 animate-pulse">
      <div className="h-3 w-3/4 bg-[var(--border)] rounded mb-2" />
      <div className="h-5 w-1/2 bg-[var(--border)] rounded" />
    </div>
  );
}

// ── Category Summary ──────────────────────────────────────────────────────────

interface CategoryTotal {
  category: string;
  total: number;
}

function CategorySummary({ expenses, loading, categoryTrends }: { expenses: Transaction[]; loading: boolean; categoryTrends?: CategoryTrend[] }) {
  const totals: CategoryTotal[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) {
      const key = expense.category || 'Uncategorized';
      map.set(key, (map.get(key) ?? 0) + Math.abs(expense.amount));
    }
    // Preserve EXPENSE_CATEGORIES ordering, then any uncategorized at end
    const ordered: CategoryTotal[] = [];
    for (const cat of EXPENSE_CATEGORIES) {
      if (map.has(cat)) {
        ordered.push({ category: cat, total: map.get(cat)! });
      }
    }
    // Any categories not in EXPENSE_CATEGORIES list
    for (const [category, total] of map.entries()) {
      const inList = (EXPENSE_CATEGORIES as readonly string[]).includes(category);
      if (!inList) {
        ordered.push({ category, total });
      }
    }
    return ordered;
  }, [expenses]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <SkeletonCategoryCard key={i} />)}
      </div>
    );
  }

  if (totals.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)] py-2">
        No expenses in this period.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {totals.map(({ category, total }) => {
        const trend = categoryTrends?.find((t) => t.category === category);
        return (
          <div
            key={category}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3"
          >
            <p className="text-xs text-[var(--text-secondary)] leading-tight mb-1 truncate" title={category}>
              {category}
            </p>
            <p className="text-base font-bold text-[var(--text-primary)] flex items-center gap-1">
              {formatCurrency(total)}
              {trend && (
                <span className="text-xs" style={{
                  color: trend.trend === 'up' ? 'var(--color-red)' : trend.trend === 'down' ? 'var(--color-green)' : 'var(--text-secondary)'
                }}>
                  {trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→'} {Math.abs(trend.percentChange)}%
                </span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Expense Row ───────────────────────────────────────────────────────────────

function ExpenseRow({ expense, anomaly }: { expense: Transaction; anomaly?: ExpenseAnomaly }) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-card)] transition-colors">
      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)]">
        {formatDate(expense.date)}
      </td>

      {/* Description */}
      <td className="px-4 py-3 text-sm text-[var(--text-primary)] max-w-xs">
        <span className="inline-flex items-center gap-1 flex-wrap max-w-full">
          <span className="truncate">{expense.description}</span>
          {anomaly && (
            <InsightBadge
              label={anomaly.severity === 'warning' ? 'Anomaly' : 'Note'}
              level={anomaly.severity}
              tooltip={anomaly.reason}
            />
          )}
        </span>
      </td>

      {/* Category */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-page)] border border-[var(--border)] text-[var(--text-secondary)]">
          {expense.category || 'Uncategorized'}
        </span>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-right text-sm font-semibold text-red-500 whitespace-nowrap">
        -{formatCurrency(Math.abs(expense.amount))}
      </td>

      {/* Badges + Receipt */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {expense.isManual && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
              Manual
            </span>
          )}
          {expense.receiptIds && expense.receiptIds.length > 0 ? (
            <ReceiptBadge status="confirmed" />
          ) : expense.receiptUrl && sanitizeUrl(expense.receiptUrl) ? (
            <a
              href={sanitizeUrl(expense.receiptUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
            >
              View Receipt
            </a>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Expenses() {
  const [preset, setPreset] = useState<DateRangePreset>('ytd');
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { insights } = useInsights();

  const range = useMemo(() => getDateRange(preset), [preset]);

  // Fetch expenses on mount and when range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTransactions({ type: 'expense', dateFrom: range.start, dateTo: range.end })
      .then((result) => {
        if (!cancelled) {
          setExpenses(result.transactions);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [range]);

  async function handleExpenseSubmit(data: {
    description: string;
    amount: number;
    category: string;
    date: Date;
    taxDeductible: boolean;
    receiptUrl?: string;
    receiptId?: string;
  }) {
    setFormLoading(true);
    try {
      const transactionId = await createManualExpense(data);
      // Link the receipt document to the new transaction if one was uploaded
      if (data.receiptId) {
        await reassignReceipt(data.receiptId, undefined, transactionId);
      }
      // Refetch to include the new expense
      const result = await fetchTransactions({ type: 'expense', dateFrom: range.start, dateTo: range.end });
      setExpenses(result.transactions);
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="hidden md:block text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Expenses
        </h1>
        <DateRangeSelector value={preset} onChange={setPreset} />
      </div>

      {/* Add Expense Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg mb-6 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-page)] transition-colors"
        >
          <span className="text-sm font-semibold text-[var(--text-primary)]">Add Expense</span>
          <span className="text-[var(--text-secondary)] text-lg leading-none select-none">
            {showForm ? '−' : '+'}
          </span>
        </button>
        {showForm && (
          <div className="px-4 pb-4 pt-1 border-t border-[var(--border)]">
            <ExpenseForm onSubmit={handleExpenseSubmit} loading={formLoading} />
          </div>
        )}
      </div>

      {/* Category Summary */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          By Category
        </h2>
        <CategorySummary expenses={expenses} loading={loading} categoryTrends={insights?.expenses?.categoryTrends} />
      </div>

      {/* Expense List */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          All Expenses
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-card)] border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
                  Description
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
                  Category
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
                  Amount
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-0">
                    <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4">
                      <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4">
                        <IconBook size={32} color="var(--accent)" />
                      </div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1 text-center">No expenses tracked</h2>
                      <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs mb-6">
                        Add expenses to track your business costs
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="px-6 py-3 min-h-[44px] bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:brightness-90 transition-all"
                      >
                        + Add Expense
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => {
                  const anomaly = insights?.expenses?.anomalies?.find((a) => a.transactionId === expense.id);
                  return <ExpenseRow key={expense.id} expense={expense} anomaly={anomaly} />;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
