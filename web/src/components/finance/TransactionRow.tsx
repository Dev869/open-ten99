import { useState } from 'react';
import type { Transaction, ConnectedAccount } from '../../lib/types';
import { EXPENSE_CATEGORIES } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';

interface TransactionRowProps {
  transaction: Transaction;
  accounts: ConnectedAccount[];
  onCategoryChange: (id: string, category: string) => void;
}

function SourceBadge({ transaction, accounts }: { transaction: Transaction; accounts: ConnectedAccount[] }) {
  if (transaction.provider === 'stripe') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
        Stripe
      </span>
    );
  }

  if (transaction.provider === 'manual') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
        Manual
      </span>
    );
  }

  // plaid — look up account name
  const account = accounts.find((a) => a.id === transaction.accountId);
  const label = account ? account.accountName : 'Bank';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
      {label}
    </span>
  );
}

export function TransactionRow({ transaction, accounts, onCategoryChange }: TransactionRowProps) {
  const [localCategory, setLocalCategory] = useState(transaction.category);

  const isIncome = transaction.amount > 0;
  const amountClass = isIncome
    ? 'text-green-600 dark:text-green-400 font-medium'
    : 'text-red-600 dark:text-red-400 font-medium';
  const amountPrefix = isIncome ? '+' : '';

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setLocalCategory(next);
    onCategoryChange(transaction.id, next);
  }

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-card)] transition-colors">
      {/* Date */}
      <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
        {formatDate(transaction.date)}
      </td>

      {/* Description */}
      <td className="px-4 py-3 text-sm text-[var(--text-primary)] max-w-xs">
        <span className="line-clamp-1" title={transaction.description}>
          {transaction.description}
        </span>
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        <SourceBadge transaction={transaction} accounts={accounts} />
      </td>

      {/* Amount */}
      <td className={`px-4 py-3 text-sm text-right whitespace-nowrap ${amountClass}`}>
        {amountPrefix}{formatCurrency(Math.abs(transaction.amount))}
      </td>

      {/* Category (inline select) */}
      <td className="px-4 py-3">
        <select
          value={localCategory}
          onChange={handleCategoryChange}
          className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--accent)] hover:border-[var(--accent)] transition-colors"
          aria-label="Transaction category"
        >
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
