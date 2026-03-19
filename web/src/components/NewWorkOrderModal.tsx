import { useState } from 'react';
import type { Client, WorkItemType, LineItem, RecurrenceFrequency } from '../lib/types';
import { RECURRENCE_LABELS } from '../lib/types';
import { formatCurrency, addBusinessDays, formatDate } from '../lib/utils';
import { createWorkItem } from '../services/firestore';

interface NewWorkOrderModalProps {
  clients: Client[];
  hourlyRate: number;
  onClose: () => void;
}

export function NewWorkOrderModal({ clients, hourlyRate, onClose }: NewWorkOrderModalProps) {
  const [type, setType] = useState<WorkItemType>('changeRequest');
  const [clientId, setClientId] = useState('');
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

  const totalHours = lineItems.reduce((s, li) => s + li.hours, 0);
  const totalCost = lineItems.reduce((s, li) => s + li.cost, 0);
  const isValid = subject.trim() && clientId;

  const typeOptions: { value: WorkItemType; label: string; color: string }[] = [
    { value: 'changeRequest', label: 'Change Request', color: '#4BA8A8' },
    { value: 'featureRequest', label: 'Feature Request', color: '#27AE60' },
    { value: 'maintenance', label: 'Maintenance', color: '#E67E22' },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-[#F5F5F7] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#E5E5EA]">
          <h2 className="text-lg font-extrabold text-[#1A1A2E] uppercase tracking-wide">
            New Work Order
          </h2>
          <button onClick={onClose} className="text-[#86868B] hover:text-[#1A1A2E] text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
              Type
            </label>
            <div className="flex gap-1.5 mt-1.5">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: type === opt.value ? opt.color : '#F2F2F7',
                    color: type === opt.value ? 'white' : '#86868B',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full mt-1.5 px-3 py-2.5 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
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
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's the work?"
              className="w-full mt-1.5 px-3 py-2.5 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Details, context, or original request..."
              rows={3}
              className="w-full mt-1.5 px-3 py-2.5 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] resize-none focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>

          {/* Schedule (maintenance) */}
          {type === 'maintenance' && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
                    Business Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={estimatedBusinessDays ?? ''}
                    placeholder="e.g. 5"
                    onChange={(e) => setEstimatedBusinessDays(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full mt-1.5 px-3 py-2.5 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                  />
                  {estimatedBusinessDays && (
                    <p className="text-xs text-[#86868B] mt-1">
                      Schedules to: {formatDate(addBusinessDays(new Date(), estimatedBusinessDays))}
                    </p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
                    Or Pick Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2.5 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
                  Repeat
                </label>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRecurrenceFrequency('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!recurrenceFrequency ? 'bg-[#1A1A2E] text-white' : 'bg-[#F2F2F7] text-[#86868B]'}`}
                  >
                    None
                  </button>
                  {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).filter((f) => f !== 'custom').map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setRecurrenceFrequency(freq)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${recurrenceFrequency === freq ? 'bg-[#E67E22] text-white' : 'bg-[#F2F2F7] text-[#86868B]'}`}
                    >
                      {RECURRENCE_LABELS[freq]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRecurrenceFrequency('custom')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${recurrenceFrequency === 'custom' ? 'bg-[#E67E22] text-white' : 'bg-[#F2F2F7] text-[#86868B]'}`}
                  >
                    Custom
                  </button>
                </div>
                {recurrenceFrequency === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-[#86868B]">Every</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={customDays}
                      onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 px-2 py-1.5 bg-white rounded-lg border border-[#E5E5EA] text-sm text-[#1A1A2E] text-center focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                    />
                    <span className="text-xs text-[#86868B]">days</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Billable + Billing Type */}
          <div className="space-y-2">
            <div className="flex gap-4 items-center flex-wrap">
              <label className="flex items-center gap-2 text-sm text-[#1A1A2E]">
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={(e) => setIsBillable(e.target.checked)}
                  className="accent-[#4BA8A8]"
                />
                Billable
              </label>
              <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-lg p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDeductFromRetainer(false)}
                  className={`px-3 py-1 rounded-md transition-colors ${!deductFromRetainer ? 'bg-[#4BA8A8] text-white' : 'text-[#86868B]'}`}
                >
                  Hourly
                </button>
                <button
                  type="button"
                  onClick={() => setDeductFromRetainer(true)}
                  className={`px-3 py-1 rounded-md transition-colors ${deductFromRetainer ? 'bg-[#E67E22] text-white' : 'text-[#86868B]'}`}
                >
                  Retainer
                </button>
              </div>
            </div>
            {type !== 'maintenance' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#86868B]">Schedule:</span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-white rounded-lg border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
              </div>
            )}
          </div>

          {/* Line Items */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
              Line Items
            </label>
            <div className="mt-1.5 space-y-2">
              {lineItems.map((li, i) => (
                <div key={li.id} className="bg-white rounded-xl p-3 border border-[#E5E5EA]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={li.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      placeholder="Description"
                      className="flex-1 text-sm text-[#1A1A2E] bg-transparent focus:outline-none"
                    />
                    <button
                      onClick={() => removeLineItem(i)}
                      className="text-[#86868B] hover:text-red-500 text-sm"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1 text-xs text-[#86868B]">
                      Hours:
                      <input
                        type="number"
                        value={li.hours}
                        onChange={(e) => updateLineItem(i, 'hours', e.target.value)}
                        step="0.5"
                        min="0"
                        className="w-16 px-2 py-1 bg-[#F2F2F7] rounded text-sm font-medium text-[#1A1A2E] focus:outline-none"
                      />
                    </label>
                    <span className="text-sm font-semibold text-[#1A1A2E] ml-auto">
                      {formatCurrency(li.cost)}
                    </span>
                  </div>
                </div>
              ))}
              <button
                onClick={addLineItem}
                className="w-full py-2.5 text-sm font-medium text-[#4BA8A8] hover:bg-[#4BA8A8]/5 rounded-xl transition-colors"
              >
                + Add Line Item
              </button>
            </div>
          </div>

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="flex justify-between items-center bg-white rounded-xl p-4 border border-[#E5E5EA]">
              <div>
                <div className="text-xs text-[#86868B]">Total</div>
                <div className="text-lg font-extrabold text-[#1A1A2E]">
                  {totalHours.toFixed(1)} hrs
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#86868B]">
                  @ {formatCurrency(hourlyRate)}/hr
                </div>
                <div className="text-xl font-extrabold text-[#4BA8A8]">
                  {formatCurrency(totalCost)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[#E5E5EA]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E5E5EA] text-sm font-medium text-[#86868B] hover:bg-[#F2F2F7] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 py-2.5 rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
