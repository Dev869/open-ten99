import { Link } from 'react-router-dom';
import type { WorkItem } from '../lib/types';
import { TypeTag } from './TypeTag';
import { formatCurrency, formatHours } from '../lib/utils';
import { typeColor } from '../lib/theme';

interface WorkItemCardProps {
  item: WorkItem;
  clientName: string;
  appName?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function WorkItemCard({
  item,
  clientName,
  appName,
  selectable,
  selected,
  onSelect,
}: WorkItemCardProps) {
  const borderColor = typeColor(item.type);

  return (
    <div
      className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] flex items-start gap-3 group hover-lift"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect?.(item.id!)}
          className="mt-1.5 accent-[var(--accent)]"
        />
      )}
      <Link
        to={`/dashboard/work-items/${item.id}`}
        className="flex-1 min-w-0"
      >
        {/* Row 1: Subject + Status badge */}
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
              {item.subject}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-[var(--text-secondary)]">{clientName}</span>
              {appName && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-input)] text-[var(--text-secondary)] font-medium">
                  {appName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {item.clientApproval && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                item.clientApproval === 'approved' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                item.clientApproval === 'rejected' ? 'bg-red-500/15 text-red-500' :
                'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}>
                {item.clientApproval === 'approved' ? 'Approved' : item.clientApproval === 'rejected' ? 'Rejected' : 'Pending'}
              </span>
            )}
            {item.completed ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                Done
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)] whitespace-nowrap">
                Open
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Tags + metrics */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <TypeTag type={item.type} />
          {!item.isBillable && (
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] px-2 py-0.5 rounded-full">
              Non-Billable
            </span>
          )}
          {item.assigneeId && (
            <span className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[8px] font-bold" title={item.assigneeId}>
              {item.assigneeId.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="ml-auto text-[11px] text-[var(--text-secondary)] tabular-nums">
            {formatHours(item.totalHours)}
          </span>
          <span className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums">
            {formatCurrency(item.totalCost)}
          </span>
        </div>
      </Link>
    </div>
  );
}
