import { useState } from 'react';

interface StripeConnectFormProps {
  onConnect: (apiKey: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function StripeConnectForm({ onConnect, loading, error }: StripeConnectFormProps) {
  const [apiKey, setApiKey] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    await onConnect(apiKey.trim());
    setApiKey('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="stripe-key" className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          Stripe Restricted API Key
        </label>
        <input
          id="stripe-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="rk_live_..."
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          disabled={loading}
        />
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Enter a restricted key with charges:read, balance:read, and payment_intents:read permissions.
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !apiKey.trim()}
        className="px-4 py-2.5 rounded-lg bg-[#6366f1] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Validating...' : 'Connect Stripe'}
      </button>
    </form>
  );
}
