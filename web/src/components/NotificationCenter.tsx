import type { WorkItem, Client } from '../lib/types';
import {
  IconBell,
  IconRefresh,
  IconDocument,
  IconAlert,
  IconUser,
  IconClose,
  IconThumbsUp,
} from './icons';

/* ── Types ──────────────────────────────────────────── */

type NotificationType = 'retainerRenewal' | 'staleDraft' | 'overdue' | 'unassigned';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  timestamp: Date;
}

const TYPE_META: Record<NotificationType, { color: string; label: string }> = {
  retainerRenewal: { color: '#F59E0B', label: 'Renewal' },
  staleDraft: { color: '#14B8A6', label: 'Draft' },
  overdue: { color: '#EF4444', label: 'Overdue' },
  unassigned: { color: '#9CA3AF', label: 'Unassigned' },
};

function NotificationIcon({ type }: { type: NotificationType }) {
  const { color } = TYPE_META[type];
  switch (type) {
    case 'retainerRenewal': return <IconRefresh color={color} />;
    case 'staleDraft': return <IconDocument color={color} />;
    case 'overdue': return <IconAlert color={color} />;
    case 'unassigned': return <IconUser color={color} />;
  }
}

/* ── Compute Notifications ──────────────────────────── */

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function computeNotifications(
  workItems: WorkItem[],
  clients: Client[]
): Notification[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifications: Notification[] = [];

  // 1. Retainer renewal approaching (within 3 days)
  for (const client of clients) {
    if (!client.retainerRenewalDay || client.retainerPaused) continue;
    const renewalDay = client.retainerRenewalDay;

    // Find the next renewal date
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), renewalDay);
    let nextRenewal: Date;
    if (thisMonth >= today) {
      nextRenewal = thisMonth;
    } else {
      nextRenewal = new Date(now.getFullYear(), now.getMonth() + 1, renewalDay);
    }

    const daysUntil = Math.ceil(
      (nextRenewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil >= 0 && daysUntil <= 3) {
      notifications.push({
        id: `retainer-${client.id}`,
        type: 'retainerRenewal',
        title: `${client.name} retainer renews ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`,
        subtitle: `Renewal day: ${renewalDay}${ordinalSuffix(renewalDay)} of each month`,
        timestamp: nextRenewal,
      });
    }
  }

  // 2. Draft work items stuck for more than 7 days
  for (const item of workItems) {
    if (item.status !== 'draft') continue;
    const updatedAt = toDate(item.updatedAt);
    if (!updatedAt) continue;

    const daysSinceUpdate = Math.floor(
      (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceUpdate > 7) {
      notifications.push({
        id: `draft-${item.id}`,
        type: 'staleDraft',
        title: `"${item.subject}" stuck in draft`,
        subtitle: `Last updated ${daysSinceUpdate} days ago`,
        timestamp: updatedAt,
      });
    }
  }

  // 3. Overdue items (scheduledDate in the past, not completed/archived)
  for (const item of workItems) {
    if (item.status === 'completed' || item.status === 'archived') continue;
    const scheduled = toDate(item.scheduledDate);
    if (!scheduled) continue;

    const scheduledDay = new Date(
      scheduled.getFullYear(),
      scheduled.getMonth(),
      scheduled.getDate()
    );

    if (scheduledDay < today) {
      const daysOverdue = Math.floor(
        (today.getTime() - scheduledDay.getTime()) / (1000 * 60 * 60 * 24)
      );
      notifications.push({
        id: `overdue-${item.id}`,
        type: 'overdue',
        title: `"${item.subject}" is overdue`,
        subtitle: `Scheduled for ${formatShortDate(scheduled)} (${daysOverdue}d ago)`,
        timestamp: scheduled,
      });
    }
  }

  // 4. Unassigned items (no assigneeId, only if any item in the set has a teamId)
  const hasTeamFeatures = workItems.some((i) => i.teamId);
  if (hasTeamFeatures) {
    for (const item of workItems) {
      if (item.status === 'completed' || item.status === 'archived') continue;
      if (!item.assigneeId && item.teamId) {
        notifications.push({
          id: `unassigned-${item.id}`,
          type: 'unassigned',
          title: `"${item.subject}" is unassigned`,
          subtitle: 'No team member assigned to this item',
          timestamp: toDate(item.createdAt) ?? now,
        });
      }
    }
  }

  // Sort: overdue first, then by timestamp descending
  const typePriority: Record<NotificationType, number> = {
    overdue: 0,
    retainerRenewal: 1,
    staleDraft: 2,
    unassigned: 3,
  };

  notifications.sort((a, b) => {
    const pDiff = typePriority[a.type] - typePriority[b.type];
    if (pDiff !== 0) return pDiff;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  return notifications;
}

/* ── Helpers ─────────────────────────────────────────── */

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(date);
}

/* ── Mobile Bell (for header) ───────────────────────── */

interface MobileBellProps {
  count: number;
  onClick: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

export function MobileNotificationBell({ count, onClick, buttonRef }: MobileBellProps) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className="relative p-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
      title="Notifications"
    >
      <IconBell size={24} />
      {count > 0 && (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--bg-card)]" />
      )}
    </button>
  );
}

/* ── Panel ──────────────────────────────────────────── */

interface NotificationPanelProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onClose: () => void;
  isMobile: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
}

export function NotificationPanel({
  notifications,
  onDismiss,
  onDismissAll,
  onClose,
  isMobile,
  panelRef,
}: NotificationPanelProps) {
  const count = notifications.length;

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h3>
          {count > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <button
              onClick={onDismissAll}
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] font-medium transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors"
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* Body */}
      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <IconThumbsUp size={40} color="var(--accent)" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">All caught up!</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type];
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-input)]/50 transition-colors"
              >
                {/* Icon */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: meta.color + '18' }}
                >
                  <NotificationIcon type={n.type} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                    {n.title}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                    {n.subtitle}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ color: meta.color, backgroundColor: meta.color + '18' }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {timeAgo(n.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => onDismiss(n.id)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors mt-0.5"
                  title="Dismiss"
                >
                  <IconClose />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // Mobile: modal overlay
  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] animate-fade-in"
          onClick={onClose}
        />
        <div className="fixed inset-x-4 top-20 z-[70] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl max-h-[70vh] overflow-y-auto animate-scale-in">
          {panelContent}
        </div>
      </>
    );
  }

  // Desktop: positioned panel anchored to the top-right near the bell in the top nav
  return (
    <div
      ref={panelRef}
      className="fixed top-14 right-4 z-[60] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl w-[360px] max-h-[70vh] overflow-y-auto animate-scale-in"
    >
      {panelContent}
    </div>
  );
}
