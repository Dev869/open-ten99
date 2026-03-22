import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WorkItem, Client, LineItem, RecurrenceFrequency } from '../../lib/types';
import { RECURRENCE_LABELS } from '../../lib/types';
import { StatusBadge } from '../../components/StatusBadge';
import { TypeTag } from '../../components/TypeTag';
import { formatCurrency, formatDate, addBusinessDays, paymentTermsToDays } from '../../lib/utils';
import {
  updateWorkItem,
  discardWorkItem,
  updateInvoiceStatus,
} from '../../services/firestore';
import { buildChangeOrderPdf } from '../../lib/buildPdf';

interface WorkItemDetailProps {
  workItems: WorkItem[];
  clients: Client[];
  hourlyRate: number;
  paymentTerms?: string;
  taxRate?: number;
  pdfLogoUrl?: string;
}

export default function WorkItemDetail({
  workItems,
  clients,
  hourlyRate,
  paymentTerms,
  taxRate,
  pdfLogoUrl,
}: WorkItemDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const source = workItems.find((i) => i.id === id);
  const [item, setItem] = useState<WorkItem | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (source) setItem({ ...source });
  }, [source]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  if (!item) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">Work item not found.</div>
    );
  }

  const client = clients.find((c) => c.id === item.clientId);

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...item!.lineItems];
    if (field === 'hours') {
      const hours = Number(value) || 0;
      updated[index] = { ...updated[index], hours, cost: hours * hourlyRate };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    const totalHours = updated.reduce((s, li) => s + li.hours, 0);
    const totalCost = updated.reduce((s, li) => s + li.cost, 0);
    setItem({ ...item!, lineItems: updated, totalHours, totalCost });
  }

  function addLineItem() {
    const updated = [
      ...item!.lineItems,
      { id: crypto.randomUUID(), description: '', hours: 0, cost: 0 },
    ];
    setItem({ ...item!, lineItems: updated });
  }

  function removeLineItem(index: number) {
    const updated = item!.lineItems.filter((_, i) => i !== index);
    const totalHours = updated.reduce((s, li) => s + li.hours, 0);
    const totalCost = updated.reduce((s, li) => s + li.cost, 0);
    setItem({ ...item!, lineItems: updated, totalHours, totalCost });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateWorkItem(item!);
    } catch (err) {
      console.error('Failed to save work item:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAndGenerate() {
    if (!client) return;
    setGeneratingPdf(true);
    try {
      const scheduled = item!.estimatedBusinessDays
        ? addBusinessDays(new Date(), item!.estimatedBusinessDays)
        : item!.scheduledDate;
      const updated = { ...item!, status: 'approved' as const, scheduledDate: scheduled };
      await updateWorkItem(updated);
      setItem(updated);
      const blobUrl = await buildChangeOrderPdf(updated, client, {
        companyName: 'DW Tailored',
        hourlyRate,
        taxRate,
        pdfLogoUrl,
      });
      setPreviewUrl(blobUrl);
      setShowPdfPreview(true);
    } catch (err) {
      console.error('PDF generation error:', err);
    }
    setGeneratingPdf(false);
  }

  async function handleDiscard() {
    if (!confirm('Discard this work order? It will be moved to trash and permanently deleted after 30 days.')) return;
    await discardWorkItem(item!.id!, item!.status);
    navigate('/dashboard/work-items');
  }

  function handleSendToClient() {
    if (!client?.email) return;
    try {
      const subject = encodeURIComponent(
        `DW Tailored Systems — Work Order: ${item!.subject}`
      );

      const lineItemsBlock = item!.lineItems
        .map(
          (li, i) =>
            `  ${i + 1}. ${li.description || '(no description)'}\n` +
            `     Hours: ${li.hours.toFixed(1)}  |  Cost: ${formatCurrency(li.cost)}`
        )
        .join('\n\n');

      const billingNote = item!.deductFromRetainer
        ? `\nBilling: ${item!.totalHours.toFixed(1)} hours will be deducted from your retainer balance.\n`
        : '';

      const body = encodeURIComponent(
        `Hello ${client.name},\n\n` +
        `A new work order from DW Tailored Systems is ready for your review.\n\n` +
        `————————————————————————————————\n` +
        `WORK ORDER SUMMARY\n` +
        `————————————————————————————————\n\n` +
        `Subject:  ${item!.subject}\n` +
        `Type:     ${item!.type.charAt(0).toUpperCase() + item!.type.slice(1)}\n\n` +
        `Line Items:\n\n` +
        `${lineItemsBlock}\n\n` +
        `————————————————————————————————\n` +
        `Total Hours:  ${item!.totalHours.toFixed(1)} hrs\n` +
        `Total Cost:   ${formatCurrency(item!.totalCost)}\n` +
        `————————————————————————————————\n` +
        `${billingNote}\n` +
        `Please reply to approve or request changes.\n\n\n` +
        `Thank you for choosing DW Tailored Systems.\n\n` +
        `Best regards,\n` +
        `DW Tailored Systems\n` +
        `https://dwtailored.com`
      );
      window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_self');
    } catch (err) {
      console.error('Send to client error:', err);
    }
  }

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/dashboard/work-items')}
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
      >
        ← Back to Work Items
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#1A1A2E] to-[#444] rounded-2xl p-6 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-white/70">{client?.name ?? 'Unknown Client'}</div>
            <h1 className="text-xl font-bold text-white mt-1">{item.subject}</h1>
          </div>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          <TypeTag type={item.type} />
          <span className="text-xs text-white/60">
            {formatDate(item.createdAt)}
          </span>
          {item.scheduledDate && (
            <span className="text-xs text-white/60">
              Scheduled: {formatDate(item.scheduledDate)}
            </span>
          )}
          {!item.isBillable && (
            <span className="text-xs text-white/60">Non-Billable</span>
          )}
          <span className={`text-xs font-medium ${item.deductFromRetainer ? 'text-[var(--color-orange)]' : 'text-[var(--accent)]'}`}>
            {item.deductFromRetainer ? 'Retainer' : 'Hourly'}
          </span>
          {item.recurrence && (
            <span className="text-xs text-white/60">
              {item.recurrence.frequency === 'custom' ? `Every ${item.recurrence.customDays} days` : RECURRENCE_LABELS[item.recurrence.frequency]}
            </span>
          )}
        </div>
      </div>

      {/* Original Email */}
      {item.sourceEmail && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] mb-4 overflow-hidden">
          <button
            onClick={() => setShowEmail(!showEmail)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-[var(--accent)]">✉</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">Original Email</span>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">{showEmail ? '▲' : '▼'}</span>
          </button>
          {showEmail && (
            <div className="px-4 pb-4 border-t border-[var(--border)]">
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-3">
                {item.sourceEmail}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Line Items */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
            Line Items
          </h2>
          <button
            onClick={addLineItem}
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            + Add Item
          </button>
        </div>
        <div className="space-y-3">
          {item.lineItems.map((li, i) => (
            <div key={li.id} className="flex gap-3 items-start">
              <span className="text-xs font-semibold text-[var(--text-secondary)] mt-2 w-5 text-right">
                {i + 1}.
              </span>
              <div className="flex-1 space-y-2">
                <textarea
                  value={li.description}
                  onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                  placeholder="Description"
                  rows={1}
                  className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
                  <span className="text-xs text-[var(--text-secondary)]">
                    Cost: <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(li.cost)}</span>
                  </span>
                  <button
                    onClick={() => removeLineItem(i)}
                    className="ml-auto text-xs text-[var(--color-red)]/70 hover:text-[var(--color-red)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule & Billing */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-4">
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                Business Days
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={item.estimatedBusinessDays ?? ''}
                placeholder="e.g. 5"
                onChange={(e) =>
                  setItem({
                    ...item!,
                    estimatedBusinessDays: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              {item.estimatedBusinessDays && !item.scheduledDate && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Scheduled on approval: {formatDate(addBusinessDays(new Date(), item.estimatedBusinessDays))}
                </p>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                Scheduled Date
              </label>
              <input
                type="date"
                value={item.scheduledDate ? item.scheduledDate.toISOString().split('T')[0] : ''}
                onChange={(e) =>
                  setItem({
                    ...item!,
                    scheduledDate: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
                className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              {item.scheduledDate && item.estimatedBusinessDays && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Set by {item.estimatedBusinessDays} business day estimate
                </p>
              )}
            </div>
          </div>
          {/* Recurrence (maintenance) */}
          {item.type === 'maintenance' && (
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                Repeat
              </label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setItem({ ...item!, recurrence: undefined })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!item.recurrence ? 'bg-[var(--text-primary)] text-[var(--bg-page)]' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'}`}
                >
                  None
                </button>
                {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).filter((f) => f !== 'custom').map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setItem({ ...item!, recurrence: { frequency: freq } })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${item.recurrence?.frequency === freq ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'}`}
                  >
                    {RECURRENCE_LABELS[freq]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setItem({ ...item!, recurrence: { frequency: 'custom', customDays: item.recurrence?.customDays ?? 3 } })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${item.recurrence?.frequency === 'custom' ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'}`}
                >
                  Custom
                </button>
              </div>
              {item.recurrence?.frequency === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-[var(--text-secondary)]">Every</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.recurrence.customDays ?? 3}
                    onChange={(e) =>
                      setItem({
                        ...item!,
                        recurrence: {
                          ...item!.recurrence!,
                          customDays: Math.max(1, Number(e.target.value) || 1),
                        },
                      })
                    }
                    className="w-16 px-2 py-1.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-orange)]"
                  />
                  <span className="text-xs text-[var(--text-secondary)]">days</span>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
              Billing Type
            </label>
            <div className="flex items-center gap-1 mt-1 bg-[var(--bg-input)] rounded-lg p-0.5 text-xs font-semibold w-fit">
              <button
                type="button"
                onClick={() => setItem({ ...item!, deductFromRetainer: false })}
                className={`px-4 py-1.5 rounded-md transition-colors ${!item.deductFromRetainer ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setItem({ ...item!, deductFromRetainer: true })}
                className={`px-4 py-1.5 rounded-md transition-colors ${item.deductFromRetainer ? 'bg-[var(--color-orange)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Retainer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-6">
        {/* Assignee */}
        {/* TODO: Enhance to show a member picker dropdown when team context is available */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-[var(--text-secondary)] text-sm">Assignee</span>
          <span className="text-[var(--text-primary)] text-sm">
            {item.assigneeId || 'Unassigned'}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2 border-t border-[var(--border)] pt-2">
          <span className="text-sm text-[var(--text-secondary)]">Total Hours</span>
          <span className="text-sm font-semibold">{item.totalHours.toFixed(1)} hrs</span>
        </div>
        <div className="flex justify-between items-center mb-2 border-t border-[var(--border)] pt-2">
          <span className="text-sm text-[var(--text-secondary)]">Hourly Rate</span>
          <span className="text-sm font-semibold">{formatCurrency(hourlyRate)}</span>
        </div>
        {taxRate != null && taxRate > 0 && (
          <div className="flex justify-between items-center mb-2 border-t border-[var(--border)] pt-2">
            <span className="text-sm text-[var(--text-secondary)]">Tax ({taxRate}%)</span>
            <span className="text-sm font-semibold">
              {formatCurrency(item.totalCost * (taxRate / 100))}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center border-t border-[var(--border)] pt-2">
          <span className="font-bold text-[var(--text-primary)]">Total Cost</span>
          <span className="text-xl font-extrabold text-[var(--accent)]">
            {formatCurrency(
              taxRate != null && taxRate > 0
                ? item.totalCost + item.totalCost * (taxRate / 100)
                : item.totalCost
            )}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-[var(--border)] pt-2 mt-2">
          {item.deductFromRetainer ? (
            <>
              <span className="text-sm text-[var(--color-orange)] font-medium">Retainer Deduction</span>
              <span className="text-sm font-semibold text-[var(--color-orange)]">
                -{item.totalHours.toFixed(1)} hrs
              </span>
            </>
          ) : (
            <>
              <span className="text-sm text-[var(--accent)] font-medium">Billing</span>
              <span className="text-sm font-semibold text-[var(--accent)]">Hourly</span>
            </>
          )}
        </div>
      </div>

      {/* Invoice Tracking */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-6">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Invoice
        </h2>

        {/* Draft / No invoice */}
        {(!item.invoiceStatus || item.invoiceStatus === 'draft') && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-gray)]/20 text-[var(--color-gray)]">
                {item.invoiceStatus === 'draft' ? 'Draft' : 'No Invoice'}
              </span>
            </div>
            <button
              onClick={async () => {
                if (!item.id) return;
                const now = new Date();
                const due = new Date(now);
                due.setDate(due.getDate() + paymentTermsToDays(paymentTerms));
                await updateInvoiceStatus(item.id, {
                  invoiceStatus: 'sent',
                  invoiceSentDate: now,
                  invoiceDueDate: due,
                });
                setItem({
                  ...item,
                  invoiceStatus: 'sent',
                  invoiceSentDate: now,
                  invoiceDueDate: due,
                });
              }}
              className="min-h-[44px] px-5 rounded-xl bg-[var(--color-orange)] text-white text-sm font-semibold hover:brightness-110 transition-all"
            >
              Mark as Invoiced
            </button>
          </div>
        )}

        {/* Sent */}
        {item.invoiceStatus === 'sent' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-orange)]/20 text-[var(--color-orange)]">
                Sent
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Sent: {item.invoiceSentDate ? formatDate(item.invoiceSentDate) : '—'}
              </span>
            </div>
            <div className="text-sm text-[var(--text-secondary)] mb-3">
              Due: {item.invoiceDueDate ? formatDate(item.invoiceDueDate) : '—'}
              {item.invoiceDueDate && (
                <span className="ml-1">
                  ({Math.max(0, Math.ceil((item.invoiceDueDate.getTime() - Date.now()) / 86400000))} days remaining)
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={async () => {
                  if (!item.id) return;
                  const now = new Date();
                  await updateInvoiceStatus(item.id, {
                    invoiceStatus: 'paid',
                    invoicePaidDate: now,
                  });
                  setItem({ ...item, invoiceStatus: 'paid', invoicePaidDate: now });
                }}
                className="min-h-[44px] px-5 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:brightness-110 transition-all"
              >
                Mark as Paid
              </button>
              <button
                onClick={async () => {
                  if (!item.id) return;
                  await updateInvoiceStatus(item.id, { invoiceStatus: 'overdue' });
                  setItem({ ...item, invoiceStatus: 'overdue' });
                }}
                className="min-h-[44px] px-5 rounded-xl border border-[var(--color-red)] text-[var(--color-red)] text-sm font-semibold hover:bg-[var(--color-red)]/5 transition-colors"
              >
                Mark Overdue
              </button>
            </div>
          </div>
        )}

        {/* Paid */}
        {item.invoiceStatus === 'paid' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-green)]/20 text-[var(--color-green)]">
                Paid
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Paid: {item.invoicePaidDate ? formatDate(item.invoicePaidDate) : '—'}
              </span>
            </div>
            <span className="text-xl font-extrabold text-[var(--color-green)]">
              {formatCurrency(item.totalCost)}
            </span>
          </div>
        )}

        {/* Overdue */}
        {item.invoiceStatus === 'overdue' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-500">
                Overdue
              </span>
              {item.invoiceDueDate && (
                <span className="text-sm font-semibold text-red-500">
                  {Math.ceil((Date.now() - item.invoiceDueDate.getTime()) / 86400000)} days overdue
                </span>
              )}
            </div>
            <div className="text-sm text-[var(--text-secondary)] mb-3">
              Due: {item.invoiceDueDate ? formatDate(item.invoiceDueDate) : '—'}
              {item.invoiceSentDate && (
                <span className="ml-2">Sent: {formatDate(item.invoiceSentDate)}</span>
              )}
            </div>
            <button
              onClick={async () => {
                if (!item.id) return;
                const now = new Date();
                await updateInvoiceStatus(item.id, {
                  invoiceStatus: 'paid',
                  invoicePaidDate: now,
                });
                setItem({ ...item, invoiceStatus: 'paid', invoicePaidDate: now });
              }}
              className="min-h-[44px] px-5 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:brightness-110 transition-all"
            >
              Mark as Paid
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDiscard}
          className="sm:flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="py-3 px-6 rounded-xl border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleApproveAndGenerate}
          disabled={generatingPdf}
          className="sm:flex-1 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors min-h-[44px]"
        >
          {generatingPdf ? 'Generating...' : 'Approve & Generate PDF'}
        </button>
      </div>

      {/* View PDF */}
      {item.status === 'approved' && !generatingPdf && (
        <button
          onClick={async () => {
            if (!client) return;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const blobUrl = await buildChangeOrderPdf(item, client, {
              companyName: 'DW Tailored',
              hourlyRate,
              taxRate,
            });
            setPreviewUrl(blobUrl);
            setShowPdfPreview(true);
          }}
          className="w-full mt-3 py-3 rounded-xl border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
        >
          View PDF
        </button>
      )}

      {/* Send to Client */}
      {client?.email && (
        <button
          onClick={handleSendToClient}
          className="w-full mt-3 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
        >
          Send to Client →
        </button>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl h-[90vh] sm:h-[85vh] flex flex-col sm:mx-4">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Change Order Preview</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download={`change-order-${item.id}.pdf`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
                >
                  Download PDF
                </a>
                <button
                  onClick={() => {
                    setShowPdfPreview(false);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={previewUrl}
                title="PDF Preview"
                className="w-full h-full rounded-b-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
