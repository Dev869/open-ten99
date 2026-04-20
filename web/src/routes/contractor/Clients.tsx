import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkItem, Client } from '../../lib/types';
import { createClient } from '../../services/firestore';
import { IconPlus, IconSearch, IconChevronRight } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { useInsights } from '../../hooks/useFirestore';
import { ConcentrationDonut } from '../../components/insights/ConcentrationDonut';
import { InsightBadge } from '../../components/insights/InsightBadge';
import { InsightShimmer } from '../../components/insights/InsightShimmer';

interface ClientsProps {
  workItems: WorkItem[];
  clients: Client[];
}

export default function Clients({ workItems, clients }: ClientsProps) {
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { insights, isGenerating } = useInsights();

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    workItems
      .filter((i) => i.status !== 'archived')
      .forEach((i) => {
        map[i.clientId] = (map[i.clientId] || 0) + 1;
      });
    return map;
  }, [workItems]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  async function handleCreate() {
    if (!newName.trim() || !newEmail.trim()) return;
    setSaving(true);
    try {
      await createClient({
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || undefined,
        company: newCompany.trim() || undefined,
      });
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewCompany('');
      setShowNew(false);
    } catch (err) {
      console.error('Failed to create client:', err);
    }
    setSaving(false);
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="hidden md:block text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Clients
        </h1>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 py-2.5 px-5 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all min-h-[44px]"
        >
          <IconPlus size={16} className="flex-shrink-0" />
          New Client
        </button>
      </div>

      {/* Search Input */}
      <div className="mb-4 relative">
        <IconSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full pl-11 pr-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] shadow-sm transition-shadow min-h-[44px]"
        />
      </div>

      {/* Concentration Chart */}
      {isGenerating ? (
        <InsightShimmer className="h-[260px]" label="Client analysis loading..." />
      ) : insights?.clients?.scores?.length ? (
        <ConcentrationDonut scores={insights.clients.scores} />
      ) : null}

      {/* Client List */}
      <div className="space-y-2">
        {filtered.map((client, i) => (
          <button
            key={client.id}
            onClick={() => navigate(`/dashboard/clients/${client.id}`)}
            className="w-full flex items-center gap-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-4 text-left hover:shadow-md hover:border-[var(--accent)] active:scale-[0.99] transition-all min-h-[72px] animate-fade-in-up"
            style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
          >
            <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-base flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{client.name}</span>
                {client.retainerHours && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${client.retainerPaused ? 'bg-[var(--bg-input)] text-[var(--text-secondary)]' : 'bg-[var(--color-orange)]/10 text-[var(--color-orange)]'}`}>
                    {client.retainerPaused ? 'Paused' : `${client.retainerHours}h`}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                {client.email}
                {client.company && ` · ${client.company}`}
              </div>
              {(() => {
                const score = insights?.clients?.scores?.find((s) => s.clientId === client.id);
                return score ? (
                  <div className="flex gap-1.5 mt-1">
                    <InsightBadge label={`$${score.lifetimeValue.toLocaleString()}`} level="info" tooltip="Lifetime value" />
                    <InsightBadge label={`Churn: ${score.churnRisk}`} level={score.churnRisk} tooltip={score.reason} />
                  </div>
                ) : null;
              })()}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="text-sm font-bold text-[var(--text-primary)]">{counts[client.id!] ?? 0}</div>
                <div className="text-[10px] text-[var(--text-secondary)]">items</div>
              </div>
              <IconChevronRight size={16} className="text-[var(--text-secondary)]/50" />
            </div>
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-24 animate-fade-in-up">
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="text-[var(--accent)]">
              <circle cx="18" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M6 30c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-lg font-bold text-[var(--text-primary)]">
            {search ? 'No clients found' : 'No clients yet'}
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-xs mx-auto">
            {search
              ? 'Try a different search term.'
              : 'Add your first client and start tracking work orders, retainers, and more.'}
          </div>
          {!search && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 mt-5 py-2.5 px-5 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all min-h-[44px]"
            >
              <IconPlus size={16} />
              Add Your First Client
            </button>
          )}
        </div>
      )}

      {/* New Client Modal */}
      <NewClientModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSave={handleCreate}
        saving={saving}
        name={newName}
        onNameChange={setNewName}
        email={newEmail}
        onEmailChange={setNewEmail}
        phone={newPhone}
        onPhoneChange={setNewPhone}
        company={newCompany}
        onCompanyChange={setNewCompany}
      />
    </div>
  );
}

/* ── New Client Modal ─────────────────────────────── */

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  name: string;
  onNameChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  company: string;
  onCompanyChange: (v: string) => void;
}

function NewClientModal({
  open, onClose, onSave, saving,
  name, onNameChange, email, onEmailChange, phone, onPhoneChange, company, onCompanyChange,
}: NewClientModalProps) {
  const isValid = name.trim() && email.trim();
  const labelClass = 'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5';
  const inputClass = 'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all placeholder:text-[var(--text-secondary)]';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Client"
      subtitle="Add a client to invoice and track work for."
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!isValid || saving}
            className="flex-[2] h-11 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:bg-[var(--accent-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {saving ? 'Saving...' : 'Save Client'}
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus
            placeholder="Client name"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="email@example.com"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              Phone <span className="normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="(555) 123-4567"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Company <span className="normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => onCompanyChange(e.target.value)}
              placeholder="Company name"
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
