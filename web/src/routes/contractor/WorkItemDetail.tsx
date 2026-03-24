import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WorkItem, Client, LineItem, RecurrenceFrequency } from '../../lib/types';
import { RECURRENCE_LABELS } from '../../lib/types';
import { StatusBadge } from '../../components/StatusBadge';
import { TypeTag } from '../../components/TypeTag';
import { formatCurrency, formatDate, addBusinessDays } from '../../lib/utils';
import {
  updateWorkItem,
  archiveWorkItem,
  updateInvoiceStatus,
} from '../../services/firestore';
import { buildChangeOrderPdf } from '../../lib/buildPdf';

interface WorkItemDetailProps {
  workItems: WorkItem[];
  clients: Client[];
  hourlyRate: number;
}

export default function WorkItemDetail({
  workItems,
  clients,
  hourlyRate,
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
    await updateWorkItem(item!);
    setSaving(false);
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
      });
      setPreviewUrl(blobUrl);
      setShowPdfPreview(true);
    } catch (err) {
      console.error('PDF generation error:', err);
    }
    setGeneratingPdf(false);
  }

  async function handleDiscard() {
    if (!confirm('Archive this work order?')) return;
    await archiveWorkItem(item!.id!);
    navigate('/dashboard/work-items');
  }

  async function handleMarkComplete() {
    if (!item!.id) return;
    const updated = { ...item!, status: 'completed' as const };
    await updateWorkItem(updated);
    setItem(updated);
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
        <div className="flex justify-between items-center border-t border-[var(--border)] pt-2">
          <span className="font-bold text-[var(--text-primary)]">Total Cost</span>
          <span className="text-xl font-extrabold text-[var(--accent)]">
            {formatCurrency(item.totalCost)}
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

      {/* ── Email Actions ── */}
      {client?.email && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {/* Send Work Order */}
          <button
            onClick={() => navigate(`/dashboard/work-items/${item.id}/email/completion`)}
            className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-left transition-all hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/5"
          >
            <div className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide mb-1">
              Work Order
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Send to Client
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Compose &amp; send work order details
            </div>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity text-lg">
              →
            </span>
          </button>

          {/* Send Invoice */}
          <button
            onClick={() => navigate(`/dashboard/work-items/${item.id}/email/invoice`)}
            className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-left transition-all hover:border-[var(--color-orange)] hover:shadow-lg hover:shadow-[var(--color-orange)]/5"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[var(--color-orange)] uppercase tracking-wide mb-1">
                Invoice
              </div>
              {item.invoiceStatus && item.invoiceStatus !== 'draft' && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  item.invoiceStatus === 'paid'
                    ? 'bg-[var(--color-green)]/15 text-[var(--color-green)]'
                    : item.invoiceStatus === 'overdue'
                    ? 'bg-[var(--color-red)]/15 text-[var(--color-red)]'
                    : 'bg-[var(--color-orange)]/15 text-[var(--color-orange)]'
                }`}>
                  {item.invoiceStatus === 'sent' ? 'Sent' : item.invoiceStatus === 'paid' ? 'Paid' : 'Overdue'}
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {item.invoiceStatus === 'sent' || item.invoiceStatus === 'overdue' ? 'Resend Invoice' : 'Send Invoice'}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              {item.invoiceStatus === 'paid'
                ? `Paid ${item.invoicePaidDate ? formatDate(item.invoicePaidDate) : ''}`
                : item.invoiceStatus === 'sent'
                ? `Due ${item.invoiceDueDate ? formatDate(item.invoiceDueDate) : ''}`
                : item.invoiceStatus === 'overdue'
                ? `${item.invoiceDueDate ? Math.ceil((Date.now() - item.invoiceDueDate.getTime()) / 86400000) : 0} days overdue`
                : 'Compose & send invoice email'}
            </div>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-orange)] opacity-0 group-hover:opacity-100 transition-opacity text-lg">
              →
            </span>
          </button>
        </div>
      )}

      {/* ── Invoice Status Actions ── */}
      {(item.invoiceStatus === 'sent' || item.invoiceStatus === 'overdue') && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={async () => {
              if (!item.id) return;
              const now = new Date();
              await updateInvoiceStatus(item.id, { invoiceStatus: 'paid', invoicePaidDate: now });
              setItem({ ...item, invoiceStatus: 'paid', invoicePaidDate: now });
            }}
            className="px-4 py-2 rounded-lg bg-[var(--color-green)]/10 text-[var(--color-green)] text-xs font-semibold hover:bg-[var(--color-green)]/20 transition-colors"
          >
            Mark as Paid
          </button>
          {item.invoiceStatus === 'sent' && (
            <button
              onClick={async () => {
                if (!item.id) return;
                await updateInvoiceStatus(item.id, { invoiceStatus: 'overdue' });
                setItem({ ...item, invoiceStatus: 'overdue' });
              }}
              className="px-4 py-2 rounded-lg bg-[var(--color-red)]/10 text-[var(--color-red)] text-xs font-semibold hover:bg-[var(--color-red)]/20 transition-colors"
            >
              Mark Overdue
            </button>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="py-2.5 px-5 rounded-lg border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {item.status !== 'completed' && item.status !== 'archived' && (
          <button
            onClick={handleApproveAndGenerate}
            disabled={generatingPdf}
            className="py-2.5 px-5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
          >
            {generatingPdf ? 'Generating...' : 'Approve & Generate PDF'}
          </button>
        )}
        {item.status === 'approved' && !generatingPdf && (
          <button
            onClick={async () => {
              if (!client) return;
              const blobUrl = await buildChangeOrderPdf(item, client, {
                companyName: 'DW Tailored',
                hourlyRate,
              });
              setPreviewUrl(blobUrl);
              setShowPdfPreview(true);
            }}
            className="py-2.5 px-5 rounded-lg border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
          >
            View PDF
          </button>
        )}
        {item.status !== 'completed' && item.status !== 'archived' && (
          <button
            onClick={handleMarkComplete}
            className="py-2.5 px-5 rounded-lg bg-[var(--color-green)] text-white text-sm font-semibold hover:brightness-110 transition-all"
          >
            Complete
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleDiscard}
          className="py-2.5 px-4 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--color-red)]/5 transition-colors"
        >
          Discard
        </button>
      </div>

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
