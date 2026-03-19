import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkItem, Client } from '../../lib/types';
import { createClient } from '../../services/firestore';

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

  function handleCreate() {
    if (!newName.trim() || !newEmail.trim()) return;
    createClient({
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim() || undefined,
      company: newCompany.trim() || undefined,
    }).catch(console.error);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewCompany('');
    setShowNew(false);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider">
          Clients
        </h1>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-[#4BA8A8] text-white text-sm font-semibold rounded-full hover:bg-[#3A9090] transition-colors"
        >
          + New Client
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full px-4 py-2.5 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8] shadow-sm"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((client) => (
          <button
            key={client.id}
            onClick={() => navigate(`/dashboard/clients/${client.id}`)}
            className="w-full flex items-center gap-4 bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-[#4BA8A8] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#1A1A2E]">{client.name}</div>
              <div className="text-xs text-[#86868B]">
                {client.email}
                {client.company && ` · ${client.company}`}
              </div>
            </div>
            <div className="text-right flex-shrink-0 flex items-center gap-3">
              {client.retainerHours && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${client.retainerPaused ? 'bg-[#F2F2F7] text-[#86868B]' : 'bg-[#E67E22]/10 text-[#E67E22]'}`}>
                  {client.retainerPaused ? 'Paused' : `${client.retainerHours}h retainer`}
                </span>
              )}
              <div>
                <div className="text-sm font-bold text-[#1A1A2E]">{counts[client.id!] ?? 0}</div>
                <div className="text-[10px] text-[#86868B]">items</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-40">●</div>
          <div className="text-lg font-bold text-[#1A1A2E]">No clients found</div>
          <div className="text-sm text-[#86868B] mt-1">
            {search ? 'Try a different search.' : 'Add your first client to get started.'}
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowNew(false)} />
          <div className="relative bg-[#F5F5F7] rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-[#E5E5EA]">
              <h2 className="text-lg font-extrabold text-[#1A1A2E] uppercase tracking-wide">
                New Client
              </h2>
              <button onClick={() => setShowNew(false)} className="text-[#86868B] hover:text-[#1A1A2E] text-xl">
                ×
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-[#86868B] uppercase font-semibold">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-white rounded-lg border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
              </div>
              <div>
                <label className="text-xs text-[#86868B] uppercase font-semibold">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-white rounded-lg border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
              </div>
              <div>
                <label className="text-xs text-[#86868B] uppercase font-semibold">Phone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-white rounded-lg border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
              </div>
              <div>
                <label className="text-xs text-[#86868B] uppercase font-semibold">Company</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-white rounded-lg border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-[#E5E5EA]">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E5EA] text-sm font-medium text-[#86868B] hover:bg-[#F2F2F7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || !newEmail.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
