import { WORK_ITEM_STATUS_LABELS, type WorkItemStatus } from '../lib/types';
import { statusColor } from '../lib/theme';

interface StatusBadgeProps {
  status: WorkItemStatus;
}

const statusBgMap: Record<WorkItemStatus, string> = {
  draft: 'bg-[#FFF3E0]',
  inReview: 'bg-[#E8F5F5]',
  approved: 'bg-[#E8F5E9]',
  completed: 'bg-[#EDE9E2]',
  archived: 'bg-[#EDE9E2]',
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
