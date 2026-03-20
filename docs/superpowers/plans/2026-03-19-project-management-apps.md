# Project Management: Apps & Enhanced Work Order Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Apps collection to organize applications under clients, assign work orders to specific apps, and enhance work order filtering with multi-dimensional filters.

**Architecture:** New `apps` Firestore collection with `ownerId` scoping. Apps belong to clients, work orders optionally reference an app via `appId`. Real-time subscriptions via `onSnapshot` hook, threaded from `ContractorRoutes` as props. Client-side filtering on the already-subscribed data.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Firebase Firestore, React Router v7

**Spec:** `docs/superpowers/specs/2026-03-19-project-management-apps-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `web/src/lib/types.ts` | Add `App`, `AppPlatform`, `AppStatus`, `AppEnvironment` types and label constants; add `appId` to `WorkItem` |
| Modify | `web/src/services/firestore.ts` | Add `docToApp` converter, `subscribeApps`, `createApp`, `updateApp`, `deleteApp`; update `docToWorkItem` and `updateWorkItem` for `appId` |
| Modify | `web/src/hooks/useFirestore.ts` | Add `useApps` hook |
| Modify | `web/src/components/icons/Icons.tsx` | Add `IconApps` icon |
| Modify | `web/src/components/Sidebar.tsx` | Add Apps nav item to `defaultNavItems` |
| Modify | `web/src/App.tsx` | Add lazy imports for `AppsList`/`AppDetail`, add `useApps` hook in `ContractorRoutes`, thread `apps` prop to routes, register new routes |
| Create | `web/src/routes/contractor/AppsList.tsx` | Apps list view with card grid and filters |
| Create | `web/src/routes/contractor/AppDetail.tsx` | App detail view with dashboard cards + timeline + info sidebar |
| Create | `web/src/components/AppCard.tsx` | Reusable app card for list view |
| Create | `web/src/components/AppFormModal.tsx` | Create/edit app modal dialog |
| Modify | `web/src/routes/contractor/ClientDetail.tsx` | Add "Apps" section with app list and "Add App" button; block delete when apps exist |
| Modify | `web/src/routes/contractor/WorkItems.tsx` | Add multi-dimensional filter bar (client, app, type, invoice status, date range, assignee) |
| Modify | `web/src/components/WorkItemCard.tsx` | Show app badge when `appId` is set |
| Modify | `web/src/components/NewWorkOrderModal.tsx` | Add optional "App" dropdown filtered by selected client |
| Modify | `web/src/routes/contractor/Calendar.tsx` | Thread `apps` prop for app badge on calendar entries |
| Modify | `web/src/routes/contractor/Dashboard.tsx` | Thread `apps` prop, add `appMap` for WorkItemCard app badges |
| Modify | `firestore.rules` | Add `apps` collection rules |
| Modify | `firestore.indexes.json` | Add composite indexes for `apps` and `workItems` queries |

---

## Task 1: Types & Label Constants

**Files:**
- Modify: `web/src/lib/types.ts`

- [ ] **Step 1: Add App types and labels to types.ts**

Add after the `VaultServiceId` type (line 141) and before the Teams section:

```typescript
/* ── Apps ──────────────────────────────────────────── */

export type AppPlatform = 'web' | 'ios' | 'android' | 'desktop' | 'api' | 'other';
export type AppStatus = 'active' | 'maintenance' | 'retired' | 'development';
export type AppEnvironment = 'production' | 'staging' | 'development' | 'other';

export interface App {
  id?: string;
  clientId: string;
  projectId?: string;
  name: string;
  description?: string;
  platform: AppPlatform;
  status: AppStatus;
  url?: string;
  repoUrls: string[];
  techStack?: string[];
  hosting?: string;
  environment?: AppEnvironment;
  deploymentNotes?: string;
  vaultCredentialIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const APP_PLATFORM_LABELS: Record<AppPlatform, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
  desktop: 'Desktop',
  api: 'API',
  other: 'Other',
};

export const APP_STATUS_LABELS: Record<AppStatus, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  retired: 'Retired',
  development: 'Development',
};

