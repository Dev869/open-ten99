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

/* ── Constants ────────────────────────────────────── */

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function serviceInfo(id: string) {
  return VAULT_SERVICES.find((s) => s.id === id) ?? VAULT_SERVICES[VAULT_SERVICES.length - 1];
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
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCred, setEditingCred] = useState<VaultCredential | null>(null);
  const [search, setSearch] = useState('');
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout>>();

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

  // Filter + search
  const filtered = credentials.filter((c) => {
    if (filter !== 'all' && c.clientId !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const svc = serviceInfo(c.service);
      return (
        c.label.toLowerCase().includes(q) ||
        svc.label.toLowerCase().includes(q) ||
        (clientMap[c.clientId] ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Render
  if (metaLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-sm text-[#86868B]">Loading vault...</div>
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
    <div className="max-w-3xl animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider">
            Key Vault
          </h1>
          <p className="text-xs text-[#86868B] mt-1">
            AES-256 encrypted &middot; Auto-locks after 5 min
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingCred(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 py-2.5 px-5 min-h-[44px] rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] active:scale-[0.97] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Credential
          </button>
          <button
            onClick={lock}
            className="inline-flex items-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl border border-[#E5E5EA] text-sm font-medium text-[#86868B] hover:bg-[#F2F2F7] active:scale-[0.97] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Lock
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none"
        >
          <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11.5 11.5L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search credentials..."
          className="w-full pl-11 pr-4 py-2.5 min-h-[44px] bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8] shadow-sm transition-shadow"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'min-h-[36px] px-3.5 rounded-full text-xs font-medium transition-colors',
            filter === 'all' ? 'bg-[#4BA8A8] text-white' : 'border border-[#E5E5EA] text-[#86868B] hover:bg-[#F2F2F7]',
          )}
        >
          All ({credentials.length})
        </button>
        {clients.filter((c) => credentials.some((cr) => cr.clientId === c.id)).map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id!)}
            className={cn(
              'min-h-[36px] px-3.5 rounded-full text-xs font-medium transition-colors',
              filter === c.id ? 'bg-[#4BA8A8] text-white' : 'border border-[#E5E5EA] text-[#86868B] hover:bg-[#F2F2F7]',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Credentials */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <div className="text-4xl mb-3 opacity-30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-40">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div className="text-sm text-[#86868B]">
            {credentials.length === 0 ? 'No credentials yet. Add your first one.' : 'No results match your search.'}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((cred, i) => (
            <CredentialCard
              key={cred.id}
              credential={cred}
              decrypted={decryptedMap[cred.id!]}
              clientName={clientMap[cred.clientId] ?? 'Unknown'}
              index={i}
              onEdit={() => { setEditingCred(cred); setShowModal(true); }}
              onDelete={() => handleDelete(cred.id!)}
            />
          ))}
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
        <div className="w-16 h-16 rounded-2xl bg-[#1A1A2E] flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
            <circle cx="12" cy="16" r="1" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider">
          Create Your Vault
        </h1>
        <p className="text-sm text-[#86868B] mt-2 max-w-xs mx-auto">
          Set a master password to encrypt your client credentials. This password is never stored — if you forget it, your data cannot be recovered.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E5E5EA] p-6 space-y-4">
        <div>
          <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
            Master Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="At least 8 characters"
            autoFocus
            className="w-full px-3.5 py-3 min-h-[44px] bg-[#F2F2F7] rounded-xl text-sm text-[#1A1A2E] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#4BA8A8] transition-shadow"
          />
          {strengthLabel && (
            <p className={cn('text-xs font-medium mt-1.5', strengthColor)}>
              Strength: {strengthLabel}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            placeholder="Repeat your password"
            className="w-full px-3.5 py-3 min-h-[44px] bg-[#F2F2F7] rounded-xl text-sm text-[#1A1A2E] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#4BA8A8] transition-shadow"
          />
        </div>
        {error && (
          <p className="text-sm text-red-500 font-medium">{error}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 min-h-[48px] rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {saving ? 'Creating Vault...' : 'Create Vault'}
        </button>
      </form>

      <p className="text-center text-[10px] text-[#86868B] mt-4 max-w-xs mx-auto leading-relaxed">
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
        <div className="w-16 h-16 rounded-2xl bg-[#1A1A2E] flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider">
          Vault Locked
        </h1>
        <p className="text-sm text-[#86868B] mt-2">
          Enter your master password to unlock.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E5E5EA] p-6 space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Master password"
          autoFocus
          className={cn(
            'w-full px-3.5 py-3 min-h-[44px] bg-[#F2F2F7] rounded-xl text-sm text-[#1A1A2E] border focus:outline-none focus:ring-2 focus:ring-[#4BA8A8] transition-shadow',
            error ? 'border-red-300 animate-[shake_0.3s_ease-in-out]' : 'border-transparent',
          )}
        />
        {error && (
          <p className="text-sm text-red-500 font-medium text-center">Wrong password.</p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 min-h-[48px] rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 018-4.3" />
          </svg>
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
      className="bg-white rounded-xl border border-[#E5E5EA] overflow-hidden animate-fade-in-up hover-lift"
      style={{ animationDelay: `${index * 40}ms`, borderLeft: `3px solid ${svc.color}` }}
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
          <div className="text-sm font-semibold text-[#1A1A2E] truncate">{credential.label}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: svc.color, backgroundColor: `${svc.color}15` }}>
              {svc.label}
            </span>
            <span className="text-xs text-[#86868B]">{clientName}</span>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round"
          className={cn('transition-transform duration-200 flex-shrink-0', expanded && 'rotate-180')}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && hasFields && (
        <div className="px-4 pb-4 space-y-2 border-t border-[#F2F2F7] pt-3">
          {fields.map((f) => {
            const val = decrypted?.[f.key];
            if (!val) return null;
            const isRevealed = revealed[f.key] || !f.sensitive;
            const displayVal = isRevealed ? val : '\u2022'.repeat(Math.min(val.length, 24));

            return (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-xs text-[#86868B] w-20 flex-shrink-0">{f.label}</span>
                <span className={cn(
                  'flex-1 text-sm truncate',
                  f.key === 'notes' ? 'text-[#86868B]' : 'text-[#1A1A2E] font-mono text-xs',
                  !isRevealed && f.sensitive && 'tracking-wider',
                )}>
                  {displayVal}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  {f.sensitive && (
                    <button
                      onClick={() => toggleReveal(f.key)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F2F2F7] text-[#86868B] hover:text-[#1A1A2E] transition-colors"
                      title={isRevealed ? 'Hide' : 'Reveal'}
                    >
                      {isRevealed ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => copyValue(f.key, val)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F2F2F7] text-[#86868B] hover:text-[#1A1A2E] transition-colors"
                    title="Copy"
                  >
                    {copied === f.key ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4BA8A8] bg-[#4BA8A8]/10 hover:bg-[#4BA8A8]/20 min-h-[32px] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.85 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              Edit
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 min-h-[32px] transition-colors ml-auto"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-[#86868B] border border-[#E5E5EA] min-h-[32px] transition-colors hover:bg-[#F2F2F7]"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white min-h-[32px] transition-colors hover:bg-red-600"
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
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValid = clientId && label.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    await onSave(
      {
        clientId,
        service,
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
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-5 py-4 border-b border-[#E5E5EA]">
          <h2 className="text-lg font-extrabold text-[#1A1A2E] uppercase tracking-wide">
            {existing ? 'Edit Credential' : 'Add Credential'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#86868B] hover:bg-[#F2F2F7] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Service */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-2">
              Service
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VAULT_SERVICES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setService(s.id as VaultServiceId)}
                  className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl min-h-[40px] text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: service === s.id ? s.color : '#F5F5F7',
                    color: service === s.id ? 'white' : '#86868B',
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

          {/* Divider */}
          <div className="border-t border-[#F2F2F7] my-4" />

          {/* Client */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-3 min-h-[44px] bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div className="mt-3">
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production API Key"
              className="w-full px-3 py-3 min-h-[44px] bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-[#F2F2F7] my-4" />

          {/* Username */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              className="w-full px-3 py-3 min-h-[44px] bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>

          {/* Password */}
          <div className="mt-3">
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
              Password / Secret
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optional"
                autoComplete="new-password"
                className="w-full px-3 py-3 min-h-[44px] pr-12 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8] font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1A1A2E] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="mt-3">
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Optional"
                autoComplete="off"
                className="w-full px-3 py-3 min-h-[44px] pr-12 bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8] font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1A1A2E] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {showApiKey ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#F2F2F7] my-4" />

          {/* Notes */}
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context, URLs, etc."
              rows={2}
              className="w-full px-3 py-3 min-h-[44px] bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] resize-none focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white z-10 flex gap-3 px-5 py-4 border-t border-[#E5E5EA]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 min-h-[48px] rounded-xl border border-[#E5E5EA] text-sm font-medium text-[#86868B] hover:bg-[#F2F2F7] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || saving}
            className="flex-1 py-3 min-h-[48px] rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Encrypting...
              </>
            ) : existing ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
