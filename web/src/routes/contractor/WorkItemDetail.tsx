import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WorkItem, Client, App, RecurrenceFrequency, TimeEntry } from '../../lib/types';
import { RECURRENCE_LABELS } from '../../lib/types';
import { StatusBadge } from '../../components/workitems/StatusBadge';
import { TypeTag } from '../../components/workitems/TypeTag';
import { LineItemRow } from '../../components/workitems/LineItemRow';
import { TimeEntryLinkPicker } from '../../components/time/TimeEntryLinkPicker';
import { ManualTimeEntryModal } from '../../components/time/ManualTimeEntryModal';
import { formatCurrency, formatDate, addBusinessDays, paymentTermsToDays, cn } from '../../lib/utils';
import {
  computeLineItemHours,
  computeLineItemCost,
} from '../../lib/timeComputation';
import {
  updateWorkItem,
  discardWorkItem,
  updateInvoiceStatus,
  unlinkTimeEntriesForLineItem,
} from '../../services/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { buildChangeOrderPdf } from '../../lib/buildPdf';
import { IconClose } from '../../components/icons';

interface WorkItemDetailProps {
  workItems: WorkItem[];
  clients: Client[];
  apps: App[];
  hourlyRate: number;
  paymentTerms?: string;
  taxRate?: number;
  pdfLogoUrl?: string;
  invoiceFromAddress?: string;
  invoiceTerms?: string;
  invoiceNotes?: string;
  timeEntries: TimeEntry[];
  roundTimeToQuarterHour?: boolean;
}

