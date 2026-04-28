import { useState } from 'react';
import { useNotion } from '../../hooks/useNotion';
import { useAppNotionLink } from '../../hooks/useAppNotionLink';
import { useAuth } from '../../hooks/useAuth';
import { NotionPagePicker } from './NotionPagePicker';
import { setAppNotionPage, setUserAppNotionPage } from '../../services/firestore';
import { useToast } from '../../hooks/useToast';
import { openNotionPage } from '../../lib/notion';
import { IconNotebook, IconExternalLink, IconEdit, IconTrash, IconPlus } from '../icons';
import type { App, NotionPageRef } from '../../lib/types';

interface NotionLinkCardProps {
  app: App;
}

type PickerTarget = 'team' | 'personal' | null;

/**
 * Per-app Notion link surface with a team default + per-user personal override.
 *
 * - Team default: stored on the App doc; visible to anyone with access. Owners
 *   (or legacy unowned apps) may set/clear it.
 * - Personal: stored at apps/{appId}/notionLinks/{uid}. Each user manages
 *   their own. Wins over the team default in the "Open" button.
 */
export function NotionLinkCard({ app }: NotionLinkCardProps) {
  const { notion, loading: notionLoading } = useNotion();
  const { user } = useAuth();
  const { teamDefault, personal, effective, effectiveSource, canSetTeamDefault, loading } =
    useAppNotionLink(app);
  const { addToast } = useToast();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [busy, setBusy] = useState(false);

  if (loading || notionLoading) return null;

  if (!notion) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)] flex-shrink-0">
          <IconNotebook size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notion</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {effective
              ? 'Connect Notion in Settings → Integrations to manage your link or override the team default.'
              : 'Connect Notion in Settings → Integrations to deep-link this app to a workspace page.'}
          </p>
          {effective && (
            <button
              type="button"
              onClick={() => openNotionPage(effective)}
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              <IconExternalLink size={14} />
              Open team default
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!app.id || !user?.uid) return null;
  const appId = app.id;
  const uid = user.uid;

  async function handleSelect(page: NotionPageRef) {
    const target = pickerTarget;
    setBusy(true);
    try {
      if (target === 'team') {
        await setAppNotionPage(appId, page);
        addToast(`Team default set to ${page.title}`, 'success');
      } else if (target === 'personal') {
        await setUserAppNotionPage(appId, uid, page);
        addToast(`Linked ${page.title}`, 'success');
      }
    } catch (err) {
      console.error('Failed to set Notion page', err);
      addToast('Failed to link Notion page', 'error');
    } finally {
      setBusy(false);
      setPickerTarget(null);
    }
  }

  async function handleClear(target: 'team' | 'personal') {
    setBusy(true);
    try {
      if (target === 'team') {
        await setAppNotionPage(appId, null);
        addToast('Team default removed', 'success');
      } else {
        await setUserAppNotionPage(appId, uid, null);
        addToast('Your link removed', 'success');
      }
    } catch (err) {
      console.error('Failed to clear Notion page', err);
      addToast('Failed to remove Notion link', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
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

        {effective && (
          <button
            type="button"
            onClick={() => openNotionPage(effective)}
            disabled={busy}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 border border-transparent transition-all cursor-pointer text-left group"
          >
            <PageIconBadge icon={effective.icon} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                {effective.title}
              </span>
              <span className="block text-[11px] text-[var(--text-secondary)] truncate">
                Open in Notion · {effectiveSource === 'personal' ? 'your link' : 'team default'}
              </span>
            </span>
            <span className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
              <IconExternalLink size={16} />
            </span>
          </button>
        )}

        <LinkRow
          label="Your link"
          hint="Only visible to you. Wins over the team default."
          page={personal}
          disabled={busy}
          onPick={() => setPickerTarget('personal')}
          onClear={() => handleClear('personal')}
        />

        <LinkRow
          label="Team default"
          hint={
            canSetTeamDefault
              ? 'Visible to everyone with access to this app.'
              : 'Set by the app owner. Visible to everyone.'
          }
          page={teamDefault}
          disabled={busy || !canSetTeamDefault}
          readOnly={!canSetTeamDefault}
          onPick={() => setPickerTarget('team')}
          onClear={() => handleClear('team')}
        />
      </div>

      <NotionPagePicker
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={handleSelect}
        title={
          pickerTarget === 'team'
            ? `Set team default for ${app.name}`
            : `Pin a Notion page for ${app.name}`
        }
        subtitle={notion.workspaceName ?? undefined}
      />
    </>
  );
}

interface LinkRowProps {
  label: string;
  hint: string;
  page: NotionPageRef | null;
  disabled: boolean;
  readOnly?: boolean;
  onPick: () => void;
  onClear: () => void;
}

function LinkRow({ label, hint, page, disabled, readOnly, onPick, onClear }: LinkRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          {label}
        </span>
        {readOnly && (
          <span className="text-[10px] text-[var(--text-secondary)] italic">read-only</span>
        )}
      </div>
      {page ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg bg-[var(--bg-input)]/60 px-2.5 py-2 border border-[var(--border)]">
            <PageIconBadge icon={page.icon} small />
            <span className="text-sm text-[var(--text-primary)] truncate">{page.title}</span>
          </div>
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={onPick}
                disabled={disabled}
                aria-label={`Change ${label}`}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
              >
                <IconEdit size={14} />
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                aria-label={`Remove ${label}`}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                <IconTrash size={14} />
              </button>
            </>
          )}
        </div>
      ) : readOnly ? (
        <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all cursor-pointer disabled:opacity-50"
        >
          <IconPlus />
          {label === 'Team default' ? 'Set team default' : 'Pin a Notion page'}
        </button>
      )}
      {!page && !readOnly && (
        <p className="text-[11px] text-[var(--text-secondary)]">{hint}</p>
      )}
    </div>
  );
}

interface PageIconBadgeProps {
  icon?: string | null;
  small?: boolean;
}

function PageIconBadge({ icon, small }: PageIconBadgeProps) {
  const size = small ? 'w-6 h-6 text-base' : 'w-9 h-9 text-lg';
  const iconSize = small ? 12 : 16;
  if (!icon) {
    return (
      <span
        className={`${size} rounded-lg bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] flex-shrink-0`}
      >
        <IconNotebook size={iconSize} />
      </span>
    );
  }
  if (icon.length <= 4 && !icon.startsWith('http')) {
    return (
      <span
        className={`${size} rounded-lg bg-[var(--bg-card)] flex items-center justify-center flex-shrink-0`}
      >
        {icon}
      </span>
    );
  }
  return (
    <img
      src={icon}
      alt=""
      className={`${small ? 'w-6 h-6' : 'w-9 h-9'} rounded-lg object-cover flex-shrink-0`}
    />
  );
}
