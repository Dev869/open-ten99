# GitHub Integration Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the web frontend for GitHub integration — types, hooks, Settings integration panel, OAuth callback, repo import modal, and GitHub activity display on app detail pages.

**Architecture:** New types and hooks follow existing patterns. Settings gains an Integrations section. AppsList gains an import modal. AppDetail gains GitHub stat cards, a timeline tab, and sidebar section. All GitHub API calls go through Cloud Functions callables — the frontend never touches GitHub directly.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Firebase Cloud Functions (httpsCallable), React Router v7

**Spec:** `docs/superpowers/specs/2026-03-19-github-integration-design.md`

**Prerequisite:** Plan 1 (backend) must be deployed first — this plan depends on the callable functions existing.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `web/src/lib/types.ts` | Add `GitHubIntegration`, `GitHubRepoInfo`, `GitHubActivity`, `GitHubActivityType`; add `githubRepo` to `App` |
| Modify | `web/src/services/firestore.ts` | Update `docToApp` for `githubRepo`; update `updateApp` for `githubRepo`; add `subscribeIntegration`, `subscribeGitHubActivity` |
| Modify | `web/src/hooks/useFirestore.ts` | Add `useIntegration`, `useGitHubActivity` hooks |
| Create | `web/src/routes/contractor/GitHubCallback.tsx` | OAuth callback handler route |
| Create | `web/src/components/GitHubImportModal.tsx` | Repo import picker modal |
| Modify | `web/src/routes/contractor/Settings.tsx` | Add Integrations section with connect/disconnect/sync |
| Modify | `web/src/routes/contractor/AppsList.tsx` | Add "Import from GitHub" button |
| Modify | `web/src/routes/contractor/AppDetail.tsx` | Add GitHub stat cards, timeline tab, sidebar section |
| Modify | `web/src/components/AppCard.tsx` | Add GitHub icon indicator and PR count badge |
| Modify | `web/src/App.tsx` | Add GitHubCallback route, thread integration data |

---

## Task 1: GitHub Types

**Files:**
- Modify: `web/src/lib/types.ts`

- [ ] **Step 1: Add GitHub types**

Add after the Apps section (before Teams):

```typescript
/* ── GitHub Integration ───────────────────────────── */

export interface GitHubIntegration {
  connected: boolean;
  login: string;
  avatarUrl?: string;
  orgs: string[];
  connectedAt: Date;
  lastSyncAt?: Date;
}

export interface GitHubRepoInfo {
  fullName: string;
  defaultBranch: string;
  language: string | null;
  topics: string[];
  stargazersCount: number;
  openPrCount: number;
  openIssuesCount: number;
  archived: boolean;
  pushedAt: Date;
}

export type GitHubActivityType = 'commit' | 'pull_request' | 'issue' | 'deployment';

export interface GitHubActivity {
  id?: string;
  type: GitHubActivityType;
  title: string;
  url: string;
  author: string;
  authorAvatarUrl?: string;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
  number?: number;
  sha?: string;
  branch?: string;
}
```

- [ ] **Step 2: Add `githubRepo` to App interface**

Add `githubRepo?: GitHubRepoInfo;` to the `App` interface after `vaultCredentialIds`.

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts
git commit -m "feat: add GitHub integration types"
```

---

## Task 2: Firestore Service Layer Updates

**Files:**
- Modify: `web/src/services/firestore.ts`

- [ ] **Step 1: Add GitHub imports and types**

Add `GitHubIntegration`, `GitHubActivity` to the types import.

- [ ] **Step 2: Update `docToApp` converter**

Add `githubRepo` mapping after `vaultCredentialIds`:

```typescript
githubRepo: data.githubRepo
  ? {
      fullName: data.githubRepo.fullName ?? '',
      defaultBranch: data.githubRepo.defaultBranch ?? 'main',
      language: data.githubRepo.language ?? null,
      topics: data.githubRepo.topics ?? [],
      stargazersCount: data.githubRepo.stargazersCount ?? 0,
      openPrCount: data.githubRepo.openPrCount ?? 0,
      openIssuesCount: data.githubRepo.openIssuesCount ?? 0,
      archived: data.githubRepo.archived ?? false,
      pushedAt: toDate(data.githubRepo.pushedAt),
    }
  : undefined,
```

- [ ] **Step 3: Update `updateApp` to persist `githubRepo`**

Add to the `updateDoc` field map in `updateApp`:

```typescript
githubRepo: app.githubRepo ?? null,
```

- [ ] **Step 4: Add subscription functions**

```typescript
export function subscribeIntegration(
  userId: string,
  callback: (integration: GitHubIntegration | null) => void
) {
  const ref = doc(db, 'integrations', userId);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const data = snapshot.data();
    callback({
      connected: data.connected ?? false,
      login: data.login ?? '',
      avatarUrl: data.avatarUrl ?? undefined,
      orgs: data.orgs ?? [],
      connectedAt: toDate(data.connectedAt),
      lastSyncAt: data.lastSyncAt ? toDate(data.lastSyncAt) : undefined,
    });
  });
}

