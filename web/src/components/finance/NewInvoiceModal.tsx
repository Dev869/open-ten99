import { useState } from 'react';
import type { Client, LineItem, WorkItemType, RecurrenceFrequency } from '../../lib/types';
import { RECURRENCE_LABELS } from '../../lib/types';
import { formatCurrency, paymentTermsToDays } from '../../lib/utils';
import { createWorkItem } from '../../services/firestore';

interface NewInvoiceModalProps {
  clients: Client[];
  hourlyRate: number;
  paymentTerms?: string;
  onClose: () => void;
}

function defaultDueDate(paymentTerms?: string): string {
  const date = new Date();
  date.setDate(date.getDate() + paymentTermsToDays(paymentTerms));
  return date.toISOString().split('T')[0];
}

export function NewInvoiceModal({ clients, hourlyRate, paymentTerms, onClose }: NewInvoiceModalProps) {
  const [invoiceType, setInvoiceType] = useState<WorkItemType>('changeRequest');
  const [clientId, setClientId] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(() => defaultDueDate(paymentTerms));
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | ''>('');
  const [customDays, setCustomDays] = useState<number>(30);
  const [deductFromRetainer, setDeductFromRetainer] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const isMaintenance = invoiceType === 'maintenance';

  const totalHours = lineItems.reduce((s, li) => s + li.hours, 0);
  const totalCost = lineItems.reduce((s, li) => s + li.cost, 0);
  const totalAtRate = lineItems.reduce((s, li) => s + li.hours * hourlyRate, 0);
  const discount = totalAtRate - totalCost;
  const isValid = subject.trim() && clientId;

  function addLineItem() {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: '', hours: 1, cost: hourlyRate },
    ]);
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    if (field === 'hours') {
      const hours = Number(value) || 0;
      updated[index] = { ...updated[index], hours, cost: hours * hourlyRate };
    } else if (field === 'cost') {
      updated[index] = { ...updated[index], cost: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setLineItems(updated);
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      await createWorkItem({
        type: invoiceType,
        status: 'completed',
        clientId,
        subject: subject.trim(),
        sourceEmail: notes,
        lineItems: lineItems.filter((li) => li.description.trim()),
        totalHours,
        totalCost,
        isBillable: true,
        deductFromRetainer,
        invoiceStatus: 'draft',
        invoiceDueDate: dueDate ? new Date(dueDate) : undefined,
        recurrence: recurrenceFrequency
          ? {
              frequency: recurrenceFrequency,
              ...(recurrenceFrequency === 'custom' ? { customDays } : {}),
            }
          : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Error creating invoice:', err);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-[var(--bg-page)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] uppercase tracking-wide">
            New Invoice
          </h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Invoice Type */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Type
            </label>
            <div className="flex gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => { setInvoiceType('changeRequest'); setRecurrenceFrequency(''); }}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: !isMaintenance ? 'var(--accent)' : 'var(--bg-input)',
                  color: !isMaintenance ? 'white' : 'var(--text-secondary)',
                }}
              >
                One-Time
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType('maintenance')}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: isMaintenance ? 'var(--color-orange)' : 'var(--bg-input)',
                  color: isMaintenance ? 'white' : 'var(--text-secondary)',
                }}
              >
                Recurring
              </button>
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full mt-1.5 px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="March 2024 development work"
              className="w-full mt-1.5 px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details or context..."
              rows={3}
              className="w-full mt-1.5 px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full mt-1.5 px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Recurrence (maintenance only) */}
          {isMaintenance && (
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                Repeat
              </label>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).filter((f) => f !== 'custom').map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setRecurrenceFrequency(freq)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${recurrenceFrequency === freq ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'}`}
                  >
                    {RECURRENCE_LABELS[freq]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRecurrenceFrequency('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${recurrenceFrequency === 'custom' ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'}`}
                >
                  Custom
                </button>
              </div>
              {recurrenceFrequency === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-[var(--text-secondary)]">Every</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 px-2 py-1.5 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-orange)]"
                  />
                  <span className="text-xs text-[var(--text-secondary)]">days</span>
                </div>
              )}
            </div>
          )}

          {/* Billing Type */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Billing
            </label>
            <div className="flex items-center gap-1 mt-1.5 bg-[var(--bg-input)] rounded-lg p-0.5 text-xs font-semibold w-fit">
              <button
                type="button"
                onClick={() => setDeductFromRetainer(false)}
                className={`px-3 py-1.5 rounded-md transition-colors ${!deductFromRetainer ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setDeductFromRetainer(true)}
                className={`px-3 py-1.5 rounded-md transition-colors ${deductFromRetainer ? 'bg-[var(--color-orange)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Retainer
              </button>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Line Items
            </label>
            <div className="mt-1.5 space-y-2">
              {lineItems.map((li, i) => (
                <div key={li.id} className="bg-[var(--bg-card)] rounded-xl p-3 border border-[var(--border)]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={li.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      placeholder="Description"
                      className="flex-1 text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
                    />
                    <button
                      onClick={() => removeLineItem(i)}
                      className="text-[var(--text-secondary)] hover:text-[var(--color-red)] text-sm"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                      Hours:
                      <input
                        type="number"
                        value={li.hours}
                        onChange={(e) => updateLineItem(i, 'hours', e.target.value)}
                        step="0.5"
                        min="0"
                        className="w-16 px-2 py-1 bg-[var(--bg-input)] rounded text-sm font-medium text-[var(--text-primary)] focus:outline-none"
                      />
                    </label>
                    <div className="ml-auto text-right">
                      <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                        Cost:
                        <input
                          type="number"
                          value={li.cost}
                          onChange={(e) => updateLineItem(i, 'cost', e.target.value)}
                          step="0.01"
                          min="0"
                          className="w-20 px-2 py-1 bg-[var(--bg-input)] rounded text-sm font-medium text-[var(--text-primary)] text-right focus:outline-none"
                        />
                      </label>
                      {li.hours > 0 && li.cost !== li.hours * hourlyRate && (
                        <div className={`text-[10px] mt-0.5 font-medium ${li.cost < li.hours * hourlyRate ? 'text-[var(--color-green)]' : 'text-[var(--color-orange)]'}`}>
                          {li.cost < li.hours * hourlyRate
                            ? `−${formatCurrency(li.hours * hourlyRate - li.cost)} discount`
                            : `+${formatCurrency(li.cost - li.hours * hourlyRate)} markup`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addLineItem}
                className="w-full py-2.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 rounded-xl transition-colors"
              >
                + Add Line Item
              </button>
            </div>
          </div>

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-[var(--text-secondary)]">Total</div>
                  <div className="text-lg font-extrabold text-[var(--text-primary)]">
                    {totalHours.toFixed(1)} hrs
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--text-secondary)]">
                    @ {formatCurrency(hourlyRate)}/hr
                  </div>
                  {discount !== 0 && (
                    <div className="text-sm text-[var(--text-secondary)] line-through">
                      {formatCurrency(totalAtRate)}
                    </div>
                  )}
                  <div className="text-xl font-extrabold text-[var(--accent)]">
                    {formatCurrency(totalCost)}
                  </div>
                </div>
              </div>
              {discount !== 0 && (
                <div className={`flex justify-end mt-2 pt-2 border-t border-[var(--border)]`}>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${discount > 0 ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]' : 'bg-[var(--color-orange)]/10 text-[var(--color-orange)]'}`}>
                    {discount > 0
                      ? `−${formatCurrency(discount)} discount (${Math.round((discount / totalAtRate) * 100)}% off)`
                      : `+${formatCurrency(-discount)} markup`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
