interface ReceiptBadgeProps {
  status: 'confirmed' | 'matched' | 'none';
  onClick?: () => void;
}

export default function ReceiptBadge({ status, onClick }: ReceiptBadgeProps) {
  if (status === 'confirmed') {
    return (
      <button onClick={onClick} className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400 cursor-pointer hover:bg-green-500/30">
        🧾 ✓
      </button>
    );
  }

  if (status === 'matched') {
    return (
      <button onClick={onClick} className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400 cursor-pointer hover:bg-yellow-500/30">
        🧾 ?
      </button>
    );
  }

  return (
    <button onClick={onClick} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer">
      —
    </button>
  );
}
