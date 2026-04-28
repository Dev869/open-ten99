import { useState } from 'react';
import { useNotion } from '../../hooks/useNotion';
import { NotionPagePicker } from './NotionPagePicker';
import { setAppNotionPage } from '../../services/firestore';
import { useToast } from '../../hooks/useToast';
import { openNotionPage } from '../../lib/notion';
import { IconNotebook, IconExternalLink, IconEdit, IconTrash, IconPlus } from '../icons';
import type { App, NotionPageRef } from '../../lib/types';

interface NotionLinkCardProps {
  app: App;
}

/**
 * Per-app Notion link surface. Shows the current page, "Open in Notion"
 * button (deep-links to the desktop app, falls back to web), and a picker
 * to change/remove the link.
 */
export function NotionLinkCard({ app }: NotionLinkCardProps) {
  const { notion, loading } = useNotion();
  const { addToast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  // Not connected — show a soft prompt
  if (!notion) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)] flex-shrink-0">
          <IconNotebook size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notion</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Connect Notion in Settings → Integrations to deep-link this app to a workspace page.
          </p>
        </div>
      </div>
    );
  }

  if (!app.id) return null;

  const pageRef: NotionPageRef | null = app.notionPageId
    ? {
        id: app.notionPageId,
        url: app.notionPageUrl ?? '',
        title: app.notionPageTitle ?? 'Notion page',
        icon: app.notionPageIcon,
      }
    : null;

  async function handleSelect(page: NotionPageRef) {
    if (!app.id) return;
    setBusy(true);
    try {
      await setAppNotionPage(app.id, page);
      addToast(`Linked to ${page.title}`, 'success');
    } catch (err) {
      console.error('Failed to set Notion page', err);
      addToast('Failed to link Notion page', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!app.id) return;
    setBusy(true);
    try {
      await setAppNotionPage(app.id, null);
      addToast('Notion link removed', 'success');
    } catch (err) {
      console.error('Failed to clear Notion page', err);
      addToast('Failed to remove Notion link', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)]">
              <IconNotebook size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">Notion</h3>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {notion.workspaceName ?? 'Connected workspace'}
              </p>
            </div>
          </div>
        </div>

        {pageRef ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openNotionPage(pageRef)}
              disabled={busy}
              className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 border border-transparent transition-all cursor-pointer text-left group"
            >
              <PageIconBadge icon={pageRef.icon} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                  {pageRef.title}
                </span>
                <span className="block text-[11px] text-[var(--text-secondary)] truncate">
                  Open in Notion
                </span>
              </span>
              <span className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
                <IconExternalLink size={16} />
              </span>
            </button>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={busy}
                aria-label="Change linked page"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <IconEdit size={14} />
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                aria-label="Remove linked page"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
              >
                <IconTrash size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all cursor-pointer"
          >
            <IconPlus />
            Link a Notion page
          </button>
        )}
      </div>

      <NotionPagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        title={`Link ${app.name} to Notion`}
        subtitle={notion.workspaceName ?? undefined}
      />
    </>
  );
}

function PageIconBadge({ icon }: { icon?: string | null }) {
  if (!icon) {
    return (
      <span className="w-9 h-9 rounded-lg bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] flex-shrink-0">
        <IconNotebook size={16} />
      </span>
    );
  }
  if (icon.length <= 4 && !icon.startsWith('http')) {
    return (
      <span className="w-9 h-9 rounded-lg bg-[var(--bg-card)] flex items-center justify-center text-lg flex-shrink-0">
        {icon}
      </span>
    );
  }
  return <img src={icon} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />;
}
