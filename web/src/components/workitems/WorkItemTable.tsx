import type { WorkItem, Client } from '../../lib/types';
import { formatCurrency, formatHours, formatDate } from '../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { TypeTag } from './TypeTag';
import { InsightBadge } from '../insights/InsightBadge';
import { EntityTable, type EntityTableColumn } from '../common/EntityTable';
import type { CompletionEstimate, ScopeCreepAlert } from '../../lib/types';

interface WorkItemTableProps {
  workItems: WorkItem[];
  clients: Client[];
  appMap: Record<string, string>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (workItem: WorkItem) => void;
  completionEstimates?: CompletionEstimate[];
  scopeCreep?: ScopeCreepAlert[];
}

/**
 * Work Orders list rendered with the shared {@link EntityTable} so it is
 * visually identical to the Invoices list. Columns are adapted to
 * work-order-relevant fields (subject/client, type, hours, cost, created,
 * status) mirroring how the invoice table shows its analogous fields.
 */
export function WorkItemTable({
  workItems,
  clients,
  appMap,
  selectedIds,
  onSelectionChange,
  onRowClick,
  completionEstimates,
  scopeCreep,
}: WorkItemTableProps) {
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const columns: EntityTableColumn<WorkItem>[] = [
    {
      key: 'subject',
      header: 'Work Order / Client',
      render: (item) => {
        const clientName = clientMap.get(item.clientId) ?? item.clientId;
        const appName = item.appId ? appMap[item.appId] : undefined;
        return (
          <>
            <div className="font-medium text-[var(--text-primary)] truncate max-w-xs">
              {item.subject || '(No subject)'}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              {clientName}
              {appName && (
                <span className="ml-1.5 text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] px-1.5 py-0.5 rounded">
                  {appName}
                </span>
              )}
              {!item.isBillable && (
                <span className="ml-1.5 text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] px-1.5 py-0.5 rounded">
                  Non-Billable
                </span>
              )}
            </div>
          </>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (item) => <TypeTag type={item.type} />,
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'right',
      cellClassName: 'font-mono text-[var(--text-secondary)] tabular-nums',
      render: (item) => formatHours(item.totalHours),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      cellClassName: 'font-mono text-[var(--text-primary)] tabular-nums',
      render: (item) => formatCurrency(item.totalCost),
    },
    {
      key: 'created',
      header: 'Created',
      cellClassName: 'text-[var(--text-secondary)]',
      render: (item) => formatDate(item.createdAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const estimate = completionEstimates?.find((e) => e.workItemId === item.id);
        const creep = scopeCreep?.find((s) => s.workItemId === item.id);
        return (
          <div className="flex flex-col gap-1 items-start">
            <StatusBadge status={item.status} />
            {item.clientApproval && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  item.clientApproval === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : item.clientApproval === 'rejected'
                      ? 'bg-red-500/15 text-red-500'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {item.clientApproval === 'approved'
                  ? 'Approved'
                  : item.clientApproval === 'rejected'
                    ? 'Rejected'
                    : 'Pending'}
              </span>
            )}
            {estimate && (
              <InsightBadge
                label={`~${estimate.estimatedDays}d`}
                level="info"
                tooltip={`Estimated ${estimate.estimatedDays} days (${Math.round(
                  estimate.confidence * 100,
                )}% confidence)`}
              />
            )}
            {creep && (
              <InsightBadge label="Scope creep" level={creep.severity} tooltip={creep.reason} />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <EntityTable
      items={workItems}
      columns={columns}
      getRowId={(item) => item.id ?? ''}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onRowClick={onRowClick}
      getRowSelectLabel={(item) => `Select ${item.subject}`}
      emptyMessage="No work orders found."
    />
  );
}
