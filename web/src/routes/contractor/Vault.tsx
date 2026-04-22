import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type {
  Client,
  VaultMeta,
  VaultCredential,
  DecryptedCredentialData,
  VaultServiceId,
} from '../../lib/types';
import { VAULT_SERVICES } from '../../lib/types';
import { createVaultCrypto, unlockVault, encrypt, decrypt } from '../../lib/crypto';
import {
  subscribeVaultMeta,
  createVaultMeta,
  subscribeVaultCredentials,
  createVaultCredential,
  updateVaultCredential,
  deleteVaultCredential,
} from '../../services/firestore';
import { cn } from '../../lib/utils';
import {
  IconLock,
  IconShield,
  IconPlus,
  IconClose,
  IconSearch,
  IconEdit,
  IconTrash,
  IconCopy,
  IconKey,
  IconEye,
  IconEyeOff,
  IconChevronDown,
  IconCheckSmall,
  IconClock,
} from '../../components/icons';

/* ── Constants ────────────────────────────────────── */

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function serviceInfo(id: string) {
  const found = VAULT_SERVICES.find((s) => s.id === id);
  if (found) return found;
  // Custom service — use the id as the label
  return { id, label: id, color: 'var(--text-secondary)' } as const;
}

/* ── Props ────────────────────────────────────────── */

interface VaultProps {
  user: User;
  clients: Client[];
}

/* ── Main Component ───────────────────────────────── */

