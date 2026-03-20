import type { ConnectedAccount } from '../../lib/types';

interface ConnectedAccountCardProps {
  account: ConnectedAccount;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  syncing?: boolean;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function StatusDot({ status }: { status: ConnectedAccount['status'] }) {
  const colors: Record<ConnectedAccount['status'], string> = {
    active: 'bg-green-500',
    error: 'bg-red-500',
    disconnected: 'bg-gray-400',
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status]}`}
      aria-hidden="true"
    />
  );
}

function ProviderBadge({ provider }: { provider: ConnectedAccount['provider'] }) {
  if (provider === 'stripe') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#635BFF]/15 text-[#635BFF]">
        Stripe
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[var(--accent)]/15 text-[var(--accent)]">
      Plaid
    </span>
  );
}

export function ConnectedAccountCard({
  account,
  onSync,
  onDisconnect,
  syncing = false,
}: ConnectedAccountCardProps) {
  function handleDisconnect() {
    const confirmed = window.confirm(
      `Disconnect "${account.institutionName} ${account.accountName}"? This will remove access to this account.`
    );
    if (confirmed) {
      onDisconnect(account.id);
    }
  }

  const lastSyncedLabel = account.lastSyncedAt
    ? `Synced ${formatRelativeTime(account.lastSyncedAt)}`
    : 'Never synced';

  const statusLabel: Record<ConnectedAccount['status'], string> = {
    active: 'Active',
    error: 'Error',
    disconnected: 'Disconnected',
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={account.status} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {account.institutionName} {account.accountName}
              {account.accountMask ? (
                <span className="text-[var(--text-secondary)] font-normal ml-1">
                  ····{account.accountMask}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {statusLabel[account.status]} · {lastSyncedLabel}
            </p>
          </div>
        </div>
        <ProviderBadge provider={account.provider} />
      </div>

      {/* Error banner */}
      {account.status === 'error' && account.errorMessage && (
        <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
          {account.errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSync(account.id)}
          disabled={syncing}
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-xs font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
        <button
          onClick={handleDisconnect}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
