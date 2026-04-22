import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Client, Quote, QuoteStatus } from '../../lib/types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../lib/types';
import { createQuote } from '../../services/firestore';
import { formatCurrency } from '../../lib/utils';
import { useQuotes } from '../../hooks/useFirestore';
import { Modal } from '../../components/common/Modal';
import { IconPlus, IconSearch, IconChevronRight, IconDocument } from '../../components/icons';

interface QuotesProps {
  clients: Client[];
  hourlyRate: number;
}

const STATUS_FILTERS: Array<{ value: 'all' | QuoteStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

export default function Quotes({ clients, hourlyRate }: QuotesProps) {
  const { quotes, loading } = useQuotes();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [showNew, setShowNew] = useState(false);

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients],
  );

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const needle = search.toLowerCase();
      const client = q.clientId ? clientById[q.clientId] : undefined;
      return (
        q.title.toLowerCase().includes(needle) ||
        (q.quoteNumber ?? '').toLowerCase().includes(needle) ||
        (client?.name ?? '').toLowerCase().includes(needle) ||
        (client?.company ?? '').toLowerCase().includes(needle)
      );
    });
  }, [quotes, search, statusFilter, clientById]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: quotes.length };
    for (const q of quotes) map[q.status] = (map[q.status] || 0) + 1;
    return map;
  }, [quotes]);

  // Snapshot "now" lazily on first render. Stable through re-renders so the
  // expires-soon badge does not flicker.
  const [now] = useState(() => Date.now());

  const totals = useMemo(() => {
    const open = quotes.filter((q) => q.status === 'sent');
    const accepted = quotes.filter((q) => q.status === 'accepted');
    return {
      openCount: open.length,
      openValue: open.reduce((s, q) => s + q.totalCost, 0),
      acceptedCount: accepted.length,
      acceptedValue: accepted.reduce((s, q) => s + q.totalCost, 0),
    };
  }, [quotes]);

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="hidden md:block text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Quotes
        </h1>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 py-2.5 px-5 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all min-h-[44px]"
        >
          <IconPlus size={16} className="flex-shrink-0" />
          New Quote
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">Open</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">{totals.openCount}</span>
            <span className="text-sm text-[var(--text-secondary)]">{formatCurrency(totals.openValue)}</span>
          </div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">Accepted</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">{totals.acceptedCount}</span>
            <span className="text-sm text-[var(--text-secondary)]">{formatCurrency(totals.acceptedValue)}</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-3 relative">
        <IconSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quotes..."
          className="w-full pl-11 pr-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] shadow-sm transition-shadow min-h-[44px]"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          const count = counts[f.value] ?? 0;
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ' +
                (active
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]')
              }
            >
              {f.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-[var(--text-secondary)] py-12 text-center">Loading quotes…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasAny={quotes.length > 0}
          onCreate={() => setShowNew(true)}
        />
      ) : (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {filtered.map((q) => (
            <QuoteRow
              key={q.id}
              quote={q}
              client={q.clientId ? clientById[q.clientId] : undefined}
              now={now}
              onClick={() => q.id && navigate(`/dashboard/quotes/${q.id}`)}
            />
          ))}
        </div>
      )}

      {showNew && (
        <NewQuoteModal
          clients={clients}
          hourlyRate={hourlyRate}
          onClose={() => setShowNew(false)}
          onCreated={(id) => navigate(`/dashboard/quotes/${id}`)}
        />
      )}
    </div>
  );
}

function QuoteRow({
  quote,
  client,
  now,
  onClick,
}: {
  quote: Quote;
  client: Client | undefined;
  now: number;
  onClick: () => void;
}) {
  const expiresSoon =
    quote.status === 'sent' &&
    quote.validUntil != null &&
    quote.validUntil.getTime() - now < 1000 * 60 * 60 * 24 * 7;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg-input)] transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
        <IconDocument size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {quote.title || 'Untitled quote'}
          </span>
          <span className={'text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ' + QUOTE_STATUS_COLORS[quote.status]}>
            {QUOTE_STATUS_LABELS[quote.status]}
          </span>
        </div>
        <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">
          {client?.name ?? 'No client'}
          {quote.quoteNumber ? ` · ${quote.quoteNumber}` : ''}
          {expiresSoon ? ' · expires soon' : ''}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
          {formatCurrency(quote.totalCost)}
        </div>
        <div className="text-[11px] text-[var(--text-secondary)] tabular-nums">
          {quote.totalHours.toFixed(1)}h
        </div>
      </div>
      <IconChevronRight size={16} className="text-[var(--text-secondary)] flex-shrink-0" />
    </button>
  );
}

function EmptyState({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)]">
        <IconDocument size={22} />
      </div>
      <div className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
        {hasAny ? 'No quotes match these filters' : 'Send your first quote'}
      </div>
      <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
        Quotes give clients a price-locked offer they can accept before any work starts.
        Once accepted, a single click turns it into a work order.
      </p>
      {!hasAny && (
        <button
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-2 py-2 px-4 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--accent-dark)] transition-colors"
        >
          <IconPlus size={14} /> New quote
        </button>
      )}
    </div>
  );
}

/* ── New quote modal ─────────────────────────────────── */

function NewQuoteModal({
  clients,
  hourlyRate,
  onClose,
  onCreated,
}: {
  clients: Client[];
  hourlyRate: number;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [estimatedHours, setEstimatedHours] = useState<string>('');
  const [validDays, setValidDays] = useState<string>('30');
  const [saving, setSaving] = useState(false);

  const isValid = title.trim() && clientId;
  const hours = parseFloat(estimatedHours) || 0;
  const previewCost = hours * hourlyRate;

  async function handleCreate() {
    if (!isValid) return;
    setSaving(true);
    try {
      const days = parseInt(validDays, 10);
      const validUntil = Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        : undefined;

      const lineItems = hours > 0
        ? [{
            id: crypto.randomUUID(),
            description: title.trim(),
            hours,
            cost: previewCost,
          }]
        : [];

      const id = await createQuote({
        clientId,
        title: title.trim(),
        status: 'draft',
        validUntil,
        lineItems,
        totalHours: hours,
        totalCost: previewCost,
      });
      onCreated(id);
    } catch (err) {
      console.error('Failed to create quote:', err);
      alert('Failed to create quote. See console for details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New quote"
      subtitle="Draft an offer. You can fine-tune line items and pricing before sending."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="py-2 px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || saving}
            className="py-2 px-4 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mobile checkout redesign"
            autoFocus
            className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            {clients.length === 0 && <option value="">No clients yet</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.company ? ` — ${c.company}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Estimated hours
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Valid for (days)
            </label>
            <input
              type="number"
              min="1"
              value={validDays}
              onChange={(e) => setValidDays(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {hours > 0 && (
          <div className="text-[12px] text-[var(--text-secondary)] bg-[var(--bg-input)] rounded-lg px-3 py-2">
            Starting price preview: <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(previewCost)}</span>
            {' '}at {formatCurrency(hourlyRate)}/hr.
          </div>
        )}
      </div>
    </Modal>
  );
}
