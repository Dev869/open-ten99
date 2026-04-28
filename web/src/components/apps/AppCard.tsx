import { Link } from 'react-router-dom';
import type { App } from '../../lib/types';
import { APP_PLATFORM_LABELS, APP_STATUS_LABELS, APP_STATUS_COLORS } from '../../lib/types';
import { openNotionPage } from '../../lib/notion';
import { useAppNotionLink } from '../../hooks/useAppNotionLink';
import { IconNotebook } from '../icons';

interface AppCardProps {
  app: App;
  clientName: string;
  workOrderCount: number;
}

export function AppCard({ app, clientName, workOrderCount }: AppCardProps) {
  const { effective, effectiveSource } = useAppNotionLink(app);
  return (
    <Link
      to={`/dashboard/apps/${app.id}`}
      className="block rounded-xl p-4 bg-[var(--bg-card)] border border-[var(--border)] hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h3 className="font-semibold text-[var(--text-primary)] truncate">{app.name}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {effective && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openNotionPage(effective);
              }}
              aria-label={`Open ${effective.title} in Notion`}
              title={`${effective.title}${effectiveSource === 'personal' ? ' (your link)' : ''}`}
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${effectiveSource === 'personal' ? 'text-[var(--accent)] hover:bg-[var(--accent)]/10' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--accent)]'}`}
            >
              <IconNotebook size={14} />
            </button>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APP_STATUS_COLORS[app.status]}`}>
            {APP_STATUS_LABELS[app.status]}
          </span>
        </div>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-3">{clientName}</p>
      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span className="px-2 py-0.5 rounded bg-[var(--bg-input)] font-medium">
          {APP_PLATFORM_LABELS[app.platform]}
        </span>
        {app.repoUrls.length > 0 && (
          <span>{app.repoUrls.length} repo{app.repoUrls.length !== 1 ? 's' : ''}</span>
        )}
        <span>{workOrderCount} work order{workOrderCount !== 1 ? 's' : ''}</span>
        {app.githubRepo && (
          <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            {app.githubRepo.openPrCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-[10px] font-medium">
                {app.githubRepo.openPrCount} PR{app.githubRepo.openPrCount !== 1 ? 's' : ''}
              </span>
            )}
          </span>
        )}
      </div>
    </Link>
  );
}
