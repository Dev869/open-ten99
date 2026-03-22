import { useMemo, useState, useCallback } from 'react';
import { StatCard } from '../../components/StatCard';
import { WorkItemCard } from '../../components/WorkItemCard';
import { Onboarding } from '../../components/Onboarding';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useFirestore';
import type { WorkItem, Client, App } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

interface DashboardProps {
  workItems: WorkItem[];
  clients: Client[];
  apps: App[];
}

export default function Dashboard({ workItems, clients, apps }: DashboardProps) {
  const { user } = useAuth();
  const { settings } = useSettings(user?.uid);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('oc-onboarded') === 'true'
  );

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingDismissed(true);
  }, []);

  const showOnboarding =
    !onboardingDismissed &&
    clients.length === 0 &&
    workItems.length === 0 &&
    user != null;

  if (showOnboarding) {
    return (
      <Onboarding
        user={user}
        settings={settings}
        onComplete={handleOnboardingComplete}
      />
    );
  }
  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

  const appMap = useMemo(() => {
    const map: Record<string, string> = {};
    apps.forEach((a) => { if (a.id) map[a.id] = a.name; });
    return map;
  }, [apps]);

  const pending = workItems.filter(
    (i) => i.status === 'draft' || i.status === 'inReview'
  );

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekHours = workItems
    .filter((i) => i.updatedAt >= weekStart && i.status !== 'archived')
    .reduce((s, i) => s + i.totalHours, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = workItems
    .filter(
      (i) =>
        i.isBillable &&
        i.invoiceStatus === 'paid' &&
        i.invoicePaidDate != null &&
        i.invoicePaidDate >= monthStart
    )
    .reduce((s, i) => s + i.totalCost, 0);

  const recentCompleted = workItems
    .filter((i) => i.status === 'approved' || i.status === 'completed')
    .slice(0, 5);

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider mb-6">
        Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          <StatCard key="pending" label="Pending" value={String(pending.length)} />,
          <StatCard key="week" label="This Week" value={`${thisWeekHours.toFixed(1)}h`} color="var(--accent)" />,
          <StatCard key="revenue" label="Revenue (Month)" value={formatCurrency(monthRevenue)} color="var(--color-orange)" />,
        ].map((card, i) => (
          <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 75}ms` }}>
            {card}
          </div>
        ))}
      </div>

      {/* Pending Work Orders */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Needs Attention
          </h2>
          <div className="space-y-2">
            {pending.map((item, i) => (
              <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${(i + 3) * 50}ms` }}>
                <WorkItemCard
                  item={item}
                  clientName={clientMap[item.clientId] ?? 'Unknown'}
                  appName={item.appId ? appMap[item.appId] : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Completed */}
      {recentCompleted.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Recently Completed
          </h2>
          <div className="space-y-2">
            {recentCompleted.map((item, i) => (
              <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${(i + 3) * 50}ms` }}>
                <WorkItemCard
                  item={item}
                  clientName={clientMap[item.clientId] ?? 'Unknown'}
                  appName={item.appId ? appMap[item.appId] : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && recentCompleted.length === 0 && (
        <div className="text-center py-20 animate-fade-in-up">
          <div className="text-5xl mb-4 text-[var(--accent)] opacity-50">&#10022;</div>
          <div className="text-lg font-bold text-[var(--text-primary)]">All clear</div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">No pending work orders right now.</div>
        </div>
      )}
    </div>
  );
}
