interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ label, value, color = '#2C2417' }: StatCardProps) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[#DDD5C8] flex-1">
      <div className="text-[10px] text-[#8C7E6A] uppercase font-semibold tracking-wide">
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
