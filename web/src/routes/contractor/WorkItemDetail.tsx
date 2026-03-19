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
      <div className="text-center py-20 text-[#86868B]">Work item not found.</div>
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

  function handleSendToClient() {
    if (!client?.email) return;
    try {
      const portalUrl = `https://openchanges.web.app/portal/${item!.id}`;
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
        `Please review and approve this work order at the link below:\n\n` +
        `${portalUrl}\n\n\n` +
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
        className="text-sm text-[#86868B] hover:text-[#1A1A2E] mb-4"
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
        <div className="flex gap-4 mt-3">
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
          <span className={`text-xs font-medium ${item.deductFromRetainer ? 'text-[#E67E22]' : 'text-[#4BA8A8]'}`}>
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
        <div className="bg-white rounded-xl border border-[#E5E5EA] mb-4 overflow-hidden">
          <button
            onClick={() => setShowEmail(!showEmail)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-[#4BA8A8]">✉</span>
              <span className="text-sm font-semibold text-[#1A1A2E]">Original Email</span>
            </div>
            <span className="text-xs text-[#86868B]">{showEmail ? '▲' : '▼'}</span>
          </button>
          {showEmail && (
            <div className="px-4 pb-4 border-t border-[#F5F5F7]">
              <p className="text-sm text-[#86868B] whitespace-pre-wrap mt-3">
                {item.sourceEmail}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-[#1A1A2E] uppercase tracking-wide">
            Line Items
          </h2>
          <button
            onClick={addLineItem}
            className="text-xs font-semibold text-[#4BA8A8] hover:underline"
          >
            + Add Item
          </button>
        </div>
        <div className="space-y-3">
          {item.lineItems.map((li, i) => (
            <div key={li.id} className="flex gap-3 items-start">
              <span className="text-xs font-semibold text-[#86868B] mt-2 w-5 text-right">
                {i + 1}.
              </span>
              <div className="flex-1 space-y-2">
                <textarea
                  value={li.description}
                  onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                  placeholder="Description"
                  rows={1}
                  className="w-full px-3 py-2 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] resize-none focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
                <div className="flex items-center gap-4">
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
                  <span className="text-xs text-[#86868B]">
                    Cost: <span className="font-semibold text-[#1A1A2E]">{formatCurrency(li.cost)}</span>
                  </span>
                  <button
                    onClick={() => removeLineItem(i)}
                    className="ml-auto text-xs text-red-400 hover:text-red-600"
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
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-4 mb-4">
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
                value={item.estimatedBusinessDays ?? ''}
                placeholder="e.g. 5"
                onChange={(e) =>
                  setItem({
                    ...item!,
                    estimatedBusinessDays: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full mt-1 px-3 py-2 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
              />
              {item.estimatedBusinessDays && !item.scheduledDate && (
                <p className="text-xs text-[#86868B] mt-1">
                  Scheduled on approval: {formatDate(addBusinessDays(new Date(), item.estimatedBusinessDays))}
                </p>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
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
                className="w-full mt-1 px-3 py-2 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
              />
              {item.scheduledDate && item.estimatedBusinessDays && (
                <p className="text-xs text-[#86868B] mt-1">
                  Set by {item.estimatedBusinessDays} business day estimate
                </p>
              )}
            </div>
          </div>
          {/* Recurrence (maintenance) */}
          {item.type === 'maintenance' && (
            <div>
              <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
                Repeat
              </label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setItem({ ...item!, recurrence: undefined })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!item.recurrence ? 'bg-[#1A1A2E] text-white' : 'bg-[#F2F2F7] text-[#86868B]'}`}
                >
                  None
                </button>
                {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).filter((f) => f !== 'custom').map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setItem({ ...item!, recurrence: { frequency: freq } })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${item.recurrence?.frequency === freq ? 'bg-[#E67E22] text-white' : 'bg-[#F2F2F7] text-[#86868B]'}`}
                  >
                    {RECURRENCE_LABELS[freq]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setItem({ ...item!, recurrence: { frequency: 'custom', customDays: item.recurrence?.customDays ?? 3 } })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${item.recurrence?.frequency === 'custom' ? 'bg-[#E67E22] text-white' : 'bg-[#F2F2F7] text-[#86868B]'}`}
                >
                  Custom
                </button>
              </div>
              {item.recurrence?.frequency === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-[#86868B]">Every</span>
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
                    className="w-16 px-2 py-1.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] text-center focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                  />
                  <span className="text-xs text-[#86868B]">days</span>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
              Billing Type
            </label>
            <div className="flex items-center gap-1 mt-1 bg-[#F2F2F7] rounded-lg p-0.5 text-xs font-semibold w-fit">
              <button
                type="button"
                onClick={() => setItem({ ...item!, deductFromRetainer: false })}
                className={`px-4 py-1.5 rounded-md transition-colors ${!item.deductFromRetainer ? 'bg-[#4BA8A8] text-white' : 'text-[#86868B]'}`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setItem({ ...item!, deductFromRetainer: true })}
                className={`px-4 py-1.5 rounded-md transition-colors ${item.deductFromRetainer ? 'bg-[#E67E22] text-white' : 'text-[#86868B]'}`}
              >
                Retainer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-xl border border-[#E5E5EA] p-5 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-[#86868B]">Total Hours</span>
          <span className="text-sm font-semibold">{item.totalHours.toFixed(1)} hrs</span>
        </div>
        <div className="flex justify-between items-center mb-2 border-t border-[#F5F5F7] pt-2">
          <span className="text-sm text-[#86868B]">Hourly Rate</span>
          <span className="text-sm font-semibold">{formatCurrency(hourlyRate)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-[#F5F5F7] pt-2">
          <span className="font-bold text-[#1A1A2E]">Total Cost</span>
          <span className="text-xl font-extrabold text-[#4BA8A8]">
            {formatCurrency(item.totalCost)}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-[#F5F5F7] pt-2 mt-2">
          {item.deductFromRetainer ? (
            <>
              <span className="text-sm text-[#E67E22] font-medium">Retainer Deduction</span>
              <span className="text-sm font-semibold text-[#E67E22]">
                -{item.totalHours.toFixed(1)} hrs
              </span>
            </>
          ) : (
            <>
              <span className="text-sm text-[#4BA8A8] font-medium">Billing</span>
              <span className="text-sm font-semibold text-[#4BA8A8]">Hourly</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDiscard}
          className="flex-1 py-3 rounded-xl border border-[#E5E5EA] text-sm font-medium text-[#86868B] hover:bg-[#F2F2F7] transition-colors"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="py-3 px-6 rounded-xl border border-[#4BA8A8] text-sm font-semibold text-[#4BA8A8] hover:bg-[#4BA8A8]/5 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleApproveAndGenerate}
          disabled={generatingPdf}
          className="flex-1 py-3 rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 transition-colors"
        >
          {generatingPdf ? 'Generating...' : 'Approve & Generate PDF'}
        </button>
      </div>

      {/* View PDF */}
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
          className="w-full mt-3 py-3 rounded-xl border border-[#4BA8A8] text-sm font-semibold text-[#4BA8A8] hover:bg-[#4BA8A8]/5 transition-colors"
        >
          View PDF
        </button>
      )}

      {/* Send to Client */}
      {client?.email && (
        <button
          onClick={handleSendToClient}
          className="w-full mt-3 py-3 rounded-xl border border-[#E5E5EA] text-sm font-medium text-[#1A1A2E] hover:bg-[#F2F2F7] transition-colors"
        >
          Send to Client →
        </button>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col mx-4">
            <div className="flex items-center justify-between p-4 border-b border-[#F5F5F7]">
              <h3 className="text-sm font-bold text-[#1A1A2E]">Change Order Preview</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download={`change-order-${item.id}.pdf`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4BA8A8] border border-[#4BA8A8] hover:bg-[#4BA8A8]/5 transition-colors"
                >
                  Download PDF
                </a>
                <button
                  onClick={() => {
                    setShowPdfPreview(false);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#86868B] hover:bg-[#F2F2F7] transition-colors"
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
