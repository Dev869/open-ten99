import { cn } from '../../lib/utils';

interface FilterTabsProps {
  tabs: string[];
  selected: string;
  onSelect: (tab: string) => void;
  label?: string;
}

export function FilterTabs({ tabs, selected, onSelect, label }: FilterTabsProps) {
  return (
    <>
      {/* Mobile: compact dropdown */}
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="md:hidden h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-primary)] min-w-0 flex-1"
        aria-label={label}
      >
        {tabs.map((tab) => (
          <option key={tab} value={tab}>{tab === 'All' && label ? `All ${label}` : tab}</option>
        ))}
      </select>

      {/* Desktop: pill tabs */}
      <div className="hidden md:flex gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onSelect(tab)}
            className={cn(
              'px-3 py-1.5 min-h-[32px] rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              selected === tab
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </>
  );
}
