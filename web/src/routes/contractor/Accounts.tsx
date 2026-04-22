import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useConnectedAccounts } from '../../hooks/useFirestore';
import { deleteConnectedAccount } from '../../services/firestore';
import { ConnectedAccountCard } from '../../components/finance/ConnectedAccountCard';
import { PlaidLinkButton } from '../../components/finance/PlaidLinkButton';
import { StripeConnectForm } from '../../components/finance/StripeConnectForm';
import { useToast } from '../../hooks/useToast';

export default function Accounts() {
  const { accounts, loading } = useConnectedAccounts();
  const { addToast } = useToast();

  // Per-account syncing state
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  // Plaid link token state
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [plaidFetchError, setPlaidFetchError] = useState<string | null>(null);

  // Stripe connect state
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  // Fetch Plaid link token on demand (not on mount — Cloud Functions may not be deployed)
  const fetchLinkToken = useCallback(async () => {
    setPlaidFetchError(null);
    setPlaidLoading(true);
    try {
      const fn = httpsCallable<Record<string, never>, { linkToken: string }>(
        functions,
        'onPlaidLinkToken'
      );
      const result = await fn({});
      setLinkToken(result.data.linkToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cloud Functions not deployed yet. Run: firebase deploy --only functions';
      setPlaidFetchError(message);
      console.error('Failed to fetch Plaid link token:', err);
    } finally {
      setPlaidLoading(false);
    }
  }, []);

  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    setPlaidLoading(true);
    try {
      const fn = httpsCallable(functions, 'onPlaidExchange');
      await fn({ publicToken });
      addToast('Bank account connected!', 'success');
      // Refresh link token for next connection
      const tokenFn = httpsCallable<Record<string, never>, { linkToken: string }>(
        functions,
        'onPlaidLinkToken'
      );
      const result = await tokenFn({});
      setLinkToken(result.data.linkToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect bank account';
      addToast(message, 'error');
      console.error('Plaid exchange failed:', err);
    } finally {
      setPlaidLoading(false);
    }
  }, [addToast]);

  const handlePlaidExit = useCallback(() => {
    // User cancelled — no action needed
  }, []);

  const handleStripeConnect = useCallback(async (apiKey: string) => {
    setStripeLoading(true);
    setStripeError(null);
    try {
      const fn = httpsCallable(functions, 'onStripeConnect');
      await fn({ apiKey });
      addToast('Stripe connected!', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Stripe';
      setStripeError(message);
      console.error('Stripe connect failed:', err);
    } finally {
      setStripeLoading(false);
    }
  }, [addToast]);

  const handleSync = useCallback(async (accountId: string) => {
    setSyncingIds((prev) => new Set(prev).add(accountId));
    try {
      const fn = httpsCallable(functions, 'onManualSync');
      await fn({ accountId });
      addToast('Sync complete', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      addToast(message, 'error');
      console.error('Manual sync failed:', err);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  }, [addToast]);

  const handleDisconnect = useCallback(async (accountId: string) => {
    try {
      await deleteConnectedAccount(accountId);
      addToast('Account disconnected', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect account';
      addToast(message, 'error');
      console.error('Disconnect failed:', err);
    }
  }, [addToast]);

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="hidden md:block mb-6">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Connected Accounts
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Link your bank accounts and payment processors to automatically import transactions.
        </p>
      </div>

      {/* Connected accounts list */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Your Accounts
        </h2>
        {loading ? (
          <div className="text-sm text-[var(--text-secondary)] py-6 text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            Loading…
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)] py-8 text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            No accounts connected yet. Add one below to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {accounts.map((account) => (
              <ConnectedAccountCard
                key={account.id}
                account={account}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                syncing={syncingIds.has(account.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Add Connection section */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Add Connection
        </h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          {/* Bank Account subsection */}
          <div className="p-5 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Bank Account
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Connect via Plaid to automatically import bank and credit card transactions.
            </p>
            {plaidFetchError && (
              <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg mb-3">
                {plaidFetchError}
              </div>
            )}
            {linkToken ? (
              <PlaidLinkButton
                linkToken={linkToken}
                onSuccess={handlePlaidSuccess}
                onExit={handlePlaidExit}
                loading={plaidLoading}
              />
            ) : (
              <button
                onClick={fetchLinkToken}
                disabled={plaidLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {plaidLoading ? 'Loading...' : 'Connect Bank Account'}
              </button>
            )}
          </div>

          {/* Stripe subsection */}
          <div className="p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Stripe
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Connect your Stripe account to import payments and payouts.
            </p>
            <StripeConnectForm
              onConnect={handleStripeConnect}
              loading={stripeLoading}
              error={stripeError}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
