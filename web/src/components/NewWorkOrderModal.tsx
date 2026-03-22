import { useState, useEffect } from 'react';
import type { Client, WorkItemType, LineItem, RecurrenceFrequency, App } from '../lib/types';
import { RECURRENCE_LABELS } from '../lib/types';
import { formatCurrency, addBusinessDays, formatDate, cn } from '../lib/utils';
import { createWorkItem } from '../services/firestore';
import { IconClose, IconPlus, IconTrash } from './icons';

interface NewWorkOrderModalProps {
  clients: Client[];
  apps: App[];
  hourlyRate: number;
  onClose: () => void;
  initialClientId?: string;
  initialAppId?: string;
}

export function NewWorkOrderModal({ clients, apps, hourlyRate, onClose, initialClientId, initialAppId }: NewWorkOrderModalProps) {
  const [type, setType] = useState<WorkItemType>('changeRequest');
  const [clientId, setClientId] = useState(initialClientId ?? '');
  const [selectedAppId, setSelectedAppId] = useState(initialAppId ?? '');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [deductFromRetainer, setDeductFromRetainer] = useState(false);
  const [estimatedBusinessDays, setEstimatedBusinessDays] = useState<number | undefined>(undefined);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | ''>('');
  const [customDays, setCustomDays] = useState<number>(3);
  const [scheduledDate, setScheduledDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const availableApps = apps.filter((a) => a.clientId === clientId);
  const totalHours = lineItems.reduce((s, li) => s + li.hours, 0);
  const totalCost = lineItems.reduce((s, li) => s + li.cost, 0);
  const isValid = subject.trim() && clientId;

  const typeOptions: { value: WorkItemType; label: string }[] = [
    { value: 'changeRequest', label: 'Change' },
    { value: 'featureRequest', label: 'Feature' },
    { value: 'maintenance', label: 'Maint.' },
  ];

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
        type,
        status: 'draft',
        clientId,
        appId: selectedAppId || undefined,
        sourceEmail: notes,
        subject: subject.trim(),
        lineItems: lineItems.filter((li) => li.description.trim()),
        totalHours,
        totalCost,
        isBillable,
        deductFromRetainer,
        estimatedBusinessDays,
        recurrence: recurrenceFrequency
          ? {
              frequency: recurrenceFrequency,
              ...(recurrenceFrequency === 'custom' ? { customDays } : {}),
            }
          : undefined,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Error creating work order:', err);
    }
    setSaving(false);
  }

  const inputClass = 'w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors';

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
          'inset-0',
          'md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
          'md:w-full md:max-w-lg md:max-h-[85vh] md:rounded-2xl md:border md:border-[var(--border)] md:shadow-2xl',
          'animate-fade-in-up md:animate-scale-in'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 flex-shrink-0 border-b border-[var(--border)]">
          <h1 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
            New Work Order
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

            {/* Type */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Type
              </label>
              <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-0.5">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'flex-1 py-2 rounded-md text-xs font-semibold transition-all',
                      type === opt.value
                        ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                        : 'text-[var(--text-secondary)]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Client */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Client
              </label>
              <select
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setSelectedAppId(''); }}
                className={inputClass}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* App (optional) */}
            {availableApps.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  App <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {availableApps.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's the work?"
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
                placeholder="Details, context, or original request..."
                rows={2}
                className={cn(inputClass, 'h-auto py-2.5 resize-none placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {/* Schedule + Billing — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Schedule
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
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

            {/* Billable toggle */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Billable
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={isBillable}
                onClick={() => setIsBillable(!isBillable)}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  isBillable ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--bg-card)] shadow-sm transition duration-200',
                    isBillable ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Maintenance: business days + recurrence */}
            {type === 'maintenance' && (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Estimated Business Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={estimatedBusinessDays ?? ''}
                    placeholder="e.g. 5"
                    onChange={(e) => setEstimatedBusinessDays(e.target.value ? Number(e.target.value) : undefined)}
                    className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
                  />
                  {estimatedBusinessDays != null && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      Schedules to: {formatDate(addBusinessDays(new Date(), estimatedBusinessDays))}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Repeat
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRecurrenceFrequency('')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                        !recurrenceFrequency
                          ? 'bg-[var(--text-primary)] text-[var(--bg-page)]'
                          : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                      )}
                    >
                      None
                    </button>
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
              </>
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
                      <span className="text-xs font-semibold text-[var(--text-primary)] ml-auto">
                        {formatCurrency(li.cost)}
                      </span>
                    </div>
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
              <div className="flex justify-between items-center bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
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
                  <div className="text-lg font-extrabold text-[var(--accent)]">
                    {formatCurrency(totalCost)}
                  </div>
                </div>
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
            {saving ? 'Saving...' : 'Create'}
          </button>
        </div>
      </div>
    </>
  );
}
