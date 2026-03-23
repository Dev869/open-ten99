import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import type { Transaction, ConnectedAccount } from '../../lib/types';
import { useConnectedAccounts, useInsights } from '../../hooks/useFirestore';
import { fetchTransactions, updateTransactionCategory, confirmMatch, rejectMatch } from '../../services/firestore';
import { InsightBadge } from '../../components/insights/InsightBadge';
import { TransactionRow } from '../../components/finance/TransactionRow';
import { MatchSuggestion } from '../../components/finance/MatchSuggestion';
import { CsvImportModal } from '../../components/finance/CsvImportModal';
import { formatDate } from '../../lib/utils';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import type { DocumentSnapshot } from 'firebase/firestore';
import { IconRepeat } from '../../components/icons';

const PAGE_SIZE = 50;

interface PageState {
  transactions: Transaction[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  loading: boolean;
}

const INITIAL_PAGE_STATE: PageState = {
  transactions: [],
  lastDoc: null,
  hasMore: false,
  loading: true,
};

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
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[var(--border)] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function Transactions() {
  const { accounts, loading: accountsLoading } = useConnectedAccounts();
  const { insights } = useInsights();

  // Filter state
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  // Pagination state — combined into one object to allow atomic resets
  const [page, setPage] = useState<PageState>(INITIAL_PAGE_STATE);

  // Smart sort state
  const [smartSorting, setSmartSorting] = useState(false);
  const [smartSortResult, setSmartSortResult] = useState<string | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Match suggestion state
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchedWorkItems, setMatchedWorkItems] = useState<Map<string, { subject: string; totalCost: number }>>(new Map());

  // Convenience aliases
  const { transactions, lastDoc, hasMore, loading } = page;

  // Reload whenever filters change — with cleanup to prevent state updates after unmount
  useEffect(() => {
    let cancelled = false;

    setPage(INITIAL_PAGE_STATE);

    fetchTransactions({
      pageSize: PAGE_SIZE,
      accountId: filterAccountId || undefined,
      type: filterType || undefined,
    }).then((result) => {
      if (!cancelled) {
        setPage({
          transactions: result.transactions,
          lastDoc: result.lastDoc,
          hasMore: result.hasMore,
          loading: false,
        });
      }
    });

    return () => { cancelled = true; };
  }, [filterAccountId, filterType]);

  async function loadMore() {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);

    const result = await fetchTransactions({
      pageSize: PAGE_SIZE,
      afterDoc: lastDoc,
      accountId: filterAccountId || undefined,
      type: filterType || undefined,
    });