export const APP_ENVIRONMENT_LABELS: Record<AppEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
  development: 'Development',
  other: 'Other',
};
```

- [ ] **Step 2: Add `appId` to WorkItem interface**

Add `appId?: string;` after `projectId?: string;` (line 32 area) in the `WorkItem` interface.

- [ ] **Step 3: Verify build passes**

Run: `cd web && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts
git commit -m "feat: add App types, labels, and appId to WorkItem"
```

---

## Task 2: Firestore Service Layer

**Files:**
- Modify: `web/src/services/firestore.ts`

- [ ] **Step 1: Update imports**

Add `App` to the types import at line 16:

```typescript
import type { WorkItem, Client, AppSettings, LineItem, UserProfile, VaultMeta, VaultCredential, Team, TeamMember, TeamInvite, TeamRole, App } from '../lib/types';
```

Add `getDocs` and `writeBatch` to the Firestore import at lines 1-13:

```typescript
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  getDocs,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
```

- [ ] **Step 2: Add `docToApp` converter**

Add after `docToClient` (after line 81):

```typescript
function docToApp(id: string, data: DocumentData): App {
  return {
    id,
    clientId: data.clientId,
    projectId: data.projectId ?? undefined,
    name: data.name ?? '',
    description: data.description ?? undefined,
    platform: data.platform ?? 'other',
    status: data.status ?? 'active',
    url: data.url ?? undefined,
    repoUrls: data.repoUrls ?? [],
    techStack: data.techStack ?? undefined,
    hosting: data.hosting ?? undefined,
    environment: data.environment ?? undefined,
    deploymentNotes: data.deploymentNotes ?? undefined,
    vaultCredentialIds: data.vaultCredentialIds ?? undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}
```

- [ ] **Step 3: Add `subscribeApps` function**

Add after `subscribeClients` (after line 108):

```typescript
export function subscribeApps(callback: (apps: App[]) => void) {
  const ref = collection(db, 'apps');
  const q = query(ref, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const apps = snapshot.docs.map((doc) => docToApp(doc.id, doc.data()));
    callback(apps);
  });
}
```

- [ ] **Step 4: Add `appId` to `docToWorkItem` converter**

In `docToWorkItem` (line 26-66), add after the `projectId` line (line 32):

```typescript
    appId: data.appId ?? undefined,
```

- [ ] **Step 5: Add `appId` and missing fields to `updateWorkItem`**

In `updateWorkItem` (line 155-182), the `updateDoc` field map explicitly enumerates fields. Add `appId` and the other fields that are currently silently stripped on updates:

```typescript
    appId: item.appId ?? null,
    assigneeId: item.assigneeId ?? null,
    teamId: item.teamId ?? null,
    clientNotes: item.clientNotes ?? null,
    clientApproval: item.clientApproval ?? null,
    clientApprovalDate: item.clientApprovalDate ? Timestamp.fromDate(item.clientApprovalDate) : null,
    invoiceStatus: item.invoiceStatus ?? null,
    invoiceSentDate: item.invoiceSentDate ? Timestamp.fromDate(item.invoiceSentDate) : null,
    invoicePaidDate: item.invoicePaidDate ? Timestamp.fromDate(item.invoicePaidDate) : null,
    invoiceDueDate: item.invoiceDueDate ? Timestamp.fromDate(item.invoiceDueDate) : null,
```

Add these after the existing `projectId` line in the field map. This fixes an existing bug where these fields were silently dropped on every work order update.

- [ ] **Step 6: Add Apps CRUD functions**

Add a new section after the Clients CRUD section (after line 263):

```typescript
// --- Apps CRUD ---

export async function createApp(app: Omit<App, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = collection(db, 'apps');
  const now = Timestamp.now();
  const clean: Record<string, unknown> = {
    createdAt: now,
    updatedAt: now,
  };
  for (const [k, v] of Object.entries(app)) {
    if (v !== undefined) clean[k] = v;
  }
  if (auth.currentUser) clean.ownerId = auth.currentUser.uid;
  const docRef = await addDoc(ref, clean);
  return docRef.id;
}

