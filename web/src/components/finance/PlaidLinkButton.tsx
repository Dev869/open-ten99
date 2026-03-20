import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  linkToken: string | null;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
  loading?: boolean;
}

export function PlaidLinkButton({ linkToken, onSuccess, onExit, loading }: PlaidLinkButtonProps) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => onSuccess(publicToken),
    onExit: () => onExit(),
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading || !linkToken}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Connecting...' : 'Connect Bank Account'}
    </button>
  );
}
