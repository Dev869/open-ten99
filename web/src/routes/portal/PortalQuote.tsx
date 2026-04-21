import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import type { Quote } from '../../lib/types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../lib/types';
import { fetchQuote, recordQuoteResponse } from '../../services/firestore';
import { formatCurrency } from '../../lib/utils';

// Captured at module load. Stable for the lifetime of the page so the
// "expired" badge does not flicker through re-renders.
const pageLoadTime = Date.now();

export default function PortalQuote() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoading(false);
      setError('Quote not found.');
      return;
    }
    setLoading(true);
    fetchQuote(id).then((q) => {
      if (cancelled) return;
      if (!q) setError('Quote not found, or you do not have access.');
      setQuote(q);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function respond(decision: 'accepted' | 'declined') {
    if (!quote?.id) return;
    setResponding(true);
    setError(null);
    try {
      await recordQuoteResponse(quote.id, decision, notes.trim() || undefined);
      // Reflect locally so the UI updates immediately even before the next read.
      setQuote({
        ...quote,
        status: decision,
        respondedAt: new Date(),
        clientNotes: notes.trim() || quote.clientNotes,
      });
    } catch (err) {
      console.error(err);
      setError('Could not record your response. Please try again or contact your contractor.');
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-sm text-[var(--text-secondary)]">Loading quote…</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-sm text-[var(--text-primary)] font-semibold">{error || 'Quote unavailable'}</div>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Ask your contractor to resend the quote link.
          </p>
        </div>
      </div>
    );
  }

  const subtotal = quote.totalCost;
  const discount = quote.discount ?? 0;
  const taxedBase = Math.max(0, subtotal - discount);
  const tax = quote.taxRate ? (taxedBase * quote.taxRate) / 100 : 0;
  const grand = taxedBase + tax;
  const expired = quote.validUntil != null && quote.validUntil.getTime() < pageLoadTime;
  const responded = quote.status === 'accepted' || quote.status === 'declined' || quote.status === 'converted';
  const canRespond = !responded && !expired && quote.status !== 'draft';

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Header */}
      <div className="bg-[#4BA8A8]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-white font-black text-sm uppercase tracking-[0.2em]">
            Quote
          </span>
          <button
            onClick={() => signOut(auth).then(() => navigate('/portal/auth'))}
            className="text-xs font-semibold text-white/80 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Title card */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-[var(--text-primary)]">{quote.title}</h1>
              {quote.quoteNumber && (
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">{quote.quoteNumber}</div>
              )}
            </div>
            <span className={'flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ' + QUOTE_STATUS_COLORS[quote.status]}>
              {QUOTE_STATUS_LABELS[quote.status]}
            </span>
          </div>
          {quote.description && (
            <p className="text-sm text-[var(--text-secondary)] mt-3 whitespace-pre-line">{quote.description}</p>
          )}
          {quote.validUntil && (
            <div className={'mt-3 text-[11px] ' + (expired ? 'text-red-500' : 'text-[var(--text-secondary)]')}>
              {expired ? 'Expired ' : 'Valid until '}
              {quote.validUntil.toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-input)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex">
            <span className="flex-1">Item</span>
            <span className="w-16 text-right">Hours</span>
            <span className="w-24 text-right">Cost</span>
          </div>
          {quote.lineItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">No line items.</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {quote.lineItems.map((li) => {
                const cost = li.costOverride !== undefined ? li.costOverride : li.cost;
                return (
                  <div key={li.id} className="px-4 py-3 flex items-center text-sm">
                    <span className="flex-1 text-[var(--text-primary)] min-w-0 pr-2">{li.description || 'Untitled'}</span>
                    <span className="w-16 text-right text-[var(--text-secondary)] tabular-nums">{li.hours.toFixed(2)}</span>
                    <span className="w-24 text-right text-[var(--text-primary)] tabular-nums">{formatCurrency(cost)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-3 border-t border-[var(--border)] text-sm space-y-1">
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
            {discount > 0 && <Row label="Discount" value={`- ${formatCurrency(discount)}`} />}
            {tax > 0 && <Row label={`Tax (${quote.taxRate}%)`} value={formatCurrency(tax)} />}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--border)]">
              <span className="font-bold text-[var(--text-primary)]">Total</span>
              <span className="text-lg font-extrabold text-[var(--accent)] tabular-nums">{formatCurrency(grand)}</span>
            </div>
          </div>
        </div>

        {quote.terms && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Terms</h3>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-line">{quote.terms}</p>
          </div>
        )}

        {quote.pdfUrl && (
          <a
            href={quote.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Download PDF
          </a>
        )}

        {/* Response panel */}
        {canRespond && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Your response</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional note for the contractor (e.g. timeline questions, preferred start date)…"
              className="w-full text-sm bg-[var(--bg-input)] rounded-lg border border-[var(--border)] px-3 py-2 outline-none focus:border-[var(--accent)] resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => respond('accepted')}
                disabled={responding}
                className="flex-1 py-3 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {responding ? 'Saving…' : 'Accept quote'}
              </button>
              <button
                onClick={() => respond('declined')}
                disabled={responding}
                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--bg-input)] transition-colors disabled:opacity-50"
              >
                Decline
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {responded && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center text-sm text-[var(--text-secondary)]">
            {quote.status === 'accepted' && 'Thanks — your acceptance was recorded. The contractor will follow up shortly.'}
            {quote.status === 'declined' && 'Decline recorded. The contractor has been notified.'}
            {quote.status === 'converted' && 'This quote has been converted to a work order. See your portal home for details.'}
          </div>
        )}

        {expired && !responded && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center text-sm text-[var(--text-secondary)]">
            This quote expired on {quote.validUntil!.toLocaleDateString()}. Ask the contractor to resend an updated version.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-secondary)] text-[12px]">{label}</span>
      <span className="text-[var(--text-primary)] tabular-nums text-[12px]">{value}</span>
    </div>
  );
}
