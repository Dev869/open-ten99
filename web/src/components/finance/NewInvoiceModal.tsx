import { useState, useEffect } from 'react';
import type { Client, WorkItem, AppSettings, LineItem, WorkItemType, RecurrenceFrequency } from '../../lib/types';
import { RECURRENCE_LABELS } from '../../lib/types';
import { formatCurrency, paymentTermsToDays, getRetainerPeriodStart, getRetainerPeriodEnd } from '../../lib/utils';
import { buildRetainerLineItems } from '../../lib/retainerInvoice';
import { createWorkItem } from '../../services/firestore';
import { cn } from '../../lib/utils';
import { IconClose, IconPlus, IconTrash } from '../icons';

interface NewInvoiceModalProps {
  clients: Client[];
  workItems: WorkItem[];
  settings: AppSettings | null;
  hourlyRate: number;
  paymentTerms?: string;
  onClose: () => void;
}

function defaultDueDate(paymentTerms?: string): string {
  const date = new Date();
  date.setDate(date.getDate() + paymentTermsToDays(paymentTerms));
  return date.toISOString().split('T')[0];
}

export function NewInvoiceModal({ clients, workItems, settings, hourlyRate, paymentTerms, onClose }: NewInvoiceModalProps) {
  const [invoiceType, setInvoiceType] = useState<WorkItemType>('changeRequest');
  const [clientId, setClientId] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(() => defaultDueDate(paymentTerms));
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | ''>('');
  const [customDays, setCustomDays] = useState<number>(30);
  const [deductFromRetainer, setDeductFromRetainer] = useState(false);
  const [isRetainerInvoice, setIsRetainerInvoice] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const isMaintenance = invoiceType === 'maintenance';

  const totalHours = lineItems.reduce((s, li) => s + li.hours, 0);
  const totalCost = lineItems.reduce((s, li) => s + li.cost, 0);
  const totalAtRate = lineItems.reduce((s, li) => s + li.hours * hourlyRate, 0);
  const discount = totalAtRate - totalCost;
  const isValid = subject.trim() && clientId;

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

  // Auto-populate retainer invoice fields when client selected
  useEffect(() => {
    if (!isRetainerInvoice || !clientId) return;
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!selectedClient?.retainerHours || !selectedClient.retainerBillingMode) return;

    const renewalDay = selectedClient.retainerRenewalDay ?? 1;
    const periodStart = getRetainerPeriodStart(renewalDay);
    const periodEnd = getRetainerPeriodEnd(renewalDay);
    const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const periodWorkItems = workItems.filter((wi) =>
      wi.clientId === clientId &&
      wi.deductFromRetainer &&
      wi.status !== 'draft' &&
      wi.updatedAt >= periodStart &&
      wi.updatedAt <= periodEnd &&
      !wi.isRetainerInvoice
    );

    const usedHours = periodWorkItems.reduce((sum, wi) => sum + wi.totalHours, 0);

    const result = buildRetainerLineItems({
      mode: selectedClient.retainerBillingMode,
      retainerHours: selectedClient.retainerHours,
      retainerFlatRate: selectedClient.retainerFlatRate,
      hourlyRate: settings?.hourlyRate ?? 25,
      periodLabel,
      workItems: periodWorkItems.flatMap((wi) =>
        wi.lineItems.map((li) => ({ description: li.description, hours: li.hours, cost: li.cost }))
      ),
      usedHours,
    });

    setSubject(`${selectedClient.retainerBillingMode === 'flat' ? 'Monthly Retainer' : 'Retainer Usage'} — ${periodLabel}`);
    setLineItems(result.lineItems);
    setDeductFromRetainer(true);
  }, [isRetainerInvoice, clientId]);

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
        isRetainerInvoice,
        ...(isRetainerInvoice && clientId ? (() => {
          const selectedClient = clients.find((c) => c.id === clientId);
          const renewalDay = selectedClient?.retainerRenewalDay ?? 1;
          return {
            retainerPeriodStart: getRetainerPeriodStart(renewalDay),
            retainerPeriodEnd: getRetainerPeriodEnd(renewalDay),
            retainerOverageHours: Math.max(0, totalHours - (selectedClient?.retainerHours ?? 0)),
          };
        })() : {}),
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

  /* ── Shared input class ─────────────────────────── */
  const inputClass = 'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all';

  return (
    <>
      {/* Desktop backdrop */}
      <div
        className="hidden md:block fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal — full page on mobile, centered card on desktop */}
      <div
        className={cn(
          'fixed z-[60] flex flex-col bg-[var(--bg-page)]',
          // Mobile: full page
          'inset-0',
          // Desktop: centered card
          'md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
          'md:w-full md:max-w-lg md:max-h-[85vh] md:rounded-2xl md:border md:border-[var(--border)] md:shadow-2xl',
          'animate-fade-in-up md:animate-scale-in'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 flex-shrink-0 border-b border-[var(--border)]">
          <h1 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
            New Invoice
          </h1>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-4">

            {/* Type toggle */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Type
              </label>
              <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => { setInvoiceType('changeRequest'); setRecurrenceFrequency(''); setIsRetainerInvoice(false); }}
                  className={cn(
                    'flex-1 py-2 rounded-md text-xs font-semibold transition-all',
                    !isMaintenance && !isRetainerInvoice
                      ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  One-Time
                </button>
                <button
                  type="button"
                  onClick={() => { setInvoiceType('maintenance'); setIsRetainerInvoice(false); }}
                  className={cn(
                    'flex-1 py-2 rounded-md text-xs font-semibold transition-all',
                    isMaintenance && !isRetainerInvoice
                      ? 'bg-[var(--bg-card)] text-[var(--color-orange)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  Recurring
                </button>
                <button
                  type="button"
                  onClick={() => { setInvoiceType('maintenance'); setIsRetainerInvoice(true); setDeductFromRetainer(true); }}
                  className={cn(
                    'flex-1 py-2 rounded-md text-xs font-semibold transition-all',
                    isRetainerInvoice
                      ? 'bg-[var(--bg-card)] text-[var(--color-green)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  Retainer
                </button>
              </div>
            </div>

            {/* Client */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Client
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="March 2024 development work"
                className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Notes <span className="normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details or context..."
                rows={2}
                className={cn(inputClass, 'h-auto py-2.5 resize-none placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {/* Due Date + Billing — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Billing
                </label>
                <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-0.5 h-10 items-center">
                  <button
                    type="button"
                    onClick={() => setDeductFromRetainer(false)}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-xs font-semibold transition-all',
                      !deductFromRetainer
                        ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                        : 'text-[var(--text-secondary)]'
                    )}
                  >
                    Hourly
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductFromRetainer(true)}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-xs font-semibold transition-all',
                      deductFromRetainer
                        ? 'bg-[var(--bg-card)] text-[var(--color-orange)] shadow-sm'
                        : 'text-[var(--text-secondary)]'
                    )}
                  >
                    Retainer
                  </button>
                </div>
              </div>
            </div>

            {/* Recurrence (maintenance only) */}
            {isMaintenance && (
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Repeat
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setRecurrenceFrequency(freq)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                        recurrenceFrequency === freq
                          ? 'bg-[var(--color-orange)] text-white'
                          : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                      )}
                    >
                      {RECURRENCE_LABELS[freq]}
                    </button>
                  ))}
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
                      className="w-16 h-8 px-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] text-center outline-none focus:border-[var(--color-orange)]"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">days</span>
                  </div>
                )}
              </div>
            )}

            {/* Line Items */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Line Items
              </label>
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={li.id} className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
                    <div className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-1 text-sm text-[var(--text-primary)] bg-transparent outline-none placeholder:text-[var(--text-secondary)]"
                      />
                      <button
                        onClick={() => removeLineItem(i)}
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--bg-input)] transition-colors flex-shrink-0"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium">
                        Hrs
                        <input
                          type="number"
                          value={li.hours}
                          onChange={(e) => updateLineItem(i, 'hours', e.target.value)}
                          step="0.5"
                          min="0"
                          className="w-14 h-7 px-2 bg-[var(--bg-input)] rounded text-xs font-semibold text-[var(--text-primary)] outline-none text-center"
                        />
                      </label>
                      <div className="flex-1" />
                      <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium">
                        $
                        <input
                          type="number"
                          value={li.cost}
                          onChange={(e) => updateLineItem(i, 'cost', e.target.value)}
                          step="0.01"
                          min="0"
                          className="w-20 h-7 px-2 bg-[var(--bg-input)] rounded text-xs font-semibold text-[var(--text-primary)] outline-none text-right"
                        />
                      </label>
                    </div>
                    {li.hours > 0 && li.cost !== li.hours * hourlyRate && (
                      <div className={cn(
                        'text-[10px] mt-1.5 font-medium text-right',
                        li.cost < li.hours * hourlyRate ? 'text-[var(--color-green)]' : 'text-[var(--color-orange)]'
                      )}>
                        {li.cost < li.hours * hourlyRate
                          ? `−${formatCurrency(li.hours * hourlyRate - li.cost)} discount`
                          : `+${formatCurrency(li.cost - li.hours * hourlyRate)} markup`}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={addLineItem}
                  className="w-full h-10 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--accent)] rounded-lg border border-dashed border-[var(--border)] hover:bg-[var(--accent)]/5 transition-colors"
                >
                  <IconPlus size={12} />
                  Add Line Item
                </button>
              </div>
            </div>

            {/* Totals */}
            {lineItems.length > 0 && (
              <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wider">Total</div>
                    <div className="text-base font-extrabold text-[var(--text-primary)] mt-0.5">
                      {totalHours.toFixed(1)} hrs
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      @ {formatCurrency(hourlyRate)}/hr
                    </div>
                    {discount !== 0 && (
                      <div className="text-xs text-[var(--text-secondary)] line-through">
                        {formatCurrency(totalAtRate)}
                      </div>
                    )}
                    <div className="text-lg font-extrabold text-[var(--accent)]">
                      {formatCurrency(totalCost)}
                    </div>
                  </div>
                </div>
                {discount !== 0 && (
                  <div className="flex justify-end mt-2 pt-2 border-t border-[var(--border)]">
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      discount > 0
                        ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]'
                        : 'bg-[var(--color-orange)]/10 text-[var(--color-orange)]'
                    )}>
                      {discount > 0
                        ? `−${formatCurrency(discount)} discount (${Math.round((discount / totalAtRate) * 100)}% off)`
                        : `+${formatCurrency(-discount)} markup`}
                    </span>
                  </div>
                )}
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
            {saving ? 'Saving...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </>
  );
}
