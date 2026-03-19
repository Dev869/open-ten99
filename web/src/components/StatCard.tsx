interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ label, value, color = '#1A1A2E' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-[#E5E5EA] flex-1">
      <div className="text-[10px] text-[#86868B] uppercase font-semibold tracking-wide">
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
