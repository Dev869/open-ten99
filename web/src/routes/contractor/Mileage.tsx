import { useState, useMemo, useCallback } from 'react';
import { useMileageTrips, useSettings } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { createMileageTrip, deleteMileageTrip } from '../../services/firestore';
import { formatCurrency, formatDate, exportToCsv } from '../../lib/utils';
import type { MileagePurpose, Client } from '../../lib/types';

interface MileageProps {
  clients: Client[];
}

export default function Mileage({ clients }: MileageProps) {
  const { user } = useAuth();
  const { settings } = useSettings(user?.uid);
  const { trips, loading } = useMileageTrips();
  const rate = settings.mileageRate ?? 0.70;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDesc, setFormDesc] = useState('');
  const [formMiles, setFormMiles] = useState('');
  const [formPurpose, setFormPurpose] = useState<MileagePurpose>('business');
  const [formClientId, setFormClientId] = useState('');
  const [formRoundTrip, setFormRoundTrip] = useState(false);
  const [error, setError] = useState('');

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    ys.add(currentYear);
    trips.forEach((t) => ys.add(t.date.getFullYear()));
    return [...ys].sort((a, b) => b - a);
  }, [trips, currentYear]);

  const filtered = useMemo(
    () => trips.filter((t) => t.date.getFullYear() === selectedYear),
    [trips, selectedYear]
  );

  const totalBusinessMiles = useMemo(
    () => filtered
      .filter((t) => t.purpose === 'business')
      .reduce((s, t) => s + (t.roundTrip ? t.miles * 2 : t.miles), 0),
    [filtered]
  );
  const totalDeduction = useMemo(
    () => filtered.reduce((s, t) => s + t.deduction, 0),
    [filtered]
  );

  function resetForm() {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDesc('');
    setFormMiles('');
    setFormPurpose('business');
    setFormClientId('');
    setFormRoundTrip(false);
    setShowForm(false);
    setError('');
  }

  const handleSubmit = useCallback(async () => {
    const miles = parseFloat(formMiles);
    if (!formDesc.trim() || isNaN(miles) || miles <= 0) return;

    setFormLoading(true);
    setError('');
    try {
      await createMileageTrip({
        date: new Date(formDate + 'T12:00:00'),
        description: formDesc.trim(),
        miles,
        purpose: formPurpose,
        clientId: formClientId || undefined,
        roundTrip: formRoundTrip,
        rate,
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trip');
    } finally {
      setFormLoading(false);
    }
  }, [formDate, formDesc, formMiles, formPurpose, formClientId, formRoundTrip, rate]);

  async function handleDelete(tripId: string, transactionId?: string) {
    if (!confirm('Delete this trip? This also removes the linked expense.')) return;
    try {
      await deleteMileageTrip(tripId, transactionId);
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  }

  function handleExport() {
    const headers = ['Date', 'Description', 'Miles', 'Effective Miles', 'Purpose', 'Client', 'Rate', 'Deduction'];
    const rows = filtered.map((t) => {
      const effective = t.roundTrip ? t.miles * 2 : t.miles;
      return [
        formatDate(t.date),
        t.description,
        t.miles.toFixed(1),
        effective.toFixed(1),
        t.purpose,
        t.clientId ? (clientMap[t.clientId] ?? '') : '',
        `$${t.rate.toFixed(2)}`,
        `$${t.deduction.toFixed(2)}`,
      ];
    });
    exportToCsv(`mileage-log-${selectedYear}.csv`, headers, rows);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-[var(--bg-card)] rounded-xl" />
        <div className="h-12 bg-[var(--bg-card)] rounded-xl" />
        <div className="h-48 bg-[var(--bg-card)] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Summary bar */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            {selectedYear} Mileage
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-xs"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-baseline gap-4 mt-1">
          <div>
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {totalBusinessMiles.toFixed(1)}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] ml-1">business mi</span>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-[var(--accent)]">
              {formatCurrency(totalDeduction)}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] ml-1">deduction</span>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowForm((p) => !p)}
          className="flex-1 h-9 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--accent-dark)] transition-colors"
        >
          {showForm ? 'Cancel' : '+ Log Trip'}
        </button>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            className="h-9 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            Export
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-3 space-y-3 animate-fade-in-up">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
              />
            </div>
            <div className="w-24">
              <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Miles</label>
              <input
                type="number"
                value={formMiles}
                onChange={(e) => setFormMiles(e.target.value)}
                min="0.1"
                step="0.1"
                placeholder="0.0"
                className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Description</label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="e.g. Client site visit"
              className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setFormPurpose('business')}
                className={`px-3 h-8 text-xs font-semibold transition-colors ${
                  formPurpose === 'business'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                }`}
              >
                Business
              </button>
              <button
                type="button"
                onClick={() => setFormPurpose('personal')}
                className={`px-3 h-8 text-xs font-semibold transition-colors ${
                  formPurpose === 'personal'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                }`}
              >
                Personal
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={formRoundTrip}
                onChange={(e) => setFormRoundTrip(e.target.checked)}
                className="rounded"
              />
              Round trip
            </label>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Client (optional)</label>
            <select
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
            >
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id!}>{c.name}</option>
              ))}
            </select>
          </div>

          {formMiles && parseFloat(formMiles) > 0 && formPurpose === 'business' && (
            <p className="text-xs text-[var(--text-secondary)]">
              {formRoundTrip ? `${(parseFloat(formMiles) * 2).toFixed(1)} mi` : `${parseFloat(formMiles).toFixed(1)} mi`}
              {' × $'}{rate.toFixed(2)}{' = '}
              <span className="font-bold text-[var(--accent)]">
                {formatCurrency((formRoundTrip ? parseFloat(formMiles) * 2 : parseFloat(formMiles)) * rate)}
              </span>
              {' deduction'}
            </p>
          )}
          {error && (
            <p className="text-xs text-[var(--color-red)]">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={formLoading || !formDesc.trim() || !formMiles || parseFloat(formMiles) <= 0}
            className="w-full h-9 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
          >
            {formLoading ? 'Saving...' : 'Save Trip'}
          </button>
        </div>
      )}

      {/* Trip list */}
      <div className="space-y-2">
        {filtered.map((trip, i) => {
          const effective = trip.roundTrip ? trip.miles * 2 : trip.miles;
          return (
            <div
              key={trip.id}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-[var(--text-secondary)]">{formatDate(trip.date)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      trip.purpose === 'business'
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                    }`}>
                      {trip.purpose === 'business' ? 'Business' : 'Personal'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {trip.description}
                  </p>
                  {trip.clientId && clientMap[trip.clientId] && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{clientMap[trip.clientId]}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {effective.toFixed(1)} mi
                    {trip.roundTrip && <span className="text-[10px] text-[var(--text-secondary)] ml-0.5">↔</span>}
                  </p>
                  {trip.purpose === 'business' && (
                    <p className="text-xs font-semibold text-[var(--accent)]">{formatCurrency(trip.deduction)}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => handleDelete(trip.id, trip.transactionId)}
                  className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--color-red)] transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !showForm && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 opacity-40 text-[var(--text-primary)]">✦</div>
          <div className="text-sm font-bold text-[var(--text-primary)]">No trips logged yet</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Tap "Log Trip" to track your first drive.
          </div>
        </div>
      )}
    </div>
  );
}