export function subscribeGitHubActivity(
  appId: string,
  callback: (activities: GitHubActivity[]) => void
) {
  const ref = collection(db, 'apps', appId, 'github');
  const q = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        title: data.title ?? '',
        url: data.url ?? '',
        author: data.author ?? '',
        authorAvatarUrl: data.authorAvatarUrl ?? undefined,
        status: data.status ?? undefined,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        number: data.number ?? undefined,
        sha: data.sha ?? undefined,
        branch: data.branch ?? undefined,
      } as GitHubActivity;
    });
    callback(activities);
  });
}
```

- [ ] **Step 5: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add web/src/services/firestore.ts
git commit -m "feat: add GitHub integration to Firestore service layer"
```

---

## Task 3: Hooks

**Files:**
- Modify: `web/src/hooks/useFirestore.ts`

- [ ] **Step 1: Add imports and hooks**

Add `subscribeIntegration`, `subscribeGitHubActivity` to service imports.
Add `GitHubIntegration`, `GitHubActivity` to type imports.

Add hooks:

```typescript
export function useIntegration(userId: string | undefined) {
  const [integration, setIntegration] = useState<GitHubIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeIntegration(userId, (i) => {
      setIntegration(i);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { integration, loading };
}

export function useGitHubActivity(appId: string | undefined) {
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeGitHubActivity(appId, (a) => {
      setActivities(a);
      setLoading(false);
    });
    return unsubscribe;
  }, [appId]);

  return { activities, loading };
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/useFirestore.ts
git commit -m "feat: add useIntegration and useGitHubActivity hooks"
```

---

## Task 4: OAuth Callback Route

**Files:**
- Create: `web/src/routes/contractor/GitHubCallback.tsx`

