import { Link } from 'react-router-dom';
import type { WorkItem } from '../lib/types';
import { StatusBadge } from './StatusBadge';
import { TypeTag } from './TypeTag';
import { formatCurrency, formatHours } from '../lib/utils';
import { typeColor } from '../lib/theme';

interface WorkItemCardProps {
  item: WorkItem;
  clientName: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function WorkItemCard({
  item,
  clientName,
  selectable,
  selected,
  onSelect,
}: WorkItemCardProps) {
  const borderColor = typeColor(item.type);

  return (
    <div
      className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border)] flex items-start gap-3 group hover-lift"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect?.(item.id!)}
          className="mt-1 accent-[var(--accent)]"
        />
      )}
      <Link
        to={`/dashboard/work-items/${item.id}`}
        className="flex-1 min-w-0"
      >
        <div className="flex justify-between items-start mb-1.5">
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text-primary)] truncate">
              {item.subject}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">{clientName}</div>
          </div>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <TypeTag type={item.type} />
          {!item.isBillable && (
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] px-2 py-0.5 rounded-full">
              Non-Billable
            </span>
          )}
          <span className="ml-auto text-xs text-[var(--text-secondary)]">
            {formatHours(item.totalHours)}
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {formatCurrency(item.totalCost)}
          </span>
        </div>
      </Link>
    </div>
  );
}
