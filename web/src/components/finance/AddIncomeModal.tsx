import { useState, useEffect } from 'react';
import { createManualIncome } from '../../services/firestore';
import { cn } from '../../lib/utils';
import { IconClose } from '../icons';

interface AddIncomeModalProps {
  onClose: () => void;
  onAdded: (description: string) => void;
}

function todayInputValue(): string {
  return new Date().toISOString().split('T')[0];
}

export function AddIncomeModal({ onClose, onAdded }: AddIncomeModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => todayInputValue());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountValue = Number(amount);
  const isValid = amount.trim() !== '' && amountValue > 0 && !!date && description.trim() !== '';

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createManualIncome({
        description: description.trim(),
        amount: amountValue,
        date: new Date(`${date}T00:00:00`),
        category: category.trim() || undefined,
      });
      onAdded(description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add income');
      setSaving(false);
    }
  }

  /* ── Shared input class (mirrors NewInvoiceModal) ── */
  const inputClass = 'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all';
  const labelClass = 'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5';

  return (
    <>
      {/* Desktop backdrop */}
      <div
        className="hidden md:block fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal — full page on mobile, centered card on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add income"
        className={cn(
          'fixed z-[60] flex flex-col bg-[var(--bg-page)]',
          'inset-0',
          'md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
          'md:w-full md:max-w-md md:max-h-[85vh] md:rounded-2xl md:border md:border-[var(--border)] md:shadow-2xl',
          'animate-fade-in-up md:animate-scale-in'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 flex-shrink-0 border-b border-[var(--border)]">
          <h1 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
            Add Income
          </h1>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-4">

            {/* Amount + Date — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="income-amount" className={labelClass}>Amount</label>
                <input
                  id="income-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500.00"
                  className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
                />
              </div>
              <div>
                <label htmlFor="income-date" className={labelClass}>Date</label>
                <input
                  id="income-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Description / Source */}
            <div>
              <label htmlFor="income-description" className={labelClass}>Description / Source</label>
              <input
                id="income-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Consulting payment — Acme Co."
                className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="income-category" className={labelClass}>
                Category <span className="normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <input
                id="income-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Manual Income"
                className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {error && (
              <div role="alert" className="px-3 py-2 rounded-lg bg-[var(--color-red)]/10 text-sm text-[var(--color-red)]">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-4 py-3 border-t border-[var(--border)] flex-shrink-0 bg-[var(--bg-page)]"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 h-10 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Add Income'}
          </button>
        </div>
      </div>
    </>
  );
}
