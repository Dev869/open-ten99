interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ label, value, color = 'var(--text-primary)' }: StatCardProps) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] flex-1">
      <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
        {label}
      </div>
      <div
        className="text-2xl font-extrabold mt-1"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