- [ ] **Step 1: Create the callback component**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useToast } from '../../hooks/useToast';

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [status, setStatus] = useState('Connecting to GitHub...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      addToast('Invalid GitHub callback — missing parameters.', 'error');
      navigate('/dashboard/settings');
      return;
    }

    const handleCallback = httpsCallable(functions, 'handleGitHubCallback');

    handleCallback({ code, state })
      .then(() => {
        addToast('GitHub connected successfully!', 'success');
        navigate('/dashboard/settings');
      })
      .catch((error) => {
        const message = error?.message ?? 'Failed to connect GitHub.';
        addToast(message, 'error');
        navigate('/dashboard/settings');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">{status}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register route in App.tsx**

Add lazy import:
```typescript
const GitHubCallback = lazy(() => import('./routes/contractor/GitHubCallback'));
```

Add route in `ContractorRoutes` (no props needed):
```typescript
<Route path="github/callback" element={<GitHubCallback />} />
```

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/contractor/GitHubCallback.tsx web/src/App.tsx
git commit -m "feat: add GitHub OAuth callback route"
```

---

## Task 5: Settings — Integrations Section

**Files:**
- Modify: `web/src/routes/contractor/Settings.tsx`

- [ ] **Step 1: Read Settings.tsx**

Read the full file to understand its current structure.

- [ ] **Step 2: Add GitHub integration section**

Import `useIntegration` hook. Import `httpsCallable` from Firebase functions. Import `useAuth` to get `user.uid`.

Add state:
```typescript
const { integration } = useIntegration(userId);
const [syncing, setSyncing] = useState(false);
const [disconnecting, setDisconnecting] = useState(false);
```

Add an "Integrations" section to the settings page (after existing sections). Two states:

**Disconnected:**
- GitHub icon (use an inline SVG or text)
- "Connect GitHub" heading + description
- "Connect GitHub" button → calls `getGitHubAuthUrl` callable, then `window.location.href = url`

**Connected:**
- Avatar + username display
- Connected orgs as badges
- "Last synced: ..." relative timestamp
- "Sync Now" button → calls `triggerGitHubSync` callable with loading state
- Webhook URL display: `https://us-central1-openchanges.cloudfunctions.net/onGitHubWebhook` with copy button
- "Disconnect" button with confirmation → calls `disconnectGitHub` callable

Use `httpsCallable(functions, 'functionName')` pattern for all Cloud Function calls.

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/contractor/Settings.tsx
git commit -m "feat: add GitHub integration section to Settings"
```

---

## Task 6: GitHub Import Modal

**Files:**
- Create: `web/src/components/GitHubImportModal.tsx`

- [ ] **Step 1: Create the import modal**

Props:
```typescript
interface GitHubImportModalProps {
  clients: Client[];
  apps: App[];      // to check which repos are already linked
  onClose: () => void;
}
```

On open:
1. Call `importGitHubRepos` callable
2. Show loading state while fetching
3. Display searchable repo list with org filter tabs

Each repo row:
- Repo name (bold) + description (truncated)
- Language badge + star count + last pushed relative timestamp
- "Linked" badge if `apps.some(a => a.githubRepo?.fullName === repo.fullName)` (disabled)
- Checkbox for selection

Bottom bar:
- Client dropdown (required — "Associate with client")
- "Import N repos" button (disabled until client selected and repos checked)

On import:
- Call `linkRepoToApp` callable for each selected repo sequentially
- Show progress ("Importing 2 of 5...")
- Close on completion with success toast

Use the same modal styling as `AppFormModal`:
- Overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/40`
- Panel: `bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6`

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/GitHubImportModal.tsx
git commit -m "feat: add GitHub repo import modal"
```

---

## Task 7: AppsList — Import Button

**Files:**
- Modify: `web/src/routes/contractor/AppsList.tsx`

- [ ] **Step 1: Read AppsList.tsx**

Read the full file.

- [ ] **Step 2: Add import button and modal**

Import `GitHubImportModal`. The component needs to know if GitHub is connected. Add `integration` to props or use the `useIntegration` hook directly (simpler — use the hook with `useAuth` for the userId).

Add state: `const [showImport, setShowImport] = useState(false)`

Add "Import from GitHub" button next to "New App" button. Only visible when `integration?.connected`:

```tsx
{integration?.connected && (
  <button
    onClick={() => setShowImport(true)}
    className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:bg-[var(--bg-input)] transition-colors"
  >
    Import from GitHub
  </button>
)}
```

Render modal conditionally:
```tsx
{showImport && (
  <GitHubImportModal
    clients={clients}
    apps={apps}
    onClose={() => setShowImport(false)}
  />
)}
```

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/contractor/AppsList.tsx
git commit -m "feat: add Import from GitHub button to AppsList"
```

---

## Task 8: AppDetail — GitHub Enhancements

**Files:**
- Modify: `web/src/routes/contractor/AppDetail.tsx`

- [ ] **Step 1: Read AppDetail.tsx**

Read the full file to understand current structure.

- [ ] **Step 2: Add GitHub stat cards**

Import `useGitHubActivity` hook.

When `app.githubRepo` exists, add two more `StatCard` components after the existing ones:
```tsx
{app.githubRepo && (
  <>
    <StatCard label="Open PRs" value={String(app.githubRepo.openPrCount)} />
    <StatCard label="Open Issues" value={String(app.githubRepo.openIssuesCount)} />
  </>
)}
```

- [ ] **Step 3: Add GitHub timeline tab**

Add "GitHub" to the filter tabs array. When selected, show activities from `useGitHubActivity(app.id)`.

Each activity type has a distinct rendering:

- **Commit:** `[sha]` chip (monospace, bg-[var(--bg-input)]), message, author, timestamp, external link
- **PR:** `#number` badge, title, status badge (open=green, merged=purple, closed=red), author, timestamp
- **Issue:** `#number` badge, title, status badge (open=green, closed=gray), author, timestamp
- **Deployment:** environment badge, status badge, timestamp

Each entry links to GitHub via the `url` field.

- [ ] **Step 4: Add GitHub sidebar section**

When `app.githubRepo` exists, add a "GitHub" section to the sidebar info card:

```tsx
{app.githubRepo && (
  <div>
    <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">GitHub</h4>
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-input)]">{app.githubRepo.defaultBranch}</span>
        {app.githubRepo.language && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-input)]">{app.githubRepo.language}</span>
        )}
      </div>
      <p className="text-[var(--text-secondary)]">{app.githubRepo.stargazersCount} stars</p>
      <p className="text-[var(--text-tertiary)] text-xs">Last push: {formatRelativeTime(app.githubRepo.pushedAt)}</p>
      <a
        href={`https://github.com/${app.githubRepo.fullName}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent)] hover:underline text-sm"
      >
        View on GitHub
      </a>
    </div>
  </div>
)}
```

You'll need a `formatRelativeTime` helper — check if one already exists in `web/src/lib/utils.ts`, otherwise add a simple one.

- [ ] **Step 5: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/contractor/AppDetail.tsx
git commit -m "feat: add GitHub stat cards, timeline, and sidebar to AppDetail"
```

---

## Task 9: AppCard — GitHub Indicator

**Files:**
- Modify: `web/src/components/AppCard.tsx`

- [ ] **Step 1: Read AppCard.tsx**

Read the full file.

- [ ] **Step 2: Add GitHub indicators**

When `app.githubRepo` exists, show:
- A small GitHub icon (inline SVG) in the card footer
- Open PR count badge if > 0

```tsx
{app.githubRepo && (
  <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
    {/* Simple GitHub icon */}
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
    {app.githubRepo.openPrCount > 0 && (
      <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-[10px] font-medium">
        {app.githubRepo.openPrCount} PR{app.githubRepo.openPrCount !== 1 ? 's' : ''}
      </span>
    )}
  </span>
)}
```

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/src/components/AppCard.tsx
git commit -m "feat: add GitHub icon and PR badge to AppCard"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full build check**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 2: Lint check**

Run: `cd web && npm run lint`
Fix any new lint errors.

- [ ] **Step 3: Build for production**

Run: `cd web && npx vite build`
Expected: Clean build.

- [ ] **Step 4: Commit and deploy**

```bash
firebase deploy --only hosting
```
