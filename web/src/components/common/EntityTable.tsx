import type { ReactNode } from 'react';

/**
 * Column definition for {@link EntityTable}.
 *
 * @typeParam T - The row data type.
 */
export interface EntityTableColumn<T> {
  /** Stable key for the column. */
  key: string;
  /** Header label (rendered in the uppercase header style). */
  header: string;
  /** Horizontal alignment for header + cell. Defaults to `'left'`. */
  align?: 'left' | 'right';
  /** Optional extra class names applied to each `<td>` for this column. */
  cellClassName?: string;
  /** Renders the cell content for a given row. */
  render: (item: T) => ReactNode;
}

interface EntityTableProps<T> {
  items: T[];
  columns: EntityTableColumn<T>[];
  /** Resolves the stable id for a row (used for selection + keys). */
  getRowId: (item: T) => string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** Invoked when a row body (not the checkbox) is clicked. */
  onRowClick?: (item: T) => void;
  /** Accessible label for a row's selection checkbox. */
  getRowSelectLabel?: (item: T) => string;
  /** Message shown when there are no rows. */
  emptyMessage?: string;
}

/**
 * Shared, column-driven data table used by both the Invoices list and the
 * Work Orders list so the two stay visually identical. The markup and styling
 * mirror the original `InvoiceTable` exactly (bordered container, uppercase
 * header row, select-all checkbox, hover/selected row states).
 */
export function EntityTable<T>({
  items,
  columns,
  getRowId,
  selectedIds,
  onSelectionChange,
  onRowClick,
  getRowSelectLabel,
  emptyMessage = 'No items found.',
}: EntityTableProps<T>) {
  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.has(getRowId(item)));

  function handleSelectAll(checked: boolean) {
    if (checked) {
      onSelectionChange(new Set(items.map((item) => getRowId(item))));
    } else {
      onSelectionChange(new Set());
    }
  }

  function handleRowSelect(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    onSelectionChange(next);
  }

  const colSpan = columns.length + 1;

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--bg-card)] border-b border-[var(--border)]">
            <th className="px-4 py-3 text-left w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-[var(--border)] accent-[var(--accent)]"
                aria-label="Select all"
              />
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-8 text-center text-[var(--text-secondary)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const id = getRowId(item);
              const isSelected = selectedIds.has(id);

              return (
                <tr
                  key={id}
                  className={`border-b border-[var(--border)] last:border-b-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent)]/5'
                      : 'bg-[var(--bg-page)] hover:bg-[var(--bg-card)]'
                  }`}
                  onClick={() => onRowClick?.(item)}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleRowSelect(id, e.target.checked)}
                      className="rounded border-[var(--border)] accent-[var(--accent)]"
                      aria-label={getRowSelectLabel?.(item) ?? 'Select row'}
                    />
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${
                        col.align === 'right' ? 'text-right' : ''
                      } ${col.cellClassName ?? ''}`}
                    >
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
