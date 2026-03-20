import { formatCurrency, formatDate } from '../../lib/utils';
import type { WorkItem, Client } from '../../lib/types';

interface ActivityFeedProps {
  workItems: readonly WorkItem[];
  clients: readonly Client[];
  maxItems?: number;
}

interface ActivityItem {
  id: string;
  label: string;
  clientName: string;
  amount: number;
  date: Date;
  color: string;
  status: string;
}

function buildActivityItems(workItems: readonly WorkItem[], clients: readonly Client[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const item of workItems) {
    if (!item.isBillable || !item.id) continue;

    const clientName = clients.find((c) => c.id === item.clientId)?.name ?? item.clientId;

    if (item.invoiceStatus === 'paid' && item.invoicePaidDate) {
      items.push({
        id: `${item.id}-paid`,
        label: 'Invoice Paid',
        clientName,
        amount: item.totalCost,
        date: item.invoicePaidDate,
        color: 'var(--color-green)',
        status: 'paid',
      });
    } else if (item.invoiceStatus === 'overdue' && item.invoiceDueDate) {
      items.push({
        id: `${item.id}-overdue`,
        label: 'Invoice Overdue',
        clientName,
        amount: item.totalCost,
        date: item.invoiceDueDate,
        color: 'var(--color-red)',
        status: 'overdue',
      });
    } else if (item.invoiceStatus === 'sent' && item.invoiceSentDate) {
      items.push({
        id: `${item.id}-sent`,
        label: 'Invoice Sent',
        clientName,
        amount: item.totalCost,
        date: item.invoiceSentDate,
        color: 'var(--color-orange)',
        status: 'sent',
      });
    }
  }

  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function ActivityFeed({ workItems, clients, maxItems = 10 }: ActivityFeedProps) {
  const activities = buildActivityItems(workItems, clients).slice(0, maxItems);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-4 text-[var(--text-primary)]">Recent Invoice Activity</h3>
      {activities.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">No invoice activity yet</p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: activity.color }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {activity.label} — {activity.clientName}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {formatDate(activity.date)}
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold flex-shrink-0" style={{ color: activity.color }}>
                {formatCurrency(activity.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
