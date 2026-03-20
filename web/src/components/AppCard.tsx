import { Link } from 'react-router-dom';
import type { App } from '../lib/types';
import { APP_PLATFORM_LABELS, APP_STATUS_LABELS, APP_STATUS_COLORS } from '../lib/types';

interface AppCardProps {
  app: App;
  clientName: string;
  workOrderCount: number;
}

export function AppCard({ app, clientName, workOrderCount }: AppCardProps) {
  return (
    <Link
      to={`/dashboard/apps/${app.id}`}
      className="block rounded-xl p-4 bg-[var(--bg-card)] border border-[var(--border)] hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-[var(--text-primary)] truncate">{app.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APP_STATUS_COLORS[app.status]}`}>
          {APP_STATUS_LABELS[app.status]}
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-3">{clientName}</p>
      <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
        <span className="px-2 py-0.5 rounded bg-[var(--bg-input)] font-medium">
          {APP_PLATFORM_LABELS[app.platform]}
        </span>
        {app.repoUrls.length > 0 && (
          <span>{app.repoUrls.length} repo{app.repoUrls.length !== 1 ? 's' : ''}</span>
        )}
        <span>{workOrderCount} work order{workOrderCount !== 1 ? 's' : ''}</span>
      </div>
    </Link>
  );
}