export default function Vault({ user, clients }: VaultProps) {
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, DecryptedCredentialData>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());
  const [collapsedServices, setCollapsedServices] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingCred, setEditingCred] = useState<VaultCredential | null>(null);
  const [search, setSearch] = useState('');
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clientMap: Record<string, string> = {};
  clients.forEach((c) => { if (c.id) clientMap[c.id] = c.name; });

  // Auto-lock timer
  const resetLockTimer = useCallback(() => {
    clearTimeout(lockTimerRef.current);
    if (cryptoKeyRef.current) {
      lockTimerRef.current = setTimeout(() => {
        cryptoKeyRef.current = null;
        setUnlocked(false);
        setDecryptedMap({});
        setCredentials([]);
      }, LOCK_TIMEOUT_MS);
    }
  }, []);

  // Reset timer on user activity
  useEffect(() => {
    if (!unlocked) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    const handler = () => resetLockTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    resetLockTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimeout(lockTimerRef.current);
    };
  }, [unlocked, resetLockTimer]);

  // Lock on unmount
  useEffect(() => {
    return () => {
      cryptoKeyRef.current = null;
      clearTimeout(lockTimerRef.current);
    };
  }, []);

  // Subscribe to vault meta
  useEffect(() => {
    setMetaLoading(true);
    const unsub = subscribeVaultMeta(user.uid, (meta) => {
      setVaultMeta(meta);
      setMetaLoading(false);
    });
    return unsub;
  }, [user.uid]);

  // Subscribe to credentials when unlocked
  useEffect(() => {
    if (!unlocked) return;
    const unsub = subscribeVaultCredentials(user.uid, async (creds) => {
      setCredentials(creds);
      if (cryptoKeyRef.current) {
        const map: Record<string, DecryptedCredentialData> = {};
        for (const cred of creds) {
          try {
            const json = await decrypt(cryptoKeyRef.current, cred.encryptedData, cred.iv);
            map[cred.id!] = JSON.parse(json);
          } catch {
            map[cred.id!] = {};
          }
        }
        setDecryptedMap(map);
      }
    });
    return unsub;
  }, [user.uid, unlocked]);

  function lock() {
    cryptoKeyRef.current = null;
    setUnlocked(false);
    setDecryptedMap({});
    setCredentials([]);
    clearTimeout(lockTimerRef.current);
  }

  async function handleSetup(password: string) {
    const { key, meta } = await createVaultCrypto(password);
    await createVaultMeta(user.uid, meta);
    cryptoKeyRef.current = key;
    setUnlocked(true);
  }

  async function handleUnlock(password: string): Promise<boolean> {
    if (!vaultMeta) return false;
    const key = await unlockVault(
      password,
      vaultMeta.salt,
      vaultMeta.verificationCiphertext,
      vaultMeta.verificationIv,
    );
    if (!key) return false;
    cryptoKeyRef.current = key;
    setUnlocked(true);
    return true;
  }

  async function handleSaveCredential(
    data: {
      clientId: string;
      service: string;
      label: string;
      secret: DecryptedCredentialData;
    },
    existingId?: string,
  ) {
    if (!cryptoKeyRef.current) return;
    const { ciphertext, iv } = await encrypt(
      cryptoKeyRef.current,
      JSON.stringify(data.secret),
    );
    if (existingId) {
      await updateVaultCredential(user.uid, existingId, {
        clientId: data.clientId,
        service: data.service,
        label: data.label,
        encryptedData: ciphertext,
        iv,
      });
    } else {
      await createVaultCredential(user.uid, {
        clientId: data.clientId,
        service: data.service,
        label: data.label,
        encryptedData: ciphertext,
        iv,
      });
    }
    setShowModal(false);
    setEditingCred(null);
  }

  async function handleDelete(credId: string) {
    await deleteVaultCredential(user.uid, credId);
  }

  // Search filter
  const filtered = credentials.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const svc = serviceInfo(c.service);
    return (
      c.label.toLowerCase().includes(q) ||
      svc.label.toLowerCase().includes(q) ||
      (clientMap[c.clientId] ?? '').toLowerCase().includes(q)
    );
  });

  // Group by client → service
  const grouped = (() => {
    const byClient = new Map<string, Map<string, VaultCredential[]>>();
    for (const cred of filtered) {
      if (!byClient.has(cred.clientId)) byClient.set(cred.clientId, new Map());
      const svcMap = byClient.get(cred.clientId)!;
      if (!svcMap.has(cred.service)) svcMap.set(cred.service, []);
      svcMap.get(cred.service)!.push(cred);
    }
    return Array.from(byClient.entries())
      .map(([cId, svcMap]) => ({
        clientId: cId,
        clientName: clientMap[cId] ?? 'Unknown',
        totalCount: Array.from(svcMap.values()).reduce((sum, arr) => sum + arr.length, 0),
        services: Array.from(svcMap.entries())
          .map(([sId, creds]) => ({
            serviceId: sId,
            svc: serviceInfo(sId),
            credentials: creds,
          }))
          .sort((a, b) => a.svc.label.localeCompare(b.svc.label)),
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  })();

  // Render
  if (metaLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-fade-in-up">
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center mb-4">
          <IconLock size={20} color="white" className="animate-pulse" />
        </div>
        <div className="text-sm text-[var(--text-secondary)]">Loading vault...</div>
      </div>
    );
  }

  if (!vaultMeta) {
    return <VaultSetup onSetup={handleSetup} />;
  }

  if (!unlocked) {
    return <VaultUnlock onUnlock={handleUnlock} />;
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      {/* Encryption status banner */}
      <div className="py-2 px-4 rounded-xl bg-[var(--bg-input)] flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <IconShield size={14} color="var(--accent)" />
          End-to-end encrypted
        </span>
        <span className="text-[var(--text-secondary)]">&middot;</span>
        <span>{credentials.length} credential{credentials.length !== 1 ? 's' : ''}</span>
        <span className="text-[var(--text-secondary)]">&middot;</span>
        <span className="inline-flex items-center gap-1">
          <IconClock size={12} />
          Auto-locks in 5 min
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="hidden md:block text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
            Key Vault
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingCred(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 py-2.5 px-5 min-h-[44px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all"
          >
            <IconPlus size={16} />
            Add Credential
          </button>
          <button
            onClick={lock}
            className="inline-flex items-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] active:scale-[0.97] transition-all"
          >
            <IconLock size={16} />
            Lock
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <IconSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search credentials..."
          className="w-full pl-11 pr-4 py-2.5 min-h-[44px] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] shadow-sm transition-shadow"
        />
      </div>

      {/* Credentials grouped by client → application */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 animate-fade-in-up">
          <div className="mx-auto mb-5 w-20 h-20 rounded-2xl bg-[var(--bg-input)] flex items-center justify-center">
            <IconLock size={36} className="opacity-30" />
          </div>
          <div className="text-base font-semibold text-[var(--text-primary)]">
            {credentials.length === 0 ? 'Your vault is empty' : 'No matching credentials'}
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-xs mx-auto">
            {credentials.length === 0
              ? 'Store API keys, passwords, and service credentials for your clients — all encrypted end-to-end.'
              : 'Try adjusting your search.'}
          </div>
          {credentials.length === 0 && (
            <button
              onClick={() => { setEditingCred(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 mt-5 py-2.5 px-5 min-h-[44px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all"
            >
              <IconPlus size={16} />
              Add First Credential
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            const clientCollapsed = collapsedClients.has(group.clientId);
            return (
              <div key={group.clientId} className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)] animate-fade-in-up">
                {/* Client header */}
                <button
                  onClick={() => setCollapsedClients((prev) => {
                    const next = new Set(prev);
                    next.has(group.clientId) ? next.delete(group.clientId) : next.add(group.clientId);
                    return next;
                  })}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg-input)] transition-colors"
                >
                  <IconChevronDown
                    size={16}
                    className={cn(
                      'transition-transform duration-200 text-[var(--text-secondary)] flex-shrink-0',
                      clientCollapsed && '-rotate-90',
                    )}
                  />
                  <span className="text-sm font-bold text-[var(--text-primary)] flex-1 min-w-0 truncate">
                    {group.clientName}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] tabular-nums flex-shrink-0">
                    {group.totalCount} credential{group.totalCount !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Services within this client */}
                {!clientCollapsed && (
                  <div className="border-t border-[var(--border)]">
                    {group.services.map((svcGroup, svcIdx) => {
                      const svcKey = `${group.clientId}:${svcGroup.serviceId}`;
                      const svcCollapsed = collapsedServices.has(svcKey);
                      return (
                        <div key={svcGroup.serviceId}>
                          {/* Service sub-header */}
                          <button
                            onClick={() => setCollapsedServices((prev) => {
                              const next = new Set(prev);
                              next.has(svcKey) ? next.delete(svcKey) : next.add(svcKey);
                              return next;
                            })}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-4 py-2.5 pl-11 text-left hover:bg-[var(--bg-input)] transition-colors',
                              svcIdx > 0 && 'border-t border-[var(--border)]',
                            )}
                          >
                            <IconChevronDown
                              size={14}
                              className={cn(
                                'transition-transform duration-200 text-[var(--text-secondary)] flex-shrink-0',
                                svcCollapsed && '-rotate-90',
                              )}
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: svcGroup.svc.color }}
                            />
                            <span className="text-xs font-semibold text-[var(--text-primary)] flex-1 min-w-0 truncate">
                              {svcGroup.svc.label}
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)] tabular-nums flex-shrink-0">
                              {svcGroup.credentials.length}
                            </span>
                          </button>

                          {/* Credentials for this service */}
                          {!svcCollapsed && (
                            <div className="px-4 pb-3 pt-1 pl-11 space-y-2">
                              {svcGroup.credentials.map((cred, i) => (
                                <CredentialCard
                                  key={cred.id}
                                  credential={cred}
                                  decrypted={decryptedMap[cred.id!]}
                                  clientName={group.clientName}
                                  index={i}
                                  onEdit={() => { setEditingCred(cred); setShowModal(true); }}
                                  onDelete={() => handleDelete(cred.id!)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CredentialModal
          clients={clients}
          existing={editingCred}
          existingDecrypted={editingCred ? decryptedMap[editingCred.id!] : undefined}
          onSave={handleSaveCredential}
          onClose={() => { setShowModal(false); setEditingCred(null); }}
        />
      )}
    </div>
  );
}

/* ── Setup Screen ─────────────────────────────────── */

function VaultSetup({ onSetup }: { onSetup: (pw: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    await onSetup(password);
    setSaving(false);
  }

  const strengthLabel = password.length === 0
    ? null
    : password.length < 8
      ? 'Weak'
      : password.length < 14
        ? 'Good'
        : 'Strong';

  const strengthColor = strengthLabel === 'Weak'
    ? 'text-red-500'
    : strengthLabel === 'Good'
      ? 'text-yellow-600'
      : 'text-green-600';

  return (
    <div className="max-w-md mx-auto pt-20 animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1A1A2E] to-[#2D2D3F] flex items-center justify-center mx-auto mb-4">
          <IconLock size={28} color="white" />
        </div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Create Your Vault
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xs mx-auto">
          Set a master password to encrypt your client credentials. This password is never stored — if you forget it, your data cannot be recovered.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-lg p-6 space-y-4">
        <div>
          <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
            Master Password
          </label>
          <div className="relative">
            <IconLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="At least 8 characters"
              autoFocus
              className="w-full pl-11 pr-3.5 py-3 min-h-[44px] bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
            />
          </div>
          {strengthLabel && (
            <div className="mt-1.5">
              <p className={cn('text-xs font-medium', strengthColor)}>
                Strength: {strengthLabel}
              </p>
              <div className="mt-1 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    strengthLabel === 'Weak' ? 'w-1/3 bg-red-500' : strengthLabel === 'Good' ? 'w-2/3 bg-yellow-500' : 'w-full bg-green-500',
                  )}
                />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <IconLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              placeholder="Repeat your password"
              className="w-full pl-11 pr-3.5 py-3 min-h-[44px] bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-500 font-medium">{error}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 min-h-[48px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          <IconShield size={18} />
          {saving ? 'Creating Vault...' : 'Create Vault'}
        </button>
      </form>

      <p className="text-center text-[10px] text-[var(--text-secondary)] mt-4 max-w-xs mx-auto leading-relaxed">
        Credentials are encrypted with AES-256-GCM using a key derived from your master password via PBKDF2 (600k iterations). The plaintext never leaves your browser.
      </p>
    </div>
  );
}

/* ── Unlock Screen ────────────────────────────────── */

function VaultUnlock({ onUnlock }: { onUnlock: (pw: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const ok = await onUnlock(password);
    if (!ok) {
      setError(true);
      setPassword('');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-sm mx-auto pt-20 animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1A1A2E] to-[#2D2D3F] flex items-center justify-center mx-auto mb-4">
          <IconLock size={28} color="white" />
        </div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Vault Locked
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Enter your master password to unlock.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-lg p-6 space-y-4">
        <div className="relative">
          <IconKey size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]" />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="Master password"
            autoFocus
            className={cn(
              'w-full pl-11 pr-3.5 py-3 min-h-[44px] bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow',
              error ? 'border-red-300 animate-[shake_0.3s_ease-in-out]' : 'border-transparent',
            )}
          />
        </div>
        {error && (
          <p className="text-sm text-red-500 font-medium text-center">Wrong password.</p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 min-h-[48px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          <IconLock size={18} />
          {loading ? 'Unlocking...' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

/* ── Credential Card ──────────────────────────────── */

function CredentialCard({
  credential,
  decrypted,
  clientName,
  index,
  onEdit,
  onDelete,
}: {
  credential: VaultCredential;
  decrypted?: DecryptedCredentialData;
  clientName: string;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const svc = serviceInfo(credential.service);

  function toggleReveal(field: string) {
    setRevealed((r) => ({ ...r, [field]: !r[field] }));
  }

  async function copyValue(field: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  const fields: { key: keyof DecryptedCredentialData; label: string; sensitive: boolean }[] = [
    { key: 'username', label: 'Username', sensitive: false },
    { key: 'password', label: 'Password', sensitive: true },
    { key: 'apiKey', label: 'API Key', sensitive: true },
    { key: 'notes', label: 'Notes', sensitive: false },
  ];

  const hasFields = decrypted && fields.some((f) => decrypted[f.key]);

  return (
    <div
      className="rounded-xl border border-[var(--border)] overflow-hidden animate-fade-in-up hover-lift active:scale-[0.97] transition-transform"
      style={{ animationDelay: `${index * 40}ms`, borderLeft: `4px solid ${svc.color}`, background: `linear-gradient(to right, ${svc.color}08, transparent 40%) white` }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left min-h-[64px]"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: svc.color }}
        >
          {svc.label.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{credential.label}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: svc.color, backgroundColor: `${svc.color}15` }}>
              {svc.label}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">{clientName}</span>
          </div>
        </div>
        <IconChevronDown size={16} className={cn('transition-transform duration-200 flex-shrink-0', expanded && 'rotate-180')} />
      </button>

      {/* Expanded details */}
      {expanded && hasFields && (
        <div className="px-4 pb-4 space-y-2 border-t border-[var(--border)] pt-3 bg-[var(--bg-page)]">
          {fields.filter((f) => decrypted?.[f.key]).map((f, idx) => {
            const val = decrypted?.[f.key];
            if (!val) return null;
            const isRevealed = revealed[f.key] || !f.sensitive;
            const displayVal = isRevealed ? val : '\u2022'.repeat(Math.min(val.length, 24));

            return (
              <div key={f.key} className={cn('flex items-center gap-2', idx % 2 === 0 && 'bg-[var(--bg-card)] rounded-lg px-2 py-1.5')}>
                <span className="text-xs text-[var(--text-secondary)] w-20 flex-shrink-0">{f.label}</span>
                <span className={cn(
                  'flex-1 text-sm truncate',
                  f.key === 'notes' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] font-mono text-xs',
                  !isRevealed && f.sensitive && 'tracking-wider',
                )}>
                  {displayVal}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  {f.sensitive && (
                    <button
                      onClick={() => toggleReveal(f.key)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      title={isRevealed ? 'Hide' : 'Reveal'}
                    >
                      {isRevealed ? (
                        <IconEyeOff size={16} />
                      ) : (
                        <IconEye size={16} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => copyValue(f.key, val)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title="Copy"
                  >
                    {copied === f.key ? (
                      <IconCheckSmall size={16} color="#22C55E" className="animate-[scale-bounce_0.3s_ease-out]" />
                    ) : (
                      <IconCopy size={16} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 min-h-[32px] transition-colors"
            >
              <IconEdit size={14} />
              Edit
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-red)] bg-[var(--color-red)]/10 hover:bg-[var(--color-red)]/20 min-h-[32px] transition-colors ml-auto"
              >
                <IconTrash size={14} />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] min-h-[32px] transition-colors hover:bg-[var(--bg-input)]"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-red)] text-white min-h-[32px] transition-all hover:brightness-90"
                >
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Add/Edit Modal ───────────────────────────────── */

function CredentialModal({
  clients,
  existing,
  existingDecrypted,
  onSave,
  onClose,
}: {
  clients: Client[];
  existing: VaultCredential | null;
  existingDecrypted?: DecryptedCredentialData;
  onSave: (data: { clientId: string; service: string; label: string; secret: DecryptedCredentialData }, existingId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState(existing?.clientId ?? '');
  const [service, setService] = useState<VaultServiceId>(existing?.service as VaultServiceId ?? 'firebase');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [username, setUsername] = useState(existingDecrypted?.username ?? '');
  const [password, setPassword] = useState(existingDecrypted?.password ?? '');
  const [apiKey, setApiKey] = useState(existingDecrypted?.apiKey ?? '');
  const [notes, setNotes] = useState(existingDecrypted?.notes ?? '');
  const [customService, setCustomService] = useState(
    existing?.service && !VAULT_SERVICES.some(s => s.id === existing.service)
      ? existing.service
      : ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValid = clientId && label.trim() && (service !== 'other' || customService.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    await onSave(
      {
        clientId,
        service: service === 'other' && customService.trim() ? customService.trim() : service,
        label: label.trim(),
        secret: {
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      },
      existing?.id,
    );
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] z-10 flex justify-between items-center px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] uppercase tracking-wide">
            {existing ? 'Edit Credential' : 'Add Credential'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Service */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-2">
              Service
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VAULT_SERVICES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setService(s.id as VaultServiceId)}
                  className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl min-h-[40px] text-xs font-semibold transition-all active:scale-[0.95]"
                  style={{
                    backgroundColor: service === s.id ? s.color : 'var(--bg-input)',
                    color: service === s.id ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: service === s.id ? 'rgba(255,255,255,0.5)' : s.color,
                    }}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {service === 'other' && (
            <div className="mt-2">
              <input
                type="text"
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                placeholder="Enter service name (e.g. Cloudflare, DigitalOcean)"
                autoFocus
                className="w-full px-3 py-3 min-h-[44px] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-[var(--border)] my-4" />

          {/* Client */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-3 min-h-[44px] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div className="mt-3">
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production API Key"
              className="w-full px-3 py-3 min-h-[44px] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border)] my-4" />

          {/* Username */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              className="w-full px-3 py-3 min-h-[44px] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Password */}
          <div className="mt-3">
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
              Password / Secret
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optional"
                autoComplete="new-password"
                className="w-full px-3 py-3 min-h-[44px] pr-12 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="mt-3">
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Optional"
                autoComplete="off"
                className="w-full px-3 py-3 min-h-[44px] pr-12 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showApiKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border)] my-4" />

          {/* Notes */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context, URLs, etc."
              rows={2}
              className="w-full px-3 py-3 min-h-[44px] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Encryption indicator */}
        <div className="text-[10px] text-[var(--text-secondary)] text-center py-2 flex items-center justify-center gap-1">
          <IconLock size={10} />
          All fields encrypted with AES-256-GCM
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--bg-card)] z-10 flex gap-3 px-5 py-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 min-h-[48px] rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || saving}
            className="flex-1 py-3 min-h-[48px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <IconLock size={14} />
                Encrypting...
              </>
            ) : existing ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
