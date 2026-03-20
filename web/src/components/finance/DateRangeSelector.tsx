import type { DateRangePreset } from '../../lib/finance';

interface DateRangeSelectorProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
}

// Only MTD, QTD, YTD presets (Custom deferred to Phase 2)
const presets: { value: DateRangePreset; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'qtd', label: 'QTD' },
  { value: 'ytd', label: 'YTD' },
];

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {presets.map((preset) => (
        <button
          key={preset.value}
          onClick={() => onChange(preset.value)}
          className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-medium transition-colors ${
            value === preset.value
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
