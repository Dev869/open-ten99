import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { subscribeUserAppNotionLink } from '../services/firestore';
import type { App, NotionPageRef } from '../lib/types';

export interface AppNotionLinks {
  /** Team-default link stored on the App doc itself. */
  teamDefault: NotionPageRef | null;
  /** Current user's personal override, if any. */
  personal: NotionPageRef | null;
  /** What the "Open in Notion" button should actually open. */
  effective: NotionPageRef | null;
  /**
   * Did the effective link come from the personal override?
   * Useful for UI labels.
   */
  effectiveSource: 'personal' | 'team' | null;
  /** True if the current viewer owns the App and may set the team default. */
  canSetTeamDefault: boolean;
  loading: boolean;
}

/**
 * Resolve the Notion link surface for an App, combining the team default
 * stored on the App doc with the current user's personal override.
 */
export function useAppNotionLink(app: App | null | undefined): AppNotionLinks {
  const { user } = useAuth();
  const [personal, setPersonal] = useState<NotionPageRef | null>(null);
  const [loading, setLoading] = useState(true);

  const appId = app?.id;
  const uid = user?.uid;

  useEffect(() => {
    if (!appId || !uid) {
      setPersonal(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeUserAppNotionLink(appId, uid, (page) => {
      setPersonal(page);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [appId, uid]);

  const teamDefault: NotionPageRef | null = app?.notionPageId
    ? {
        id: app.notionPageId,
        url: app.notionPageUrl ?? '',
        title: app.notionPageTitle ?? 'Notion page',
        icon: app.notionPageIcon ?? null,
      }
    : null;

  const effective = personal ?? teamDefault;
  const effectiveSource: 'personal' | 'team' | null = personal
    ? 'personal'
    : teamDefault
      ? 'team'
      : null;

  // Owner of the App (or legacy doc without ownerId) may set the team default.
  const canSetTeamDefault = !!app && (!app.ownerId || app.ownerId === uid);

  return {
    teamDefault,
    personal,
    effective,
    effectiveSource,
    canSetTeamDefault,
    loading,
  };
}
