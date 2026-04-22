import { WORK_ITEM_STATUS_LABELS, type WorkItemStatus } from '../../lib/types';
import { statusColor } from '../../lib/theme';

interface StatusBadgeProps {
  status: WorkItemStatus;
}

const statusBgMap: Record<WorkItemStatus, string> = {
  draft: 'bg-[var(--color-orange)]/15',
  inReview: 'bg-[var(--accent)]/15',
  approved: 'bg-[var(--color-green)]/15',
  completed: 'bg-[var(--bg-input)]',
  archived: 'bg-[var(--bg-input)]',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`${statusBgMap[status]} text-[9px] font-bold px-2 py-0.5 rounded-full uppercase`}
      style={{ color: statusColor(status) }}
    >
      {WORK_ITEM_STATUS_LABELS[status]}
    </span>
  );
}