export default function WorkItemDetail({
  workItems,
  clients,
  apps,
  hourlyRate,
  paymentTerms,
  taxRate,
  pdfLogoUrl,
  invoiceFromAddress,
  invoiceTerms,
  invoiceNotes,
  timeEntries,
  roundTimeToQuarterHour,
}: WorkItemDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const source = workItems.find((i) => i.id === id);
  const [item, setItem] = useState<WorkItem | null>(null);
  const [showEmail, setShowEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [linkPickerLineItemId, setLinkPickerLineItemId] = useState<string | null>(null);
  const [manualEntryLineItemId, setManualEntryLineItemId] = useState<string | null>(null);

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
  const availableApps = apps.filter((a) => a.clientId === item.clientId);
  const linkedApp = apps.find((a) => a.id === item.appId);

  const liveTotalHours = item.lineItems.reduce(
    (s, li) => s + computeLineItemHours(timeEntries, li.id, roundTimeToQuarterHour ?? false),
    0
  );
  const liveTotalCost = item.lineItems.reduce((s, li) => {
    const hours = computeLineItemHours(timeEntries, li.id, roundTimeToQuarterHour ?? false);
    return s + computeLineItemCost(hours, hourlyRate);
  }, 0);

  function addLineItem() {
    const updated = [
      ...item!.lineItems,
      { id: crypto.randomUUID(), description: '', hours: 0, cost: 0 },
    ];
    setItem({ ...item!, lineItems: updated });
  }

  async function removeLineItem(index: number) {
    const li = item!.lineItems[index];
    const linkedCount = timeEntries.filter((te) => te.lineItemId === li.id).length;

    if (linkedCount > 0) {
      const confirmed = window.confirm(
        `This line item has ${linkedCount} linked time entr${linkedCount === 1 ? 'y' : 'ies'}. Deleting it will unlink them. Continue?`
      );
      if (!confirmed) return;
      await unlinkTimeEntriesForLineItem(timeEntries, li.id);
    }

    const updated = item!.lineItems.filter((_, i) => i !== index);
    const totalHours = updated.reduce((s, ul) => {
      return s + computeLineItemHours(timeEntries, ul.id, roundTimeToQuarterHour ?? false);
    }, 0);
    const totalCost = updated.reduce((s, ul) => {
      const hours = computeLineItemHours(timeEntries, ul.id, roundTimeToQuarterHour ?? false);
      return s + computeLineItemCost(hours, hourlyRate);
    }, 0);
    setItem({ ...item!, lineItems: updated, totalHours, totalCost });
  }

  function buildSnapshotItem(): WorkItem {
    const updatedLineItems = item!.lineItems.map((li) => {
      const hours = computeLineItemHours(timeEntries, li.id, roundTimeToQuarterHour ?? false);
      const cost = computeLineItemCost(hours, hourlyRate);
      // Strip any legacy overrides so persisted data reflects
      // the time-only model.
      const { hoursOverride: _ho, costOverride: _co, ...rest } = li;
      void _ho; void _co;
      return { ...rest, hours, cost };
    });
    const totalHours = updatedLineItems.reduce((s, li) => s + li.hours, 0);
    const totalCost = updatedLineItems.reduce((s, li) => s + li.cost, 0);
    return { ...item!, lineItems: updatedLineItems, totalHours, totalCost };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const snapshot = buildSnapshotItem();
      await updateWorkItem(snapshot);
      setItem(snapshot);
    } catch (err) {
      console.error('Failed to save work item:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAndGenerate() {
    setGeneratingPdf(true);
    try {
      const scheduled = item!.estimatedBusinessDays
        ? addBusinessDays(new Date(), item!.estimatedBusinessDays)
        : item!.scheduledDate;
      const base = buildSnapshotItem();
      const snapshot = { ...base, status: 'approved' as const, scheduledDate: scheduled };

      await updateWorkItem(snapshot);
      setItem(snapshot);

      const pdfClient = client || {
        name: item!.senderName || 'Unknown',
        email: item!.senderEmail || '',
        createdAt: new Date(),
      };
      const blobUrl = await buildChangeOrderPdf(snapshot, pdfClient, {
        companyName: 'Your Company',
        hourlyRate,
        taxRate,
        pdfLogoUrl,
        invoiceFromAddress,
        invoiceTerms,
        invoiceNotes,
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

  async function handleMarkComplete() {
    if (!item!.id) return;
    const updated = { ...item!, status: 'completed' as const };
    await updateWorkItem(updated);
    setItem(updated);
  }

  async function handleSendToClient() {
    if (!item?.id) return;

    // Use original sender email if available (from forwarded emails), else client email
    const recipientEmail = item.senderEmail || client?.email;
    const recipientName = item.senderName || client?.name || '';
    if (!recipientEmail) return;

    try {
      // Generate a magic link — use client if assigned, otherwise create for sender
      const linkEmail = client?.email || recipientEmail;
      const linkClientId = client?.id || 'unassigned';

      const gen = httpsCallable<
        { clientId: string; email: string; workItemId: string },
        { token: string }
      >(functions, 'generateMagicLink');
      const { data: { token } } = await gen({
        clientId: linkClientId,
        email: linkEmail,
        workItemId: item.id,
      });

      const portalLink = `${window.location.origin}/portal/auth?token=${token}`;

      const subject = encodeURIComponent(
        `Invoice: ${item.subject}`
      );

      const snapshot = buildSnapshotItem();
      const lineItemsBlock = snapshot.lineItems
        .map(
          (li, i) =>
            `  ${i + 1}. ${li.description || '(no description)'}\n` +
            `     Hours: ${li.hours.toFixed(1)}  |  Cost: ${formatCurrency(li.cost)}`
        )
        .join('\n\n');

      const billingNote = item.deductFromRetainer
        ? `\nBilling: ${snapshot.totalHours.toFixed(1)} hours will be deducted from your retainer balance.\n`
        : '';

      const body = encodeURIComponent(
        `Hello ${recipientName || 'there'},\n\n` +
        `A new work order is ready for your review.\n\n` +
        `————————————————————————————————\n` +
        `WORK ORDER SUMMARY\n` +
        `————————————————————————————————\n\n` +
        `Subject:  ${item.subject}\n` +
        `Type:     ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}\n\n` +
        `Line Items:\n\n` +
        `${lineItemsBlock}\n\n` +
        `————————————————————————————————\n` +
        `Total Hours:  ${snapshot.totalHours.toFixed(1)} hrs\n` +
        `Total Cost:   ${formatCurrency(snapshot.totalCost)}\n` +
        `————————————————————————————————\n` +
        `${billingNote}\n` +
        `Review and approve this work order:\n` +
        `${portalLink}\n\n` +
        `This link expires in 7 days. Reply to this email with any questions.\n\n\n` +
        `Thank you for your business.\n\n` +
        `Best regards`
      );
      window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`, '_self');
    } catch (err) {
      console.error('Send to client error:', err);
    }
  }

  const labelClass = 'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5';
  const inputClass = 'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all';

  return (
    <div className="w-full">
      <button
        onClick={() => navigate('/dashboard/work-items')}
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
      >
        ← Back to Work Orders
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#1A1A2E] to-[#444] rounded-2xl p-5 mb-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <select
              value={item.clientId}
              onChange={(e) => setItem({ ...item, clientId: e.target.value, appId: undefined })}
              className="text-sm text-white/70 bg-transparent border-none outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-4 -ml-1 px-1 rounded focus:ring-1 focus:ring-[var(--accent)]"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'rgba(255,255,255,0.5)\' fill=\'none\' stroke-width=\'1.5\' stroke-linecap=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0 center' }}
            >
              <option value="" className="text-[var(--text-primary)] bg-[var(--bg-card)]">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="text-[var(--text-primary)] bg-[var(--bg-card)]">{c.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={item.subject}
              onChange={(e) => setItem({ ...item, subject: e.target.value })}
              className="text-xl font-bold text-white mt-1 bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-[var(--accent)] rounded px-1 -ml-1 placeholder:text-white/40"
              placeholder="Work order title"
            />
          </div>
          <StatusBadge status={item.status} />
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 items-center">
          <TypeTag type={item.type} />
          <span className="text-xs text-white/60">{formatDate(item.createdAt)}</span>
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
          {linkedApp && (
            <button
              onClick={() => navigate(`/dashboard/apps/${linkedApp.id}`)}
              className="text-xs text-[var(--accent)] hover:text-white transition-colors"
            >
              {linkedApp.name}
            </button>
          )}
        </div>

        {/* Quick toggles */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={async () => {
              const updated = { ...item!, completed: !item!.completed };
              setItem(updated);
              await updateWorkItem(updated);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              item.completed
                ? 'bg-[var(--color-green)]/20 text-[var(--color-green)]'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            )}
          >
            <span className={cn(
              'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
              item.completed ? 'bg-[var(--color-green)] border-[var(--color-green)]' : 'border-white/40'
            )}>
              {item.completed && <span className="text-white text-[10px] leading-none">✓</span>}
            </span>
            {item.completed ? 'Completed' : 'Mark Complete'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const newType = item.type === 'maintenance' ? 'changeRequest' : 'maintenance';
              const updated = { ...item, type: newType as WorkItem['type'] };
              setItem(updated);
              await updateWorkItem(updated);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              item.type === 'maintenance'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            )}
          >
            <span className={cn(
              'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
              item.type === 'maintenance' ? 'bg-blue-500 border-blue-500' : 'border-white/40'
            )}>
              {item.type === 'maintenance' && <span className="text-white text-[10px] leading-none">✓</span>}
            </span>
            Maintenance
          </button>
        </div>
      </div>

      {/* Original Email */}
      {(item.sourceEmail || item.sourceHtml || item.senderEmail) && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] mb-4 overflow-hidden">
          <button
            onClick={() => setShowEmail(!showEmail)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-[var(--accent)]">✉</span>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">Original Email</span>
                {item.senderEmail && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    From: {item.senderName ? `${item.senderName} <${item.senderEmail}>` : item.senderEmail}
                  </p>
                )}
              </div>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">{showEmail ? '▲' : '▼'}</span>
          </button>
          {showEmail && (
            <div className="px-4 pb-4 border-t border-[var(--border)]">
              {item.sourceHtml ? (
                <iframe
                  srcDoc={item.sourceHtml}
                  sandbox=""
                  title="Original email"
                  className="w-full min-h-[300px] border-0 rounded bg-white mt-3"
                  style={{ colorScheme: 'light' }}
                />
              ) : (
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-3">
                  {item.sourceEmail}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Line Items */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Line Items
          </h2>
          <button
            onClick={addLineItem}
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            + Add Item
          </button>
        </div>
        <div>
          {item.lineItems.map((li, index) => (
            <LineItemRow
              key={li.id}
              lineItem={li}
              workItemId={item.id!}
              clientId={item.clientId}
              appId={item.appId}
              timeEntries={timeEntries}
              hourlyRate={hourlyRate}
              roundToQuarter={roundTimeToQuarterHour ?? false}
              onDescriptionChange={(desc) => {
                const updated = [...item.lineItems];
                updated[index] = { ...updated[index], description: desc };
                setItem({ ...item, lineItems: updated });
              }}
              onRemove={() => removeLineItem(index)}
              onLinkEntries={() => setLinkPickerLineItemId(li.id)}
              onAddManualEntry={() => setManualEntryLineItemId(li.id)}
            />
          ))}
        </div>
      </div>

      {linkPickerLineItemId && (
        <TimeEntryLinkPicker
          timeEntries={timeEntries}
          clientId={item.clientId}
          workItemId={item.id!}
          lineItemId={linkPickerLineItemId}
          onClose={() => setLinkPickerLineItemId(null)}
        />
      )}

      {manualEntryLineItemId && (
        <ManualTimeEntryModal
          clientId={item.clientId}
          workItemId={item.id!}
          lineItemId={manualEntryLineItemId}
          appId={item.appId}
          defaultDescription={
            item.lineItems.find((li) => li.id === manualEntryLineItemId)?.description
          }
          onClose={() => setManualEntryLineItemId(null)}
        />
      )}

      {/* Schedule, App & Billing */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-4 space-y-5">

        {/* App selector */}
        {availableApps.length > 0 && (
          <div>
            <label className={labelClass}>Linked App</label>
            <select
              value={item.appId ?? ''}
              onChange={(e) => setItem({ ...item, appId: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">None</option>
              {availableApps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Business Days + Scheduled Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Business Days</label>
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
              className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
            />
            {item.estimatedBusinessDays && !item.scheduledDate && (
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                On approval: {formatDate(addBusinessDays(new Date(), item.estimatedBusinessDays))}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Scheduled Date</label>
            <input
              type="date"
              value={item.scheduledDate ? item.scheduledDate.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                setItem({
                  ...item!,
                  scheduledDate: e.target.value ? new Date(e.target.value) : undefined,
                })
              }
              className={inputClass}
            />
          </div>
        </div>

        {/* Repeat + Billing — side by side */}
        <div className={cn('grid gap-3', item.type === 'maintenance' ? 'grid-cols-2' : 'grid-cols-1')}>
          {/* Recurrence (maintenance only) */}
          {item.type === 'maintenance' && (
            <div>
              <label className={labelClass}>Repeat</label>
              <select
                value={item.recurrence?.frequency ?? ''}
                onChange={(e) => {
                  const freq = e.target.value as RecurrenceFrequency | '';
                  if (!freq) {
                    setItem({ ...item!, recurrence: undefined });
                  } else if (freq === 'custom') {
                    setItem({ ...item!, recurrence: { frequency: 'custom', customDays: item.recurrence?.customDays ?? 3 } });
                  } else {
                    setItem({ ...item!, recurrence: { frequency: freq } });
                  }
                }}
                className={inputClass}
              >
                <option value="">None</option>
                {(Object.keys(RECURRENCE_LABELS) as RecurrenceFrequency[]).map((freq) => (
                  <option key={freq} value={freq}>{RECURRENCE_LABELS[freq]}</option>
                ))}
              </select>
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
                    className="w-16 h-8 px-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] text-center outline-none focus:border-[var(--color-orange)]"
                  />
                  <span className="text-xs text-[var(--text-secondary)]">days</span>
                </div>
              )}
            </div>
          )}

          {/* Billing Type */}
          <div>
            <label className={labelClass}>Billing</label>
            <div className="flex gap-1 bg-[var(--bg-input)] rounded-xl p-1 h-10 items-center">
              <button
                type="button"
                onClick={() => setItem({ ...item!, deductFromRetainer: false })}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                  !item.deductFromRetainer
                    ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setItem({ ...item!, deductFromRetainer: true })}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                  item.deductFromRetainer
                    ? 'bg-[var(--bg-card)] text-[var(--color-orange)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                Retainer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-4">
        <div className="space-y-0">
          <div className="flex justify-between items-center py-2.5">
            <span className="text-sm text-[var(--text-secondary)]">Total Hours</span>
            <span className="text-sm font-semibold tabular-nums">{liveTotalHours.toFixed(1)} hrs</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-t border-[var(--border)]">
            <span className="text-sm text-[var(--text-secondary)]">Hourly Rate</span>
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(hourlyRate)}</span>
          </div>
          {taxRate != null && taxRate > 0 && (
            <div className="flex justify-between items-center py-2.5 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--text-secondary)]">Tax ({taxRate}%)</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(liveTotalCost * (taxRate / 100))}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 border-t border-[var(--border)]">
            <span className="font-bold text-[var(--text-primary)]">Total Cost</span>
            <span className="text-xl font-extrabold text-[var(--accent)] tabular-nums">
              {formatCurrency(
                taxRate != null && taxRate > 0
                  ? liveTotalCost + liveTotalCost * (taxRate / 100)
                  : liveTotalCost
              )}
            </span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-t border-[var(--border)]">
            {item.deductFromRetainer ? (
              <>
                <span className="text-sm text-[var(--color-orange)] font-medium">Retainer Deduction</span>
                <span className="text-sm font-semibold text-[var(--color-orange)] tabular-nums">-{liveTotalHours.toFixed(1)} hrs</span>
              </>
            ) : (
              <>
                <span className="text-sm text-[var(--accent)] font-medium">Billing</span>
                <span className="text-sm font-semibold text-[var(--accent)]">Hourly</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Tracking */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-4">
        <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Invoice
        </h2>

        {/* Draft / No invoice */}
        {(!item.invoiceStatus || item.invoiceStatus === 'draft') && (
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-gray)]/20 text-[var(--color-gray)]">
              {item.invoiceStatus === 'draft' ? 'Draft' : 'No Invoice'}
            </span>
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
                setItem({ ...item, invoiceStatus: 'sent', invoiceSentDate: now, invoiceDueDate: due });
              }}
              className="h-10 px-5 rounded-xl bg-[var(--color-orange)] text-white text-xs font-bold hover:brightness-110 transition-all"
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
                {item.invoiceSentDate ? formatDate(item.invoiceSentDate) : '—'}
              </span>
            </div>
            <div className="text-sm text-[var(--text-secondary)] mb-3">
              Due: {item.invoiceDueDate ? formatDate(item.invoiceDueDate) : '—'}
              {item.invoiceDueDate && (
                <span className="ml-1">
                  ({Math.max(0, Math.ceil((item.invoiceDueDate.getTime() - Date.now()) / 86400000))} days left)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!item.id) return;
                  const now = new Date();
                  await updateInvoiceStatus(item.id, { invoiceStatus: 'paid', invoicePaidDate: now });
                  setItem({ ...item, invoiceStatus: 'paid', invoicePaidDate: now });
                }}
                className="h-10 px-5 rounded-xl bg-[var(--color-green)] text-white text-xs font-bold hover:brightness-110 transition-all"
              >
                Mark as Paid
              </button>
              <button
                onClick={async () => {
                  if (!item.id) return;
                  await updateInvoiceStatus(item.id, { invoiceStatus: 'overdue' });
                  setItem({ ...item, invoiceStatus: 'overdue' });
                }}
                className="h-10 px-5 rounded-xl border border-[var(--color-red)] text-[var(--color-red)] text-xs font-bold hover:bg-[var(--color-red)]/5 transition-colors"
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
                {item.invoicePaidDate ? formatDate(item.invoicePaidDate) : '—'}
              </span>
            </div>
            <span className="text-xl font-extrabold text-[var(--color-green)] tabular-nums">
              {formatCurrency(item.totalCost)}
            </span>
          </div>
        )}

        {/* Overdue */}
        {item.invoiceStatus === 'overdue' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-red)]/20 text-[var(--color-red)]">
                Overdue
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                {item.invoiceDueDate ? `${Math.ceil((Date.now() - item.invoiceDueDate.getTime()) / 86400000)} days overdue` : '—'}
              </span>
            </div>
            <button
              onClick={async () => {
                if (!item.id) return;
                const now = new Date();
                await updateInvoiceStatus(item.id, { invoiceStatus: 'paid', invoicePaidDate: now });
                setItem({ ...item, invoiceStatus: 'paid', invoicePaidDate: now });
              }}
              className="h-10 px-5 rounded-xl bg-[var(--color-green)] text-white text-xs font-bold hover:brightness-110 transition-all"
            >
              Mark as Paid
            </button>
          </div>
        )}
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

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <button
          onClick={handleDiscard}
          className="sm:flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-all"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 rounded-xl border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-40 transition-all active:scale-[0.98]"
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
        {item.status !== 'completed' && item.status !== 'archived' && (
          <button
            onClick={handleApproveAndGenerate}
            disabled={generatingPdf}
            className="sm:flex-1 h-11 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:bg-[var(--accent-dark)] disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            {generatingPdf ? 'Generating...' : 'Approve & Generate PDF'}
          </button>
        )}
        {item.status !== 'completed' && item.status !== 'archived' && (
          <button
            onClick={handleMarkComplete}
            className="sm:flex-1 h-11 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:brightness-110 transition-all"
          >
            Complete
          </button>
        )}
      </div>

      {/* View PDF */}
      {item.status === 'approved' && !generatingPdf && (
        <button
          onClick={async () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const pdfClient = client || {
              name: item.senderName || 'Unknown',
              email: item.senderEmail || '',
              createdAt: new Date(),
            };
            const blobUrl = await buildChangeOrderPdf(item, pdfClient, {
              companyName: 'Your Company',
              hourlyRate,
              taxRate,
              pdfLogoUrl,
              invoiceFromAddress,
              invoiceTerms,
              invoiceNotes,
            });
            setPreviewUrl(blobUrl);
            setShowPdfPreview(true);
          }}
          className="w-full h-11 rounded-xl border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all mb-3"
        >
          View PDF
        </button>
      )}

      {/* Send to Client */}
      {(client?.email || item.senderEmail) && (
        <button
          onClick={handleSendToClient}
          className="w-full h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-all mb-4"
        >
          Send to Client →
        </button>
      )}


      {/* PDF Preview Modal */}
      {showPdfPreview && previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl h-[90vh] sm:h-[85vh] flex flex-col sm:mx-4 animate-slide-up sm:animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Invoice Preview</h3>
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
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <IconClose size={18} />
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
