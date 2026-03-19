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
              : 'border border-[#DDD5C8] text-[#8C7E6A] hover:bg-[#EDE9E2]'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
