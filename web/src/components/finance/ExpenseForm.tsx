import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../../lib/firebase';
import { EXPENSE_CATEGORIES } from '../../lib/types';

interface ExpenseFormProps {
  onSubmit: (expense: {
    description: string;
    amount: number;
    category: string;
    date: Date;
    taxDeductible: boolean;
    receiptUrl?: string;
  }) => Promise<void>;
  loading?: boolean;
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

const inputClass =
  'w-full mt-1.5 px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';

const labelClass = 'text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide';

export function ExpenseForm({ onSubmit, loading = false }: ExpenseFormProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(todayString());
  const [taxDeductible, setTaxDeductible] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDisabled = loading || uploading;
  const isValid = description.trim() && amount && parseFloat(amount) > 0;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setReceiptError('');
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setReceiptError('Receipt must be 10 MB or smaller.');
      setReceiptFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setReceiptFile(file);
  }

  async function uploadReceipt(file: File): Promise<string> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Not authenticated');
    const timestamp = Date.now();
    const storagePath = `receipts/${userId}/${timestamp}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setError('');
    let receiptUrl: string | undefined;

    if (receiptFile) {
      setUploading(true);
      try {
        receiptUrl = await uploadReceipt(receiptFile);
      } catch (err) {
        console.error('Receipt upload failed:', err);
        setError('Failed to upload receipt. Please try again.');
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    try {
      await onSubmit({
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        date: new Date(date + 'T00:00:00'),
        taxDeductible,
        receiptUrl,
      });

      // Reset form after successful submit
      setDescription('');
      setAmount('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setDate(todayString());
      setTaxDeductible(false);
      setReceiptFile(null);
      setReceiptError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Expense submit failed:', err);
      setError('Failed to save expense. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Description */}
      <div>
        <label htmlFor="expense-description" className={labelClass}>
          Description *
        </label>
        <input
          id="expense-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this expense for?"
          className={inputClass}
          disabled={isDisabled}
          required
        />
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="expense-amount" className={labelClass}>
          Amount *
        </label>
        <input
          id="expense-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min="0.01"
          step="0.01"
          className={inputClass}
          disabled={isDisabled}
          required
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="expense-category" className={labelClass}>
          Category
        </label>
        <select
          id="expense-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
          disabled={isDisabled}
        >
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="expense-date" className={labelClass}>
          Date
        </label>
        <input
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          disabled={isDisabled}
        />
      </div>

      {/* Tax Deductible */}
      <div className="flex items-center gap-3 mt-1">
        <input
          id="expense-tax-deductible"
          type="checkbox"
          checked={taxDeductible}
          onChange={(e) => setTaxDeductible(e.target.checked)}
          disabled={isDisabled}
          className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
        />
        <label
          htmlFor="expense-tax-deductible"
          className="text-sm text-[var(--text-primary)] cursor-pointer select-none"
        >
          Tax deductible
        </label>
      </div>

      {/* Receipt Upload */}
      <div>
        <label className={labelClass}>Receipt (optional)</label>
        <div className="mt-1.5 flex items-center gap-3">
          <label
            htmlFor="expense-receipt"
            className={`inline-flex items-center px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Choose file
            <input
              id="expense-receipt"
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={isDisabled}
              className="sr-only"
            />
          </label>
          <span className="text-sm text-[var(--text-secondary)] truncate max-w-[200px]">
            {receiptFile ? receiptFile.name : 'No file chosen'}
          </span>
        </div>
        {receiptError && (
          <p className="mt-1.5 text-xs text-red-500">{receiptError}</p>
        )}
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Images or PDF, max 10 MB
        </p>
      </div>

      {/* Upload progress */}
      {uploading && (
        <p className="text-sm text-[var(--accent)] font-medium">Uploading receipt...</p>
      )}

      {/* Global error */}
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isDisabled || !isValid}
        className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading receipt...' : loading ? 'Saving...' : 'Add Expense'}
      </button>
    </form>
  );
}
