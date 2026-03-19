# Project Management: Apps & Enhanced Work Order Filtering

**Date:** 2026-03-19
**Status:** Draft

## Overview

Add an Apps layer to OpenChanges so contractors can organize applications under each client, assign work orders to specific apps, and browse apps both from client detail and a top-level nav item. Enhance the work order list with multi-dimensional filtering.

## Data Model

### New `apps` Collection

Top-level Firestore collection, `ownerId`-scoped (same pattern as `clients`, `workItems`, `projects`).

`ownerId` is **not** on the TypeScript interface — it is injected at the service layer in `createApp()` via `auth.currentUser?.uid`, matching the `createWorkItem`/`createClient` pattern. Firestore rules enforce ownership server-side.

```typescript
interface App {
  id?: string;
  clientId: string;              // required — every app belongs to a client
  projectId?: string;            // optional higher-level grouping (projects collection is not yet implemented in UI)
  name: string;
  description?: string;
  platform: AppPlatform;
  status: AppStatus;
  url?: string;                  // live app URL
  repoUrls: string[];           // GitHub repo links (supports monorepo or multi-repo)
  techStack?: string[];          // e.g. ['React', 'Firebase', 'Tailwind']
  hosting?: string;              // e.g. 'Firebase Hosting', 'Vercel', 'AWS'
  environment?: AppEnvironment;
  deploymentNotes?: string;
  vaultCredentialIds?: string[]; // references to Vault credential doc IDs (stale refs handled gracefully in UI)
  createdAt: Date;
  updatedAt: Date;
}

type AppPlatform = 'web' | 'ios' | 'android' | 'desktop' | 'api' | 'other';
type AppStatus = 'active' | 'maintenance' | 'retired' | 'development';
type AppEnvironment = 'production' | 'staging' | 'development' | 'other';

const APP_PLATFORM_LABELS: Record<AppPlatform, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
  desktop: 'Desktop',
  api: 'API',
  other: 'Other',
};

const APP_STATUS_LABELS: Record<AppStatus, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  retired: 'Retired',
  development: 'Development',
};

const APP_ENVIRONMENT_LABELS: Record<AppEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
  development: 'Development',
  other: 'Other',
};
```

### WorkItem Modification

Add optional `appId` field to the existing `WorkItem` interface:

```typescript
// Added to WorkItem
appId?: string;
```

No migration needed. Existing work orders without `appId` continue working as general client work.

**`docToWorkItem` update required:** Add `appId: data.appId ?? undefined` to the converter.

**`updateWorkItem` update required:** Add `appId: item.appId ?? null` to the explicit field map in the `updateDoc` call. This function enumerates every field (no spread operator), so omitting `appId` would silently strip it on every edit.

### Projects Collection

Remains as-is. The `projectId` field on `App` is deferred — the projects collection has no frontend UI yet. The field exists on the interface for future use but will not be exposed in forms until projects are implemented.

## Deletion Strategy

### Client Deletion

When deleting a client, **block deletion** if the client has associated apps. Enforced at the UI layer: the component checks the already-subscribed apps array and disables the delete button with a warning: "This client has N apps. Remove or reassign apps before deleting the client." This prevents orphaned apps and their associated work orders. No service-layer or security-rule guard needed for a single-owner app.

### App Deletion

When deleting an app, **clear `appId`** on all associated work orders (set to `null`). The work orders revert to general client work. The UI shows a confirmation: "N work orders will be unlinked from this app."

### Vault Credential References

`vaultCredentialIds` are soft references — no cascading on credential deletion. The UI filters out stale IDs that no longer resolve to existing credentials.

## Firestore Security Rules

New `apps` collection uses the same ownership pattern:

```
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

### Composite Indexes

Required Firestore composite indexes for the `apps` collection:

| Fields | Query |
|---|---|
| `ownerId` ASC, `clientId` ASC, `createdAt` DESC | Apps filtered by client |
| `ownerId` ASC, `status` ASC, `createdAt` DESC | Apps filtered by status |
| `ownerId` ASC, `platform` ASC, `createdAt` DESC | Apps filtered by platform |

Required composite index for `workItems` (new filter support):

| Fields | Query |
|---|---|
| `ownerId` ASC, `appId` ASC, `createdAt` DESC | Work orders filtered by app |

## Routing

Routes are registered in `ContractorRoutes` as lazy-loaded components, relative to `/dashboard/*`:

| Relative Path | Component | File |
|---|---|---|
| `apps` | `AppsList` | `routes/contractor/AppsList.tsx` |
| `apps/:id` | `AppDetail` | `routes/contractor/AppDetail.tsx` |
| `clients/:id` | `ClientDetail` (modified) | Gains "Apps" section |

## Views

### Apps List (`/dashboard/apps`)

Card grid layout. Each card displays:
- App name, client name
- Platform badge (icon + label)
- Status badge (color-coded)
- Repo link count
- Active work order count

**Filters:** client dropdown, platform, status. Searchable by name.

### App Detail (`/dashboard/apps/:id`)

Two-zone layout:

**Top — Dashboard summary cards:**
- Total work orders with status breakdown
- Active / completed / draft counts
- Linked credentials count
- Quick actions: create work order for this app, open repo, open live URL

**Below — Timeline feed:**
- Work orders associated with this app, sorted by `updatedAt` descending
- Each entry: status icon, subject, status badge, `updatedAt` timestamp, link to work order detail
- Filter tabs: All | Changes | Maintenance | Feature Requests (by `WorkItemType`)
- No separate activity log collection — the timeline is a sorted/filtered view of existing work order data

**Sidebar/collapsible panel — App info card:**
- Platform badge, status badge
- Tech stack tags
- Repo links (clickable, GitHub icon)
- Hosting / environment
- Deployment notes
- Linked Vault credentials (click navigates to Vault filtered by credential; stale refs hidden)
- Edit button (opens edit form)

### Create / Edit App Form

**Modal dialog** (consistent with existing create/edit patterns in the codebase).

| Field | Required | Input Type |
|---|---|---|
| Name | Yes | Text input |
| Client | Yes (pre-filled if created from client detail) | Client dropdown |
| Platform | Yes | Select (AppPlatform options) |
| Status | Yes (default: 'development') | Select (AppStatus options) |
| Description | No | Textarea |
| URL | No | URL input |
| Repo URLs | No | Tag-style multi-input (add/remove individual URLs) |
| Tech Stack | No | Tag-style multi-input (free-text tags) |
| Hosting | No | Text input |
| Environment | No | Select (AppEnvironment options) |
| Deployment Notes | No | Textarea |
| Vault Credentials | No | Multi-select picker filtered by client's credentials |

### Client Detail Modification

Add an "Apps" section below existing content:
- List of apps belonging to the client
- Each entry links to `/dashboard/apps/:id`
- "Add App" button (opens create form with client pre-filled)

### Work Order Modifications

**Create/Edit form:**
- New optional "App" dropdown, filtered by the selected client
- When client changes, app dropdown resets

**Work order cards (list, dashboard, calendar):**
- Show app badge/chip next to client name when `appId` is set

## Enhanced Work Order Filtering

**Filter bar** on the WorkItems list view, below the existing status tabs:

| Filter | Type | Behavior |
|---|---|---|
| Status | Tabs (existing) | Draft, In Review, Approved, Completed, Archived |
| Client | Multi-select dropdown | Filter by one or more clients |
| App | Multi-select dropdown | Dynamically filtered when client is selected |
| Type | Multi-select dropdown | Change Request, Feature Request, Maintenance |
| Invoice status | Multi-select dropdown | Draft, Sent, Paid, Overdue |
| Date range | Date picker | Filter by created date or scheduled date |
| Assignee | Dropdown | Populated from team members; only visible when user has a team |

**UX details:**
- Dropdowns collapse to chips when a filter is active
- "Clear all" button visible when any filter is active
- Filter state persisted in URL query params (shareable/bookmarkable)
- Result count displayed: "Showing 12 of 47 work orders"
- All filtering is client-side on the already-subscribed work items collection (no additional Firestore queries)

## Navigation

New "Apps" sidebar item — `IconApps` — added to contractor navigation, positioned after Clients in the default sidebar order. Icon style: retro sci-fi grid/window motif (4-pane app grid) consistent with the existing icon library's chunky, filled+outlined aesthetic.

## Services Layer

New functions in `web/src/services/firestore.ts`:

**Converter:**
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

**CRUD functions:**

- `createApp(app: Omit<App, 'id' | 'createdAt' | 'updatedAt'>)` — injects `ownerId` from `auth.currentUser?.uid`, sets `createdAt`/`updatedAt` to `Timestamp.now()`.
- `updateApp(app: App)` — explicit field map (no spread), sets `updatedAt` to `Timestamp.now()`.
- `deleteApp(id: string)` — before deleting, queries `workItems` with `where('appId', '==', id)` (scoped by security rules) and sets `appId` to `null` on each via individual `updateDoc` calls. Then deletes the app document.

**Subscription:** `subscribeApps(callback)` — `onSnapshot` listener on `apps` collection, ordered by `createdAt` desc. Scoping handled by Firestore security rules (no client-side `ownerId` filter), matching the `subscribeWorkItems`/`subscribeClients` pattern. The composite indexes listed above include `ownerId` for future use if explicit query filtering is added; for now, single-field indexes on `createdAt` are sufficient.

New hook `useApps` in `web/src/hooks/useFirestore.ts` — wraps `subscribeApps`.

**Data threading:** `useApps()` is called once in the `ContractorRoutes` component (matching how `workItems`, `clients`, and `settings` are subscribed at the top level and threaded as props). The `apps` array is passed to `WorkItems`, `ClientDetail`, `AppsList`, `AppDetail`, `Dashboard`, and `Calendar` components as needed.

## Types

All new types added to `web/src/lib/types.ts`:
- `App`, `AppPlatform`, `AppStatus`, `AppEnvironment`
- `APP_PLATFORM_LABELS`, `APP_STATUS_LABELS`, `APP_ENVIRONMENT_LABELS`

## Non-Goals

- Portal client access to apps (portal remains work-order-scoped)
- App-level permissions or team roles (inherits from existing ownership model)
- Automated GitHub integration (repo links are manual for now)
- App-specific notifications
- Activity log / audit trail subcollection (timeline uses existing work order data)
- Assignee assignment UI (only the filter is added; assignment is an existing field)
