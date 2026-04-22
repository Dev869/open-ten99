import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import type { Client, LineItem, Quote, App, AppSettings } from '../../lib/types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../lib/types';
import {
  updateQuote,
  deleteQuote,
  markQuoteSent,
  convertQuoteToWorkItem,
  generateQuotePDF,
} from '../../services/firestore';
import { useQuotes } from '../../hooks/useFirestore';
import { formatCurrency } from '../../lib/utils';
import {
  IconPlus,
  IconTrash,
  IconSend,
  IconCheck,
  IconDocument,
  IconChevronRight,
} from '../../components/icons';

interface QuoteDetailProps {
  clients: Client[];
  apps: App[];
  settings: AppSettings;
}

export default function QuoteDetail({ clients, apps, settings }: QuoteDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { quotes, loading } = useQuotes();
  const remote = useMemo(() => quotes.find((q) => q.id === id), [quotes, id]);

  const [draft, setDraft] = useState<Quote | null>(null);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [busyAction, setBusyAction] = useState<null | 'send' | 'convert' | 'pdf' | 'delete'>(null);

  const hourlyRate = settings.hourlyRate || 150;

  // Hydrate local draft from remote on first load and when the doc id changes.
  useEffect(() => {
    if (remote && (!draft || draft.id !== remote.id)) {
      setDraft({ ...remote });
    }
  }, [remote, draft]);

  // Detect dirty state by comparing JSON snapshots — small docs, so this is cheap
  // and avoids per-field flag plumbing.
  const isDirty = useMemo(() => {
    if (!draft || !remote) return false;
    return JSON.stringify(serializeForCompare(draft)) !== JSON.stringify(serializeForCompare(remote));
  }, [draft, remote]);

  // Debounced auto-save when the draft is dirty.
  useEffect(() => {
    if (!draft || !isDirty) return;
    setSavingState('saving');
    const handle = window.setTimeout(async () => {
      try {
        await updateQuote(draft);
        setSavingState('saved');
        window.setTimeout(() => setSavingState('idle'), 1200);
      } catch (err) {
        console.error('Failed to save quote:', err);
        setSavingState('idle');
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [draft, isDirty]);

  if (loading && !remote) {
    return <div className="text-sm text-[var(--text-secondary)] py-12 text-center">Loading…</div>;
  }
  if (!remote || !draft) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-secondary)]">Quote not found.</p>
        <Link
          to="/dashboard/quotes"
          className="inline-block mt-3 text-sm text-[var(--accent)] hover:underline"
        >
          Back to quotes
        </Link>
      </div>
    );
  }

  const client = clients.find((c) => c.id === draft.clientId);
  const availableApps = apps.filter((a) => a.clientId === draft.clientId);

  function patch(p: Partial<Quote>) {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
  }

  function recomputeTotals(items: LineItem[]) {
    const totalHours = items.reduce((s, li) => s + (li.hours || 0), 0);
    const totalCost = items.reduce(
      (s, li) => s + (li.costOverride !== undefined ? li.costOverride : li.cost || 0),
      0,
    );
    return { totalHours, totalCost };
  }

  function addLineItem() {
    const next = [
      ...draft!.lineItems,
      { id: crypto.randomUUID(), description: '', hours: 1, cost: hourlyRate },
    ];
    patch({ lineItems: next, ...recomputeTotals(next) });
  }

  function updateLineItem(idx: number, field: keyof LineItem, value: string | number) {
    const next = [...draft!.lineItems];
    if (field === 'hours') {
      const hours = Number(value) || 0;
      next[idx] = { ...next[idx], hours, cost: hours * hourlyRate };
    } else if (field === 'cost' || field === 'costOverride') {
      const num = value === '' ? undefined : Number(value);
      next[idx] = { ...next[idx], costOverride: num };
    } else {
      next[idx] = { ...next[idx], [field]: value };
    }
    patch({ lineItems: next, ...recomputeTotals(next) });
  }

  function removeLineItem(idx: number) {
    const next = draft!.lineItems.filter((_, i) => i !== idx);
    patch({ lineItems: next, ...recomputeTotals(next) });
  }

  async function ensureSaved(): Promise<void> {
    if (!draft) return;
    if (!isDirty) return;
    await updateQuote(draft);
  }

  async function handleSend() {
    if (!draft?.id) return;
    setBusyAction('send');
    try {
      await ensureSaved();
      await markQuoteSent(draft.id);
    } catch (err) {
      console.error(err);
      alert('Failed to mark quote as sent.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConvert() {
    if (!draft?.id) return;
    if (!confirm('Convert this quote into a work order? The new work order will be approved and ready to start.')) return;
    setBusyAction('convert');
    try {
      await ensureSaved();
      const workItemId = await convertQuoteToWorkItem(draft!);
      navigate(`/dashboard/work-items/${workItemId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to convert quote.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGeneratePdf() {
    if (!draft?.id) return;
    setBusyAction('pdf');
    try {
      await ensureSaved();
      const url = await generateQuotePDF(draft.id);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (!draft?.id) return;
    if (!confirm('Delete this quote? This cannot be undone.')) return;
    setBusyAction('delete');
    try {
      await deleteQuote(draft.id);
      navigate('/dashboard/quotes');
    } catch (err) {
      console.error(err);
      alert('Failed to delete quote.');
      setBusyAction(null);
    }
  }

  const validUntilStr = draft.validUntil
    ? draft.validUntil.toISOString().slice(0, 10)
    : '';

  const isLocked = draft.status === 'converted';

  return (
    <div className="animate-fade-in-up w-full pb-20">
      {/* Breadcrumb / status */}
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/dashboard/quotes"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1"
        >
          <IconChevronRight size={12} className="rotate-180" />
          Quotes
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-secondary)] tabular-nums">
            {savingState === 'saving' ? 'Saving…' : savingState === 'saved' ? 'Saved' : ''}
          </span>
          <span className={'text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ' + QUOTE_STATUS_COLORS[draft.status]}>
            {QUOTE_STATUS_LABELS[draft.status]}
          </span>
        </div>
      </div>

      {/* Header card: title + meta */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 md:p-6 space-y-4">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Quote title"
          disabled={isLocked}
          className="w-full text-2xl font-extrabold text-[var(--text-primary)] bg-transparent outline-none placeholder:text-[var(--text-secondary)] disabled:opacity-60"
        />

        <textarea
          value={draft.description ?? ''}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Optional scope summary the client will see…"
          disabled={isLocked}
          rows={2}
          className="w-full text-sm text-[var(--text-secondary)] bg-transparent outline-none placeholder:text-[var(--text-secondary)]/70 resize-none disabled:opacity-60"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Client">
            <select
              value={draft.clientId}
              onChange={(e) => patch({ clientId: e.target.value, appId: undefined })}
              disabled={isLocked}
              className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            >
              {clients.length === 0 && <option value="">No clients</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="App (optional)">
            <select
              value={draft.appId ?? ''}
              onChange={(e) => patch({ appId: e.target.value || undefined })}
              disabled={isLocked}
              className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            >
              <option value="">— None —</option>
              {availableApps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Valid until">
            <input
              type="date"
              value={validUntilStr}
              onChange={(e) =>
                patch({ validUntil: e.target.value ? new Date(e.target.value) : undefined })
              }
              disabled={isLocked}
              className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>

          <Field label="Quote #">
            <input
              type="text"
              value={draft.quoteNumber ?? ''}
              onChange={(e) => patch({ quoteNumber: e.target.value || undefined })}
              placeholder="Q-2026-001"
              disabled={isLocked}
              className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>

          <Field label="Discount ($)">
            <input
              type="number"
              min="0"
              value={draft.discount ?? ''}
              onChange={(e) =>
                patch({ discount: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder="0"
              disabled={isLocked}
              className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>

          <Field label="Tax rate (%)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.taxRate ?? ''}
              onChange={(e) =>
                patch({ taxRate: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder={settings.invoiceTaxRate?.toString() ?? '0'}
              disabled={isLocked}
              className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] mt-4">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Line items</h2>
          {!isLocked && (
            <button
              onClick={addLineItem}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
            >
              <IconPlus size={12} /> Add row
            </button>
          )}
        </div>

        {draft.lineItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--text-secondary)]">
            No line items yet. Add a row to start pricing the work.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {draft.lineItems.map((li, idx) => (
              <div key={li.id} className="px-4 py-3 flex items-center gap-3">
                <input
                  type="text"
                  value={li.description}
                  onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                  placeholder="Description"
                  disabled={isLocked}
                  className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-[var(--text-secondary)]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={li.hours}
                  onChange={(e) => updateLineItem(idx, 'hours', e.target.value)}
                  disabled={isLocked}
                  className="w-20 text-right text-sm bg-[var(--bg-input)] rounded px-2 py-1 outline-none focus:border-[var(--accent)] border border-transparent focus:border tabular-nums"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={li.costOverride ?? li.cost}
                  onChange={(e) => updateLineItem(idx, 'cost', e.target.value)}
                  disabled={isLocked}
                  className="w-28 text-right text-sm bg-[var(--bg-input)] rounded px-2 py-1 outline-none focus:border-[var(--accent)] border border-transparent focus:border tabular-nums"
                />
                {!isLocked && (
                  <button
                    onClick={() => removeLineItem(idx)}
                    className="p-1 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                    title="Remove line"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <Totals quote={draft} hourlyRate={hourlyRate} taxRate={draft.taxRate ?? settings.invoiceTaxRate} />
      </div>

      {/* Terms */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] mt-4 p-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-2">Terms</h2>
        <textarea
          value={draft.terms ?? ''}
          onChange={(e) => patch({ terms: e.target.value || undefined })}
          placeholder={settings.invoiceTerms || 'e.g. 50% deposit on acceptance, balance on delivery.'}
          disabled={isLocked}
          rows={3}
          className="w-full text-sm text-[var(--text-primary)] bg-[var(--bg-input)] rounded-lg border border-[var(--border)] px-3 py-2 outline-none focus:border-[var(--accent)] disabled:opacity-60 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] mt-4 p-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={<IconSend size={14} />}
            onClick={handleSend}
            disabled={isLocked || draft.status === 'sent' || draft.status === 'accepted' || busyAction === 'send' || !draft.clientId}
          >
            {draft.status === 'sent' || draft.status === 'accepted' ? 'Sent' : busyAction === 'send' ? 'Sending…' : 'Mark as sent'}
          </ActionButton>

          <ActionButton
            icon={<IconDocument size={14} />}
            onClick={handleGeneratePdf}
            disabled={busyAction === 'pdf' || draft.lineItems.length === 0}
          >
            {busyAction === 'pdf' ? 'Generating…' : draft.pdfUrl ? 'Regenerate PDF' : 'Generate PDF'}
          </ActionButton>

          {draft.pdfUrl && (
            <a
              href={draft.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 py-2 px-3 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
            >
              View latest PDF →
            </a>
          )}

          <ActionButton
            icon={<IconCheck size={14} />}
            onClick={handleConvert}
            disabled={isLocked || draft.status !== 'accepted' || busyAction === 'convert'}
            primary={draft.status === 'accepted'}
          >
            {draft.convertedWorkItemId
              ? 'Already converted'
              : busyAction === 'convert'
                ? 'Converting…'
                : 'Convert to work order'}
          </ActionButton>

          {draft.convertedWorkItemId && (
            <Link
              to={`/dashboard/work-items/${draft.convertedWorkItemId}`}
              className="inline-flex items-center gap-2 py-2 px-3 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
            >
              Open work order →
            </Link>
          )}

          <div className="ml-auto" />

          <button
            onClick={handleDelete}
            disabled={busyAction === 'delete'}
            className="inline-flex items-center gap-2 py-2 px-3 text-xs font-semibold text-red-500/80 hover:text-red-500 transition-colors"
          >
            <IconTrash size={14} /> Delete
          </button>
        </div>

        {draft.status === 'sent' && (
          <p className="mt-3 text-[11px] text-[var(--text-secondary)]">
            Waiting on {client?.name || 'the client'} to accept or decline. They can respond from
            the portal once they receive the link.
          </p>
        )}
        {draft.respondedAt && draft.clientNotes && (
          <div className="mt-3 text-[12px] bg-[var(--bg-input)] rounded-lg px-3 py-2 text-[var(--text-primary)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">
              Client note
            </div>
            {draft.clientNotes}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Totals({
  quote,
  hourlyRate,
  taxRate,
}: {
  quote: Quote;
  hourlyRate: number;
  taxRate?: number;
}) {
  const subtotal = quote.totalCost;
  const discount = quote.discount ?? 0;
  const taxedBase = Math.max(0, subtotal - discount);
  const tax = taxRate ? (taxedBase * taxRate) / 100 : 0;
  const grand = taxedBase + tax;

  return (
    <div className="px-4 py-3 border-t border-[var(--border)] text-sm">
      <Row label="Hours" value={`${quote.totalHours.toFixed(2)} @ ${formatCurrency(hourlyRate)}/hr`} />
      <Row label="Subtotal" value={formatCurrency(subtotal)} />
      {discount > 0 && <Row label="Discount" value={`- ${formatCurrency(discount)}`} />}
      {tax > 0 && <Row label={`Tax (${taxRate}%)`} value={formatCurrency(tax)} />}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--border)]">
        <span className="text-[var(--text-primary)] font-bold">Total</span>
        <span className="text-lg font-extrabold text-[var(--accent)] tabular-nums">{formatCurrency(grand)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[var(--text-secondary)] text-[12px]">{label}</span>
      <span className="text-[var(--text-primary)] tabular-nums text-[12px]">{value}</span>
    </div>
  );
}

function ActionButton({
  icon,
  children,
  onClick,
  disabled,
  primary,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
        (primary
          ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]'
          : 'bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--border)]')
      }
    >
      {icon}
      {children}
    </button>
  );
}

// Used to compute the dirty diff. Strip volatile / generated fields.
function serializeForCompare(q: Quote) {
  return {
    clientId: q.clientId,
    projectId: q.projectId ?? null,
    appId: q.appId ?? null,
    quoteNumber: q.quoteNumber ?? null,
    title: q.title,
    description: q.description ?? null,
    status: q.status,
    validUntil: q.validUntil?.toISOString() ?? null,
    sentAt: q.sentAt?.toISOString() ?? null,
    respondedAt: q.respondedAt?.toISOString() ?? null,
    clientNotes: q.clientNotes ?? null,
    convertedWorkItemId: q.convertedWorkItemId ?? null,
    lineItems: q.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      hours: li.hours,
      cost: li.cost,
      costOverride: li.costOverride ?? null,
    })),
    totalHours: q.totalHours,
    totalCost: q.totalCost,
    taxRate: q.taxRate ?? null,
    discount: q.discount ?? null,
    terms: q.terms ?? null,
    pdfUrl: q.pdfUrl ?? null,
    pdfStoragePath: q.pdfStoragePath ?? null,
  };
}
