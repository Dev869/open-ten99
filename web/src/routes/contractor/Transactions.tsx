import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction, ConnectedAccount } from '../../lib/types';
import { useConnectedAccounts } from '../../hooks/useFirestore';
import { fetchTransactions, updateTransactionCategory } from '../../services/firestore';
import { TransactionRow } from '../../components/finance/TransactionRow';
import { formatDate } from '../../lib/utils';
import type { DocumentSnapshot } from 'firebase/firestore';

const PAGE_SIZE = 50;

function AccountStatusDot({ status }: { status: ConnectedAccount['status'] }) {
  const colors: Record<ConnectedAccount['status'], string> = {
    active: 'bg-green-500',
    error: 'bg-red-500',
    disconnected: 'bg-gray-400',
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status]} flex-shrink-0`}
      aria-label={status}
    />
  );
}

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

export default function Transactions() {
  const { accounts, loading: accountsLoading } = useConnectedAccounts();

  // Filter state
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  // Pagination state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setTransactions([]);
    setLastDoc(null);
    setHasMore(true);

    const result = await fetchTransactions({
      pageSize: PAGE_SIZE,
      accountId: filterAccountId || undefined,
      type: filterType || undefined,
    });

    setTransactions(result.transactions);
    setLastDoc(result.lastDoc);
    setHasMore(result.hasMore);
    setLoading(false);
  }, [filterAccountId, filterType]);

  // Reload whenever filters change
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function loadMore() {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);

    const result = await fetchTransactions({
      pageSize: PAGE_SIZE,
      afterDoc: lastDoc,
      accountId: filterAccountId || undefined,
      type: filterType || undefined,
    });

    setTransactions((prev) => [...prev, ...result.transactions]);
    setLastDoc(result.lastDoc);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  }

  function handleCategoryChange(id: string, category: string) {
    // Optimistic update
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category } : t))
    );
    // Persist to Firestore (fire-and-forget; errors are logged in the service)
    updateTransactionCategory(id, category).catch((err) => {
      console.error('Failed to update category:', err);
    });
  }

  function handleFilterAccountChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilterAccountId(e.target.value);
  }

  function handleFilterTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilterType(e.target.value);
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Transactions
        </h1>
      </div>

      {/* Connected Accounts Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-3 mb-4 flex items-center gap-4 flex-wrap">
        {accountsLoading ? (
          <div className="h-4 w-48 bg-[var(--border)] rounded animate-pulse" />
        ) : accounts.length === 0 ? (
          <span className="text-sm text-[var(--text-secondary)]">No accounts connected.</span>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-2 text-sm">
              <AccountStatusDot status={account.status} />
              <span className="font-medium text-[var(--text-primary)]">{account.accountName}</span>
              <span className="text-[var(--text-secondary)]">·</span>
              <span className="text-[var(--text-secondary)]">{account.institutionName}</span>
              {account.lastSyncedAt && (
                <>
                  <span className="text-[var(--text-secondary)]">·</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Synced {formatDate(account.lastSyncedAt)}
                  </span>
                </>
              )}
            </div>
          ))
        )}
        <Link
          to="/dashboard/finance/accounts"
          className="ml-auto text-sm font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
        >
          + Connect Account
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterAccountId}
          onChange={handleFilterAccountChange}
          className="text-sm px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          aria-label="Filter by account"
        >
          <option value="">All Accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.accountName}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={handleFilterTypeChange}
          className="text-sm px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      {/* Transaction Table */}
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
                Source
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
                Amount
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
                Category
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton rows on initial load
              [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--text-secondary)] text-sm">
                  No transactions found.
                  {(filterAccountId || filterType) && (
                    <span> Try adjusting your filters.</span>
                  )}
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  accounts={accounts}
                  onCategoryChange={handleCategoryChange}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {!loading && hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 text-sm font-medium rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
