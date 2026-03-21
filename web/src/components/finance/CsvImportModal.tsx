import { useState, useRef } from 'react';
import { createManualExpense } from '../../services/firestore';
import { EXPENSE_CATEGORIES } from '../../lib/types';
import { categorizeByKeyword } from '../../lib/csvImport';

interface CsvImportModalProps {
  onClose: () => void;
  onImported: (count: number) => void;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  selected: boolean;
}

export function CsvImportModal({ onClose, onImported }: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'review'>('upload');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCsv(text);
        if (parsed.length === 0) {
          setError('No transactions found in the CSV. Expected columns: Date, Description, Amount');
          return;
        }
        setRows(parsed);
        setStep('review');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
  }

  function parseCsv(text: string): ParsedRow[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

    const header = lines[0].toLowerCase();
    const cols = splitCsvLine(lines[0]);
    const headerLower = cols.map((c) => c.toLowerCase().trim());

    // Find columns by common names
    const dateIdx = headerLower.findIndex((h) =>
      ['date', 'transaction date', 'posted date', 'posting date'].includes(h)
    );
    const descIdx = headerLower.findIndex((h) =>
      ['description', 'memo', 'name', 'merchant', 'payee', 'transaction description'].includes(h)
    );
    const amountIdx = headerLower.findIndex((h) =>
      ['amount', 'total', 'value'].includes(h)
    );
    // Some banks split into debit/credit columns
    const debitIdx = headerLower.findIndex((h) => ['debit', 'withdrawal', 'withdrawals'].includes(h));
    const creditIdx = headerLower.findIndex((h) => ['credit', 'deposit', 'deposits'].includes(h));

    if (dateIdx === -1) throw new Error('Could not find a Date column. Expected: Date, Transaction Date, or Posted Date');
    if (descIdx === -1) throw new Error('Could not find a Description column. Expected: Description, Memo, or Merchant');
    if (amountIdx === -1 && debitIdx === -1) throw new Error('Could not find an Amount column. Expected: Amount, Debit/Credit, or Total');

    const results: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = splitCsvLine(lines[i]);
      if (values.length < Math.max(dateIdx, descIdx, amountIdx, debitIdx, creditIdx) + 1) continue;

      const dateStr = values[dateIdx].trim();
      const description = values[descIdx].trim();

      let amount: number;
      if (amountIdx !== -1) {
        amount = parseAmount(values[amountIdx]);
      } else {
        // Debit/Credit columns — debit is negative, credit is positive
        const debit = debitIdx !== -1 ? parseAmount(values[debitIdx]) : 0;
        const credit = creditIdx !== -1 ? parseAmount(values[creditIdx]) : 0;
        amount = credit - debit;
      }

      if (isNaN(amount) || !dateStr || !description) continue;

      results.push({
        date: dateStr,
        description,
        amount,
        category: categorizeByKeyword(description),
        selected: true,
      });
    }

    return results;
  }

  function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/^"|"$/g, '').trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.replace(/^"|"$/g, '').trim());
    return result;
  }

  function parseAmount(str: string): number {
    const cleaned = str.replace(/[$,\s"]/g, '').replace(/\((.+)\)/, '-$1');
    return parseFloat(cleaned) || 0;
  }

  function toggleAll(selected: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected })));
  }

  function toggleRow(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  }

  function updateCategory(index: number, category: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, category } : r)));
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      let imported = 0;
      for (const row of selected) {
        const date = new Date(row.date);
        if (isNaN(date.getTime())) continue;

        await createManualExpense({
          description: row.description,
          amount: Math.abs(row.amount),
          category: row.category,
          date,
          taxDeductible: false,
        });
        imported++;
      }
      onImported(imported);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100]" onClick={onClose} />
      <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl sm:max-h-[80vh] z-[101] flex flex-col bg-[var(--bg-page)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Import Bank Statement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Upload a CSV file from your bank. Most banks let you export transactions as CSV from their website.
              </p>
              <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-6 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Choose CSV File
                </button>
                <p className="text-xs text-[var(--text-secondary)] mt-3">
                  Expected columns: Date, Description, Amount (or Debit/Credit)
                </p>
              </div>
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 text-xs text-[var(--text-secondary)] space-y-1">
                <p className="font-medium text-[var(--text-primary)]">Supported formats:</p>
                <p>Chase, Bank of America, Wells Fargo, Citi, Capital One, and most banks</p>
                <p>Columns auto-detected: Date, Description/Memo, Amount or Debit/Credit</p>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">
                  {rows.length} transactions found. Review and select which to import.
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={selectedCount === rows.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Select all
                </label>
              </div>

              <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-card)] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Description</th>
                      <th className="px-3 py-2 text-right font-medium text-[var(--text-secondary)]">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={`border-t border-[var(--border)] ${row.selected ? '' : 'opacity-40'}`}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} className="accent-[var(--accent)]" />
                        </td>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)] whitespace-nowrap">{row.date}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)] truncate max-w-[200px]">{row.description}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${row.amount < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {row.amount < 0 ? '-' : '+'}${Math.abs(row.amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={row.category}
                            onChange={(e) => updateCategory(i, e.target.value)}
                            className="text-xs bg-transparent border border-[var(--border)] rounded px-1 py-0.5 text-[var(--text-primary)]"
                          >
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm text-red-500 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
          {step === 'review' && (
            <button
              onClick={() => { setStep('upload'); setRows([]); }}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Back
            </button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Cancel
            </button>
            {step === 'review' && (
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
