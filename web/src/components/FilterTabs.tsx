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
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            selected === tab
              ? 'bg-[#4BA8A8] text-white'
              : 'border border-[#E5E5EA] text-[#86868B] hover:bg-[#F2F2F7]'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
