import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkItem, Client } from '../../lib/types';
import { createClient } from '../../services/firestore';
import { IconPlus, IconSearch, IconChevronRight, IconClose, IconCheckSmall } from '../../components/icons';

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
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
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
              <div className="text-sm font-semibold text-[var(--text-primary)]">{client.name}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {client.email}
                {client.company && ` · ${client.company}`}
              </div>
            </div>
            <div className="text-right flex-shrink-0 flex items-center gap-3">
              {client.retainerHours && (
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${client.retainerPaused ? 'bg-[var(--bg-input)] text-[var(--text-secondary)]' : 'bg-[#E67E22]/10 text-[#E67E22]'}`}>
                  {client.retainerPaused ? 'Paused' : `${client.retainerHours}h retainer`}
                </span>
              )}
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{counts[client.id!] ?? 0}</div>
                <div className="text-[10px] text-[var(--text-secondary)]">items</div>
              </div>
              {/* Chevron */}
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
              : 'Add your first client and start tracking work items, retainers, and more.'}
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
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowNew(false)}
          />
          <div className="relative bg-[var(--bg-page)] rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-scale-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-[var(--border)]">
              <h2 className="text-lg font-extrabold text-[var(--text-primary)] uppercase tracking-wide">
                New Client
              </h2>
              <button
                onClick={() => setShowNew(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
                aria-label="Close"
              >
                <IconClose size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow min-h-[44px]"
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow min-h-[44px]"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow min-h-[44px]"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Company
                </label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow min-h-[44px]"
                  placeholder="Company name"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-5 border-t border-[var(--border)]">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] active:scale-[0.98] transition-all min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || !newEmail.trim() || saving}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 active:scale-[0.98] transition-all min-h-[44px]"
              >
                {saving ? (
                  'Saving...'
                ) : (
                  <>
                    <IconCheckSmall size={16} />
                    Save Client
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
