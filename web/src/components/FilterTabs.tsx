import { cn } from '../lib/utils';

interface FilterTabsProps {
  tabs: string[];
  selected: string;
  onSelect: (tab: string) => void;
}

export function FilterTabs({ tabs, selected, onSelect }: FilterTabsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onSelect(tab)}
          className={cn(
            'px-3 py-2 min-h-[36px] rounded-full text-xs font-medium transition-colors',
            selected === tab
              ? 'bg-[var(--accent)] text-white'
              : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
