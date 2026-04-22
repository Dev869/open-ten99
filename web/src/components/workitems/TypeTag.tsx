import { WORK_ITEM_TYPE_LABELS, type WorkItemType } from '../../lib/types';
import { typeColor } from '../../lib/theme';

interface TypeTagProps {
  type: WorkItemType;
}

export function TypeTag({ type }: TypeTagProps) {
  const color = typeColor(type);
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        color,
        backgroundColor: `${color}18`,
      }}
    >
      {WORK_ITEM_TYPE_LABELS[type]}
    </span>
  );
}
