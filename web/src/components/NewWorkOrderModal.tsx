import { useState } from 'react';
import type { Client, WorkItemType, LineItem, RecurrenceFrequency, App } from '../lib/types';
import { RECURRENCE_LABELS } from '../lib/types';
import { formatCurrency, addBusinessDays, formatDate } from '../lib/utils';
import { createWorkItem } from '../services/firestore';

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
  const [assigneeId, setAssigneeId] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const availableApps = apps.filter((a) => a.clientId === clientId);

  const totalHours = lineItems.reduce((s, li) => s + li.hours, 0);
  const totalCost = lineItems.reduce((s, li) => s + li.cost, 0);
  const isValid = subject.trim() && clientId;

  const typeOptions: { value: WorkItemType; label: string; color: string }[] = [
    { value: 'changeRequest', label: 'Change Request', color: 'var(--accent)' },
    { value: 'featureRequest', label: 'Feature Request', color: 'var(--color-green)' },
    { value: 'maintenance', label: 'Maintenance', color: 'var(--color-orange)' },
  ];

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
        assigneeId: assigneeId.trim() || undefined,
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

  const inputClass =
    'w-full mt-1 px-3 py-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow';
  const labelClass =
    'text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-widest';
  const sectionClass =
    'text-[10px] text-[var(--accent)] uppercase font-bold tracking-[0.2em] flex items-center gap-2 before:content-[""] before:h-px before:flex-1 before:bg-[var(--border)] after:content-[""] after:h-px after:flex-1 after:bg-[var(--border)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-[var(--bg-page)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-base font-extrabold text-[var(--text-primary)] uppercase tracking-wide">
            New Work Order
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-all text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-hide">
          <div className="px-5 pt-4 pb-2 space-y-3">
            {/* ── Type ── */}
            <div className={sectionClass}>Type</div>
            <div className="flex gap-1.5">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: type === opt.value ? opt.color : 'var(--bg-input)',
                    color: type === opt.value ? 'white' : 'var(--text-secondary)',
                    boxShadow: type === opt.value ? `0 2px 8px color-mix(in srgb, ${opt.color} 30%, transparent)` : 'none',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* ── Details ── */}
            <div className={sectionClass}>Details</div>

            {/* Client + App side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Client *</label>
                <select
                  value={clientId}
                  onChange={(e) => { setClientId(e.target.value); setSelectedAppId(''); }}
                  className={inputClass}
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>App</label>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No app</option>
                  {availableApps.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className={labelClass}>Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's the work?"
                className={inputClass}
              />
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details, context, or original request..."
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Assignee */}
            <div>
              <label className={labelClass}>Assign To</label>
              <input
                type="text"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                placeholder="Team member email or ID (optional)"
                className={inputClass}
              />
            </div>

            {/* ── Billing ── */}
            <div className={sectionClass}>Billing</div>

            <div className="flex gap-4 items-center flex-wrap">
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={(e) => setIsBillable(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Billable
              </label>
              <div className="flex items-center gap-0.5 bg-[var(--bg-input)] rounded-lg p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDeductFromRetainer(false)}
                  className={`px-3 py-1.5 rounded-md transition-all ${!deductFromRetainer ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  Hourly
                </button>
                <button
                  type="button"
                  onClick={() => setDeductFromRetainer(true)}
                  className={`px-3 py-1.5 rounded-md transition-all ${deductFromRetainer ? 'bg-[var(--color-orange)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  Retainer
                </button>
              </div>
            </div>

            {/* ── Schedule ── */}
            <div className={sectionClass}>Schedule</div>

            {type === 'maintenance' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Business Days</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={estimatedBusinessDays ?? ''}
                      placeholder="e.g. 5"
                      onChange={(e) => setEstimatedBusinessDays(e.target.value ? Number(e.target.value) : undefined)}
                      className={inputClass}
                    />
                    {estimatedBusinessDays && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 tracking-wide">
                        Schedules to: {formatDate(addBusinessDays(new Date(), estimatedBusinessDays))}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Or Pick Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Repeat</label>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRecurrenceFrequency('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!recurrenceFrequency ? 'bg-[var(--text-primary)] text-white shadow-sm' : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      None
                    </button>
                    {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).filter((f) => f !== 'custom').map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRecurrenceFrequency(freq)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${recurrenceFrequency === freq ? 'bg-[var(--color-orange)] text-white shadow-sm' : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                      >
                        {RECURRENCE_LABELS[freq]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRecurrenceFrequency('custom')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${recurrenceFrequency === 'custom' ? 'bg-[var(--color-orange)] text-white shadow-sm' : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
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
              </div>
            ) : (
              <div>
                <label className={labelClass}>Scheduled Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            {/* ── Line Items ── */}
            <div className={sectionClass}>Line Items</div>

            <div className="space-y-2">
              {lineItems.map((li, i) => (
                <div key={li.id} className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={li.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      placeholder="Description"
                      className="flex-1 text-sm text-[var(--text-primary)] bg-transparent placeholder:text-[var(--text-secondary)] focus:outline-none"
                    />
                    <button
                      onClick={() => removeLineItem(i)}
                      className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--color-red)]/10 transition-all text-sm"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      Hours:
                      <input
                        type="number"
                        value={li.hours}
                        onChange={(e) => updateLineItem(i, 'hours', e.target.value)}
                        step="0.5"
                        min="0"
                        className="w-16 px-2 py-1 bg-[var(--bg-input)] rounded text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    </label>
                    <span className="text-sm font-semibold text-[var(--text-primary)] ml-auto">
                      {formatCurrency(li.cost)}
                    </span>
                  </div>
                </div>
              ))}
              <button
                onClick={addLineItem}
                className="w-full py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] transition-all"
              >
                + Add Line Item
              </button>
            </div>

            {/* Totals */}
            {lineItems.length > 0 && (
              <div className="flex justify-between items-center bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
                <div>
                  <div className={labelClass}>Total</div>
                  <div className="text-lg font-extrabold text-[var(--text-primary)] mt-0.5">
                    {totalHours.toFixed(1)} hrs
                  </div>
                </div>
                <div className="text-right">
                  <div className={labelClass}>@ {formatCurrency(hourlyRate)}/hr</div>
                  <div className="text-xl font-extrabold text-[var(--accent)] mt-0.5">
                    {formatCurrency(totalCost)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-3.5 border-t border-[var(--border)] shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Create Work Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
