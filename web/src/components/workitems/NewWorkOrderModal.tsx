import { useState } from 'react';
import type { Client, WorkItemType, LineItem, RecurrenceFrequency, App } from '../../lib/types';
import { RECURRENCE_LABELS } from '../../lib/types';
import { addBusinessDays, formatDate, cn } from '../../lib/utils';
import { createWorkItem } from '../../services/firestore';
import { IconPlus, IconTrash } from '../icons';
import { Modal } from '../common/Modal';

interface NewWorkOrderModalProps {
  clients: Client[];
  apps: App[];
  hourlyRate: number;
  onClose: () => void;
  initialClientId?: string;
  initialAppId?: string;
}

export function NewWorkOrderModal({ clients, apps, onClose, initialClientId, initialAppId }: NewWorkOrderModalProps) {
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

  function addLineItem() {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: '', hours: 0, cost: 0 },
    ]);
  }

  function updateDescription(index: number, value: string) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], description: value };
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

  const inputClass = 'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all';

  return (
    <Modal
      open
      onClose={onClose}
      title="New Work Order"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-[2] h-11 rounded-xl bg-[var(--accent)] text-white text-sm font-bold shadow-sm hover:bg-[var(--accent-dark)] disabled:bg-[var(--border)] disabled:text-[var(--text-secondary)] disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {saving ? 'Saving...' : 'Create Work Order'}
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">

            {/* Type */}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Type
              </label>
              <div className="flex gap-1 bg-[var(--bg-input)] rounded-xl p-1">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                      type === opt.value
                        ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                <div className="flex gap-1 bg-[var(--bg-input)] rounded-xl p-1 h-10 items-center">
                  <button
                    type="button"
                    onClick={() => setDeductFromRetainer(false)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                      !deductFromRetainer
                        ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    Hourly
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductFromRetainer(true)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                      deductFromRetainer
                        ? 'bg-[var(--bg-card)] text-[var(--color-orange)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                  <div key={li.id} className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border)]">
                    <div className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => updateDescription(i, e.target.value)}
                        placeholder="Description"
                        className="flex-1 text-sm text-[var(--text-primary)] bg-transparent outline-none placeholder:text-[var(--text-secondary)]/60"
                      />
                      <button
                        onClick={() => removeLineItem(i)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--bg-input)] transition-colors flex-shrink-0"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                      Hours are logged later via the timer or Add time manually.
                    </div>
                  </div>
                ))}
                <button
                  onClick={addLineItem}
                  className="w-full h-11 flex items-center justify-center gap-2 text-xs font-bold text-[var(--accent)] rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all"
                >
                  <IconPlus size={14} />
                  Add Line Item
                </button>
              </div>
            </div>

      </div>
    </Modal>
  );
}