    setPage((prev) => ({
      transactions: [...prev.transactions, ...result.transactions],
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
      loading: false,
    }));
    setLoadingMore(false);
  }

  function handleCategoryChange(id: string, category: string) {
    // Optimistic update
    setPage((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === id ? { ...t, category } : t)),
    }));
    // Persist to Firestore (fire-and-forget; errors are logged in the service)
    updateTransactionCategory(id, category).catch((err) => {
      console.error('Failed to update category:', err);
    });
  }

  async function handleSmartSort() {
    setSmartSorting(true);
    setSmartSortResult(null);
    try {
      const fn = httpsCallable<Record<string, never>, { categorized: number; total: number; message: string }>(
        functions,
        'onSmartCategorize'
      );
      const result = await fn({});
      setSmartSortResult(result.data.message);
      // Refetch to show updated categories
      const refreshed = await fetchTransactions({
        pageSize: PAGE_SIZE,
        accountId: filterAccountId || undefined,
        type: filterType || undefined,
      });
      setPage({
        transactions: refreshed.transactions,
        lastDoc: refreshed.lastDoc,
        hasMore: refreshed.hasMore,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Smart sort failed';
      setSmartSortResult(message);
    } finally {
      setSmartSorting(false);
    }
  }

  function handleFilterAccountChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilterAccountId(e.target.value);
  }

  function handleFilterTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilterType(e.target.value);
  }

  async function handleRowClick(transactionId: string) {
    // Toggle collapse
    if (expandedMatch === transactionId) {
      setExpandedMatch(null);
      return;
    }

    setExpandedMatch(transactionId);

    // Fetch work item info if not already cached
    const transaction = page.transactions.find((t) => t.id === transactionId);
    const workItemId = transaction?.matchedWorkItemId;
    if (!workItemId || matchedWorkItems.has(workItemId)) return;

    try {
      const snap = await getDoc(doc(db, 'workItems', workItemId));
      if (snap.exists()) {
        const data = snap.data();
        setMatchedWorkItems((prev) => {
          const next = new Map(prev);
          next.set(workItemId, {
            subject: (data.subject as string) ?? 'Work Order',
            totalCost: (data.totalCost as number) ?? 0,
          });
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to fetch work item for match suggestion:', err);
    }
  }

  async function handleConfirmMatch(transactionId: string, workItemId: string) {
    setMatchLoading(true);
    try {
      await confirmMatch(transactionId, workItemId);
      setPage((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === transactionId
            ? { ...t, matchStatus: 'confirmed', matchedWorkItemId: workItemId }
            : t,
        ),
      }));
      setExpandedMatch(null);
    } catch (err) {
      console.error('Failed to confirm match:', err);
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleRejectMatch(transactionId: string) {
    setMatchLoading(true);
    try {
      await rejectMatch(transactionId);
      setPage((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === transactionId
            ? { ...t, matchStatus: 'rejected', matchedWorkItemId: undefined }
            : t,
        ),
      }));
      setExpandedMatch(null);
    } catch (err) {
      console.error('Failed to reject match:', err);
    } finally {
      setMatchLoading(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="hidden md:block text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Transactions
        </h1>
        <button
          onClick={handleSmartSort}
          disabled={smartSorting || transactions.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {smartSorting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sorting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v4M5.5 3.5L8 1l2.5 2.5M2 8h12M5.5 12.5L8 15l2.5-2.5M8 11v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Smart Sort
            </>
          )}
        </button>
        <button
          onClick={() => setShowCsvImport(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V2M5 5l3-3 3 3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Import CSV
        </button>
      </div>

      {/* Smart sort result */}
      {smartSortResult && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-sm text-[var(--text-primary)] flex items-center justify-between">
          <span>{smartSortResult}</span>
          <button onClick={() => setSmartSortResult(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}

      {/* Connected Accounts Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          {accountsLoading ? (
            <div className="h-4 w-48 bg-[var(--border)] rounded animate-pulse" />
          ) : accounts.length === 0 ? (
            <span className="text-sm text-[var(--text-secondary)]">No accounts connected.</span>
          ) : (
            accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-2 text-sm min-w-0">
                <AccountStatusDot status={account.status} />
                <span className="font-medium text-[var(--text-primary)] truncate">{account.accountName}</span>
                <span className="text-[var(--text-secondary)] hidden sm:inline">·</span>
                <span className="text-[var(--text-secondary)] truncate hidden sm:inline">{account.institutionName}</span>
                {account.lastSyncedAt && (
                  <>
                    <span className="text-[var(--text-secondary)] hidden sm:inline">·</span>
                    <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
                      Synced {formatDate(account.lastSyncedAt)}
                    </span>
                  </>
                )}
              </div>
            ))
          )}
          <Link
            to="/dashboard/finance/accounts"
            className="sm:ml-auto text-sm font-medium text-[var(--accent)] hover:underline whitespace-nowrap min-h-[44px] flex items-center"
          >
            + Connect Account
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterAccountId}
          onChange={handleFilterAccountChange}
          className="text-sm px-3 py-2 min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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
          className="text-sm px-3 py-2 min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto scrollbar-hide rounded-lg border border-[var(--border)]">
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
              <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
                Receipt
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton rows on initial load
              [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-0">
                  <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4">
                      <IconRepeat size={32} color="var(--accent)" />
                    </div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1 text-center">No transactions yet</h2>
                    <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs mb-6">
                      {filterAccountId || filterType
                        ? 'Try adjusting your filters.'
                        : 'Connect a bank account or import transactions to get started'}
                    </p>
                    {!(filterAccountId || filterType) && (
                      <button
                        onClick={() => setShowCsvImport(true)}
                        className="px-6 py-3 min-h-[44px] bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:brightness-90 transition-all"
                      >
                        Import CSV
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const workItemId = transaction.matchedWorkItemId;
                const cachedWorkItem = workItemId ? matchedWorkItems.get(workItemId) : undefined;
                const showSuggestion =
                  expandedMatch === transaction.id &&
                  transaction.matchStatus === 'suggested' &&
                  workItemId &&
                  cachedWorkItem;

                const deduction = insights?.tax?.missedDeductions?.find((d) => d.transactionId === transaction.id);

                return (
                  <>
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      accounts={accounts}
                      onCategoryChange={handleCategoryChange}
                      onRowClick={handleRowClick}
                      insightBadge={deduction ? (
                        <InsightBadge
                          label="Deductible"
                          level="deductible"
                          tooltip={`${deduction.reason} — suggest: ${deduction.suggestedCategory}`}
                        />
                      ) : undefined}
                    />
                    {showSuggestion && (
                      <tr key={`${transaction.id}-match`}>
                        <td colSpan={6} className="px-4 pb-3">
                          <MatchSuggestion
                            transactionId={transaction.id}
                            workItemId={workItemId}
                            workItemSubject={cachedWorkItem.subject}
                            workItemAmount={cachedWorkItem.totalCost}
                            confidence={transaction.matchConfidence ?? 0}
                            onConfirm={handleConfirmMatch}
                            onReject={handleRejectMatch}
                            loading={matchLoading}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
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
      {/* CSV Import Modal */}
      {showCsvImport && (
        <CsvImportModal
          onClose={() => setShowCsvImport(false)}
          onImported={(count) => {
            setSmartSortResult(`Imported ${count} transaction${count !== 1 ? 's' : ''} from CSV`);
            // Refetch transactions
            fetchTransactions({
              pageSize: PAGE_SIZE,
              accountId: filterAccountId || undefined,
              type: filterType || undefined,
            }).then((result) => {
              setPage({
                transactions: result.transactions,
                lastDoc: result.lastDoc,
                hasMore: result.hasMore,
                loading: false,
              });
            });
          }}
        />
      )}
    </div>
  );
}
