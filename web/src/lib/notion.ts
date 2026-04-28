import type { NotionPageRef } from './types';

/**
 * Convert a Notion page URL or page ID to its 32-char hex ID.
 * Notion page IDs may appear as plain hex (32 chars) or dashed UUIDs.
 */
export function normalizeNotionPageId(idOrUrl: string): string | null {
  if (!idOrUrl) return null;
  const stripped = idOrUrl.replace(/-/g, '');
  const match = stripped.match(/[0-9a-f]{32}/i);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Build the Notion deep-link URI scheme for a page. Opens the desktop app
 * if installed; the browser will fall back to https when the scheme has no
 * registered handler.
 */
export function notionAppUri(pageId: string): string {
  const normalized = normalizeNotionPageId(pageId) ?? pageId;
  return `notion://www.notion.so/${normalized}`;
}

export function notionWebUrl(page: Pick<NotionPageRef, 'id' | 'url'>): string {
  if (page.url) return page.url;
  const normalized = normalizeNotionPageId(page.id) ?? page.id;
  return `https://www.notion.so/${normalized}`;
}

/**
 * Open a Notion page — tries the native app via `notion://`, falls back to
 * the web URL after a short timeout if the app isn't installed.
 *
 * The trick: navigating to the `notion://` URI in a hidden iframe will succeed
 * silently if Notion is installed (the OS hands off to the app). If no handler
 * exists, the iframe load fails — we then open the web URL in a new tab.
 */
export function openNotionPage(page: Pick<NotionPageRef, 'id' | 'url'>): void {
  const webUrl = notionWebUrl(page);
  const appUri = notionAppUri(page.id);

  // On mobile or unsupported browsers, just open the web URL.
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (isMobile) {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Try app first, then fall back to web tab if no handoff happens.
  let handed = false;
  const onBlur = () => { handed = true; };
  window.addEventListener('blur', onBlur, { once: true });

  // Attempt app handoff via iframe to avoid a full top-level navigation.
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = appUri;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    window.removeEventListener('blur', onBlur);
    iframe.remove();
    if (!handed) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  }, 500);
}
