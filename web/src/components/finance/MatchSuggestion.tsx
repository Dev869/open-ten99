import { formatCurrency } from '../../lib/utils';

interface MatchSuggestionProps {
  transactionId: string;
  workItemSubject: string;
  workItemAmount: number;
  confidence: number;
  onConfirm: (transactionId: string, workItemId: string) => void;
  onReject: (transactionId: string) => void;
  workItemId: string;
  loading?: boolean;
}

export function MatchSuggestion({
  transactionId,
  workItemSubject,
  workItemAmount,
  confidence,
  onConfirm,
  onReject,
  workItemId,
  loading = false,
}: MatchSuggestionProps) {
  const confidencePct = Math.round(confidence * 100);

  return (
    <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-lg p-3 mt-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">
            Match Suggestion ({confidencePct}% confidence)
          </span>
          <span className="text-sm text-[var(--text-primary)]">
            Matches:{' '}
            <span className="font-medium">{workItemSubject}</span>{' '}
            <span className="text-[var(--text-secondary)]">
              ({formatCurrency(workItemAmount)})
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onConfirm(transactionId, workItemId)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
          <button
            onClick={() => onReject(transactionId)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