export async function updateApp(app: App) {
  if (!app.id) throw new Error('App has no ID');
  const ref = doc(db, 'apps', app.id);
  await updateDoc(ref, {
    clientId: app.clientId,
    projectId: app.projectId ?? null,
    name: app.name,
    description: app.description ?? null,
    platform: app.platform,
    status: app.status,
    url: app.url ?? null,
    repoUrls: app.repoUrls,
    techStack: app.techStack ?? null,
    hosting: app.hosting ?? null,
    environment: app.environment ?? null,
    deploymentNotes: app.deploymentNotes ?? null,
    vaultCredentialIds: app.vaultCredentialIds ?? null,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteApp(id: string) {
  // Clear appId on all work orders referencing this app
  const wiRef = collection(db, 'workItems');
  const q = query(wiRef, where('appId', '==', id));
  const snapshot = await getDocs(q);
  if (snapshot.docs.length > 0) {
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      batch.update(d.ref, { appId: null, updatedAt: Timestamp.now() });
    });
    await batch.commit();
  }

  // Delete the app
  const ref = doc(db, 'apps', id);
  await deleteDoc(ref);
}
```

- [ ] **Step 7: Verify build passes**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add web/src/services/firestore.ts
git commit -m "feat: add Apps CRUD, subscribeApps, and appId to work item service"
```

---

## Task 3: useApps Hook

**Files:**
- Modify: `web/src/hooks/useFirestore.ts`

- [ ] **Step 1: Add imports**

Update imports at line 3 to include `subscribeApps`:
```typescript
import {
  subscribeWorkItems,
  subscribeClients,
  subscribeSettings,
  subscribeApps,
  subscribeTeam,
  subscribeTeamMembers,
  subscribeTeamInvites,
} from '../services/firestore';
```

Update type import at line 10 to include `App`:
```typescript
import type { WorkItem, Client, AppSettings, App, Team, TeamMember, TeamInvite } from '../lib/types';
```

- [ ] **Step 2: Add `useApps` hook**

Add after `useClients` (after line 42):

```typescript
export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeApps((a) => {
      setApps(a);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { apps, loading };
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/hooks/useFirestore.ts
git commit -m "feat: add useApps real-time subscription hook"
```

---

## Task 4: Firestore Security Rules & Indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Add apps collection rules**

In `firestore.rules`, add before the Settings section (before the `match /settings/{userId}` block, around line 100):

```
    // ---------------------------------------------------------------------------
    // Apps collection
    // ---------------------------------------------------------------------------
    // Only contractors can manage apps. Scoped to the owning contractor.
    match /apps/{appId} {
      allow read: if isContractor() && isOwnerOrLegacy(resource.data);
      allow create: if isContractor() && claimsOwnership();
      allow update: if isContractor()
        && isOwnerOrLegacy(resource.data)
        && (!('ownerId' in request.resource.data)
            || request.resource.data.ownerId == request.auth.uid);
      allow delete: if isContractor() && isOwnerOrLegacy(resource.data);
    }
```

- [ ] **Step 2: Read current firestore.indexes.json**

Read the file to see the current structure, then add required indexes.

- [ ] **Step 3: Add composite indexes to firestore.indexes.json**

Add indexes for the `apps` and `workItems` collections. These include `ownerId` for future use if explicit query filtering is added (current queries rely on security rules for scoping). The exact JSON depends on the current file structure. Add these index entries:

```json
{
  "collectionGroup": "apps",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ownerId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "apps",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ownerId", "order": "ASCENDING" },
    { "fieldPath": "clientId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "apps",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ownerId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "apps",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ownerId", "order": "ASCENDING" },
    { "fieldPath": "platform", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "workItems",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ownerId", "order": "ASCENDING" },
    { "fieldPath": "appId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat: add Firestore security rules and indexes for apps collection"
```

---

## Task 5: IconApps & Sidebar Navigation

**Files:**
- Modify: `web/src/components/icons/Icons.tsx`
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Add `IconApps` to Icons.tsx**

Add a new icon function. Follow the retro sci-fi style (chunky proportions, CSS variable colors, accent dots). Design: a 4-pane app grid motif.

```typescript
export function IconApps({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* 2x2 grid of rounded squares */}
      <rect x="3" y="3" width="8" height="8" rx="2" fill="var(--icon-fill)" stroke={s} strokeWidth="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="var(--icon-fill)" stroke={s} strokeWidth="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="var(--icon-fill)" stroke={s} strokeWidth="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="var(--icon-highlight)" stroke={s} strokeWidth="1.5" />
      {/* Accent dots */}
      <circle cx="7" cy="7" r="1.5" fill="var(--icon-accent)" />
      <circle cx="17" cy="7" r="1.5" fill="var(--icon-accent)" />
      <circle cx="7" cy="17" r="1.5" fill="var(--icon-accent)" />
      <circle cx="17" cy="17" r="1.5" fill="var(--icon-accent)" />
    </svg>
  );
}
```

- [ ] **Step 2: Export IconApps from the icons barrel**

Check `web/src/components/icons/index.ts` and add `IconApps` to exports.

- [ ] **Step 3: Add Apps nav item to Sidebar.tsx**

Import `IconApps` in the icon import line (line 8).

Add to `defaultNavItems` array (line 21-29), after the Clients entry:

```typescript
  { to: '/dashboard/apps', key: 'apps', label: 'Apps', Icon: IconApps },
```

- [ ] **Step 4: Verify build passes and dev server shows icon**

Run: `cd web && npm run build`
Expected: Build succeeds. The new "Apps" nav item appears in the sidebar.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/icons/Icons.tsx web/src/components/icons/index.ts web/src/components/Sidebar.tsx
git commit -m "feat: add IconApps and Apps sidebar navigation item"
```

---

## Task 6: AppCard Component

**Files:**
- Create: `web/src/components/AppCard.tsx`

- [ ] **Step 1: Create AppCard.tsx**

Reusable card component for the apps list view. Pattern matches `WorkItemCard`.

```typescript
import { Link } from 'react-router-dom';
import type { App } from '../lib/types';
import { APP_PLATFORM_LABELS, APP_STATUS_LABELS } from '../lib/types';

interface AppCardProps {
  app: App;
  clientName: string;
  workOrderCount: number;
}

const statusColors: Record<App['status'], string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  retired: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  development: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export function AppCard({ app, clientName, workOrderCount }: AppCardProps) {
  return (
    <Link
      to={`/dashboard/apps/${app.id}`}
      className="block rounded-xl p-4 bg-[var(--bg-card)] border border-[var(--border)] hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-[var(--text-primary)] truncate">{app.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[app.status]}`}>
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd web && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AppCard.tsx
git commit -m "feat: add AppCard component for apps list view"
```

---

## Task 7: AppFormModal Component

**Files:**
- Create: `web/src/components/AppFormModal.tsx`

- [ ] **Step 1: Create AppFormModal.tsx**

Modal for creating and editing apps. Follows existing modal patterns in the codebase (e.g., `NewWorkOrderModal`).

Key fields: name (required), client (required dropdown), platform (required select), status (required select, default 'development'), description, url, repoUrls (tag-style multi-input), techStack (tag-style multi-input), hosting, environment (select), deploymentNotes, vaultCredentialIds (multi-select).

The component should:
- Accept `app?: App` prop (null for create, populated for edit)
- Accept `clients: Client[]` for the client dropdown
- Accept `clientId?: string` to pre-fill client when created from client detail
- Call `createApp` or `updateApp` from the service layer
- Close on success via `onClose` callback

Implementation: build the full form with all fields from the spec. Use `useState` for each form field. Tag inputs for `repoUrls` and `techStack` should allow adding/removing individual entries via a text input + Enter key.

- [ ] **Step 2: Verify build passes**

Run: `cd web && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AppFormModal.tsx
git commit -m "feat: add AppFormModal for creating and editing apps"
```

---

## Task 8: AppsList Route

**Files:**
- Create: `web/src/routes/contractor/AppsList.tsx`

- [ ] **Step 1: Create AppsList.tsx**

List view at `/dashboard/apps`. Card grid of all apps with filters.

Props pattern (matching existing routes):
```typescript
interface AppsListProps {
  apps: App[];
  workItems: WorkItem[];
  clients: Client[];
}
```

Features:
- `clientMap` useMemo for O(1) name lookups (same pattern as WorkItems.tsx line 27-31)
- Work order count per app via `useMemo` grouping
- Search by app name
- Filter dropdowns: client, platform, status
- "New App" button that opens `AppFormModal`
- Card grid using `AppCard` component
- Staggered fade-in-up animations (same pattern as Dashboard.tsx)
- Empty state when no apps exist

- [ ] **Step 2: Verify build passes**

Run: `cd web && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/contractor/AppsList.tsx
git commit -m "feat: add AppsList route with card grid and filters"
```

---

## Task 9: AppDetail Route

**Files:**
- Create: `web/src/routes/contractor/AppDetail.tsx`

- [ ] **Step 1: Create AppDetail.tsx**

Detail view at `/dashboard/apps/:id`. Two-zone layout.

Props pattern:
```typescript
interface AppDetailProps {
  apps: App[];
  workItems: WorkItem[];
  clients: Client[];
}
```

Use `useParams()` to get `id`, find app in `apps` array (same pattern as `ClientDetail.tsx`).

**Top zone — Dashboard summary cards:**
- Use `StatCard` component (already exists)
- Total work orders, active, completed, draft counts — computed via `useMemo` filtering `workItems` by `appId`
- Linked credentials count
- Quick action buttons: "New Work Order" (links to work items with app pre-selected), external links to repo URLs and live URL

**Bottom zone — Timeline:**
- Work orders for this app sorted by `updatedAt` desc
- Filter tabs: All | Changes | Maintenance | Feature Requests
- Each entry rendered as a `WorkItemCard` (already exists)

**Sidebar/panel — App info card:**
- Platform and status badges
- Tech stack as tags
- Repo links as clickable external links with GitHub icon
- Hosting, environment, deployment notes
- Edit button → opens `AppFormModal` in edit mode
- Delete button → confirmation dialog, calls `deleteApp`

- [ ] **Step 2: Verify build passes**

Run: `cd web && npm run build`

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/contractor/AppDetail.tsx
git commit -m "feat: add AppDetail route with dashboard, timeline, and info sidebar"
```

---

## Task 10: Wire Routes in App.tsx

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add lazy imports**

Add after line 27 (after the Vault lazy import):

```typescript
const AppsList = lazy(() => import('./routes/contractor/AppsList'));
const AppDetail = lazy(() => import('./routes/contractor/AppDetail'));
```

- [ ] **Step 2: Add `useApps` hook to ContractorRoutes**

Import `useApps` at line 4:
```typescript
import { useWorkItems, useClients, useSettings, useApps } from './hooks/useFirestore';
```

In `ContractorRoutes` function (line 227), add after line 230:
```typescript
  const { apps } = useApps();
```

- [ ] **Step 3: Add app routes to ContractorRoutes**

Add after the `clients/:id` route (after line 265):

```typescript
      <Route
        path="apps"
        element={<AppsList apps={apps} workItems={workItems} clients={clients} />}
      />
      <Route
        path="apps/:id"
        element={<AppDetail apps={apps} workItems={workItems} clients={clients} />}
      />
```

- [ ] **Step 4: Thread `apps` prop to routes that need it**

Update the following route elements to include `apps={apps}`:
- `ClientDetail` (line 264): add `apps={apps}` prop
- `WorkItems` (line 242): add `apps={apps}` prop
- `Dashboard` (line 238): add `apps={apps}` prop
- `Calendar` (line 256): add `apps={apps}` prop (for app badge on calendar work order entries)

- [ ] **Step 5: Verify build passes**

Run: `cd web && npm run build`
Expected: Build succeeds. New routes are accessible.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: wire AppsList and AppDetail routes, thread apps data"
```

---

## Task 11: Client Detail — Apps Section & Delete Guard

**Files:**
- Modify: `web/src/routes/contractor/ClientDetail.tsx`

- [ ] **Step 1: Read the current ClientDetail.tsx**

Read the full file to understand its current structure, props, and layout.

- [ ] **Step 2: Add `apps` and `App` to props interface**

Update the props interface to include:
```typescript
interface ClientDetailProps {
  workItems: WorkItem[];
  clients: Client[];
  apps: App[];
}
```

Import `App` from types.

- [ ] **Step 3: Add Apps section**

After the existing client info section (work orders list), add an "Apps" section:
- Header: "Apps" with count badge and "Add App" button
- List of apps belonging to this client, filtered from props via `useMemo`
- Each app links to `/dashboard/apps/${app.id}`
- Shows platform badge and status badge per app
- Import and use `AppFormModal` for the "Add App" button with `clientId` pre-filled

- [ ] **Step 4: Add delete guard**

In the delete handler, check if the client has associated apps. If yes, show a toast warning instead of deleting: "This client has N apps. Remove or reassign apps before deleting."

```typescript
const clientApps = useMemo(() =>
  apps.filter(a => a.clientId === client?.id),
  [apps, client?.id]
);

// In delete handler — use the addToast API from useToast hook:
const { addToast } = useToast();
// ...
if (clientApps.length > 0) {
  addToast(`This client has ${clientApps.length} app${clientApps.length !== 1 ? 's' : ''}. Remove or reassign apps before deleting.`, 'error');
  return;
}
```

- [ ] **Step 5: Verify build passes**

Run: `cd web && npm run build`

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/contractor/ClientDetail.tsx
git commit -m "feat: add Apps section to ClientDetail, block delete when apps exist"
```

---

## Task 12: Work Order Modifications — AppId in Forms and Cards

**Files:**
- Modify: `web/src/components/NewWorkOrderModal.tsx`
- Modify: `web/src/components/WorkItemCard.tsx`

- [ ] **Step 1: Read NewWorkOrderModal.tsx**

Read the full file to understand the current form structure.

- [ ] **Step 2: Add optional App dropdown to NewWorkOrderModal**

The modal needs `apps: App[]` added to its props. Add an "App" dropdown after the client dropdown:
- Only shows apps for the currently selected client
- When client changes, reset the app selection
- Optional — the dropdown has an empty "None" option
- In `handleSave`, add `appId: selectedAppId || undefined` to the object passed to `createWorkItem`
  (the `handleSave` function constructs the work item object explicitly — `appId` must be included)

**Important:** Update all `<NewWorkOrderModal>` render sites to pass `apps={apps}`:
- `WorkItems.tsx` — where the modal is rendered
- Any other component that renders `NewWorkOrderModal`

- [ ] **Step 3: Read WorkItemCard.tsx**

Read the full file to understand the current card layout.

- [ ] **Step 4: Add app badge to WorkItemCard**

The card needs `appName?: string` added to its props. When set, show a small app badge/chip next to the client name:

```typescript
{appName && (
  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)]">
    {appName}
  </span>
)}
```

- [ ] **Step 5: Update all WorkItemCard usage sites**

Wherever `WorkItemCard` is rendered, compute `appName` from the apps array and pass it.

Create an `appMap` useMemo (same pattern as `clientMap`):
```typescript
const appMap = useMemo(() => {
  const map: Record<string, string> = {};
  apps.forEach((a) => { if (a.id) map[a.id] = a.name; });
  return map;
}, [apps]);
```

Then pass `appName={item.appId ? appMap[item.appId] : undefined}` to each `<WorkItemCard>`.

Update these files:
- `WorkItems.tsx` — add `appMap` useMemo, pass `appName` to each `WorkItemCard`
- `Dashboard.tsx` — same pattern
- `ClientDetail.tsx` — same pattern (this component also renders `WorkItemCard`)
- `AppDetail.tsx` — already knows the app name directly

- [ ] **Step 6: Verify build passes**

Run: `cd web && npm run build`

- [ ] **Step 7: Commit**

```bash
git add web/src/components/NewWorkOrderModal.tsx web/src/components/WorkItemCard.tsx web/src/routes/contractor/WorkItems.tsx web/src/routes/contractor/Dashboard.tsx web/src/routes/contractor/ClientDetail.tsx web/src/routes/contractor/Calendar.tsx
git commit -m "feat: add appId to work order form, show app badge on work order cards"
```

---

## Task 13: Enhanced Work Order Filtering

**Files:**
- Modify: `web/src/routes/contractor/WorkItems.tsx`

- [ ] **Step 1: Read current WorkItems.tsx fully**

Read the entire file to understand the current filtering and layout.

- [ ] **Step 2: Add filter state**

Add new state variables for each filter dimension:

```typescript
const [selectedClients, setSelectedClients] = useState<string[]>([]);
const [selectedApps, setSelectedApps] = useState<string[]>([]);
const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string[]>([]);
const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
const [selectedAssignee, setSelectedAssignee] = useState<string>('');
```

- [ ] **Step 3: Expand the `filtered` useMemo**

Add filter conditions for each new dimension:

```typescript
const filtered = useMemo(() => {
  return workItems
    .filter((i) => i.status !== 'archived')
    // existing type filter
    .filter((i) => { /* existing type logic */ })
    // existing status filter
    .filter((i) => { /* existing status logic */ })
    // client filter
    .filter((i) => selectedClients.length === 0 || selectedClients.includes(i.clientId))
    // app filter
    .filter((i) => selectedApps.length === 0 || (i.appId && selectedApps.includes(i.appId)))
    // invoice status filter
    .filter((i) => selectedInvoiceStatus.length === 0 || (i.invoiceStatus && selectedInvoiceStatus.includes(i.invoiceStatus)))
    // date range filter
    .filter((i) => {
      if (dateRange.start && new Date(i.createdAt) < new Date(dateRange.start)) return false;
      if (dateRange.end && new Date(i.createdAt) > new Date(dateRange.end)) return false;
      return true;
    })
    // assignee filter
    .filter((i) => !selectedAssignee || i.assigneeId === selectedAssignee)
    // search filter
    .filter((i) => { /* existing search logic */ });
}, [workItems, selectedType, selectedStatus, selectedClients, selectedApps, selectedInvoiceStatus, dateRange, selectedAssignee, search, clientMap]);
```

- [ ] **Step 4: Build filter bar UI**

Add a filter bar below the existing status tabs. Each filter is a dropdown that collapses to a chip when active:

- Client multi-select populated from `clients` prop
- App multi-select populated from `apps` prop, filtered by selected clients
- Invoice Status multi-select: Draft, Sent, Paid, Overdue
- Date range: two date inputs (start, end)
- Assignee dropdown (only visible when user has team members — check if any work items have `assigneeId`)
- "Clear all" button when any filter is active
- Result count: "Showing {filtered.length} of {workItems.filter(i => i.status !== 'archived').length} work orders"

- [ ] **Step 5: Persist filter state in URL query params**

Use `useSearchParams` from React Router:

```typescript
import { useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();
```

Sync filter state to/from URL params so filtered views are shareable. Initialize state from URL params on mount.

- [ ] **Step 6: Verify build passes**

Run: `cd web && npm run build`

- [ ] **Step 7: Commit**

```bash
git add web/src/routes/contractor/WorkItems.tsx
git commit -m "feat: add multi-dimensional work order filtering with URL persistence"
```

---

## Task 14: Final Verification & Cleanup

- [ ] **Step 1: Full build check**

Run: `cd web && npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Lint check**

Run: `cd web && npm run lint`
Fix any lint errors.

- [ ] **Step 3: Manual smoke test checklist**

Run: `cd web && npm run dev`

Verify:
- [ ] Apps nav item appears in sidebar
- [ ] `/dashboard/apps` shows empty state, "New App" button works
- [ ] Create an app for a client — form submits, card appears in list
- [ ] App detail page shows dashboard cards, timeline of work orders, info sidebar
- [ ] Edit app — all fields save correctly
- [ ] Delete app — work orders lose appId, app disappears
- [ ] Client detail shows Apps section with linked apps
- [ ] Client delete is blocked when apps exist
- [ ] Work order create/edit has App dropdown filtered by client
- [ ] Work order cards show app badge when appId is set
- [ ] Work order filters: all dropdowns work, URL params persist, "Clear all" works, result count is accurate
- [ ] Sidebar order customization in Settings includes the new Apps item

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: lint fixes and cleanup for apps feature"
```
