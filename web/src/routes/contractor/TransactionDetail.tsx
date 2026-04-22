import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Transaction, ConnectedAccount } from '../../lib/types';
import { EXPENSE_CATEGORIES } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { fetchTransaction, updateTransaction, reassignReceipt } from '../../services/firestore';
import { useConnectedAccounts } from '../../hooks/useFirestore';
import ReceiptUploader from '../../components/finance/ReceiptUploader';

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)]">{children}</span>
    </div>
  );
}

function ProviderLabel({ provider, accounts, accountId }: { provider: Transaction['provider']; accounts: ConnectedAccount[]; accountId?: string }) {
  if (provider === 'stripe') return <span>Stripe</span>;
  if (provider === 'manual') return <span>Manual Entry</span>;
  const account = accounts.find((a) => a.id === accountId);
  return <span>{account ? `${account.accountName} — ${account.institutionName}` : 'Bank (Plaid)'}</span>;
}

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accounts } = useConnectedAccounts();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [taxDeductible, setTaxDeductible] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    fetchTransaction(id).then((txn) => {
      setTransaction(txn);
      if (txn) {
        setDescription(txn.description);
        setCategory(txn.category);
        setTaxDeductible(txn.taxDeductible ?? false);
        setIsRecurring(txn.isRecurring ?? false);
      }
      setLoading(false);
    });
  }, [id]);

  function markDirty() {
    setDirty(true);
  }

  async function handleSave() {
    if (!transaction || !dirty) return;
    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        description,
        category,
        taxDeductible,
        isRecurring,
      });
      setTransaction({ ...transaction, description, category, taxDeductible, isRecurring });
      setDirty(false);
    } catch (err) {
      console.error('Failed to update transaction:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleReceiptUploaded(receiptId: string) {
    if (!transaction) return;
    try {
      await reassignReceipt(receiptId, undefined, transaction.id);
      setTransaction({
        ...transaction,
        receiptIds: [...(transaction.receiptIds ?? []), receiptId],
      });
    } catch (err) {
      console.error('Failed to link receipt:', err);
    }
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-[var(--border)] rounded" />
          <div className="h-40 bg-[var(--border)] rounded-lg" />
          <div className="h-32 bg-[var(--border)] rounded-lg" />
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">
        Transaction not found.
      </div>
    );
  }

  const isIncome = transaction.amount > 0;
  const amountClass = isIncome
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
  const amountPrefix = isIncome ? '+' : '';

  const hasReceipts = transaction.receiptIds && transaction.receiptIds.length > 0;

  const matchStatusLabel: Record<string, string> = {
    unmatched: 'Unmatched',
    suggested: 'Suggested Match',
    confirmed: 'Confirmed Match',
    rejected: 'Rejected',
  };

  return (
    <div className="w-full">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/dashboard/finance/transactions')}
          className="p-2 -ml-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Back to transactions"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Transaction
        </h1>
      </div>

      {/* Amount hero */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-3xl font-bold ${amountClass}`}>
              {amountPrefix}{formatCurrency(Math.abs(transaction.amount))}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {formatDate(transaction.date)}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            isIncome
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {isIncome ? 'Income' : 'Expense'}
          </span>
        </div>
      </div>

      {/* Editable fields */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-6 mb-4 space-y-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="txn-description" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            Description
          </label>
          <input
            id="txn-description"
            type="text"
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            className="text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="txn-category" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            Category
          </label>
          <select
            id="txn-category"
            value={category}
            onChange={(e) => { setCategory(e.target.value); markDirty(); }}
            className="text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="txn-deductible"
            type="checkbox"
            checked={taxDeductible}
            onChange={(e) => { setTaxDeductible(e.target.checked); markDirty(); }}
            className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <label htmlFor="txn-deductible" className="text-sm text-[var(--text-primary)]">
            Tax deductible
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="txn-recurring"
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => { setIsRecurring(e.target.checked); markDirty(); }}
            className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <label htmlFor="txn-recurring" className="text-sm text-[var(--text-primary)]">
            Recurring
          </label>
        </div>

        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Receipt */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-6 mb-4">
        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
          Receipt
        </span>

        {hasReceipts ? (
          <div className="mt-3 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 4v16l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V4l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-primary)] font-medium">
              {transaction.receiptIds!.length} receipt{transaction.receiptIds!.length !== 1 ? 's' : ''} attached
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <ReceiptUploader
              onUploadComplete={handleReceiptUploaded}
              onError={(msg) => console.error('Receipt upload error:', msg)}
            />
          </div>
        )}
      </div>

      {/* Read-only details */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
        <DetailField label="Source">
          <ProviderLabel provider={transaction.provider} accounts={accounts} accountId={transaction.accountId} />
        </DetailField>

        <DetailField label="Match Status">
          {matchStatusLabel[transaction.matchStatus] ?? transaction.matchStatus}
        </DetailField>

        {transaction.matchedWorkItemId && (
          <DetailField label="Matched Work Order">
            <button
              onClick={() => navigate(`/dashboard/work-orders/${transaction.matchedWorkItemId}`)}
              className="text-[var(--accent)] hover:underline"
            >
              View Work Order
            </button>
          </DetailField>
        )}

        {transaction.externalId && (
          <DetailField label="External ID">
            <span className="font-mono text-xs">{transaction.externalId}</span>
          </DetailField>
        )}

        <div className="flex gap-8">
          <DetailField label="Created">
            {formatDate(transaction.createdAt)}
          </DetailField>
          <DetailField label="Updated">
            {formatDate(transaction.updatedAt)}
          </DetailField>
        </div>
      </div>
    </div>
  );
}
