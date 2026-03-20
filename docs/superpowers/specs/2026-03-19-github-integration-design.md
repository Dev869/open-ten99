# GitHub Integration: Auto-Populate Apps & Activity Dashboard

**Date:** 2026-03-19
**Status:** Draft

## Overview

Integrate GitHub with OpenChanges to auto-populate apps from repositories, sync repo metadata, and display recent activity (commits, PRs, issues, deployments) on app detail pages. GitHub OAuth tokens are stored server-side only — the client never sees them.

## OAuth Flow & Token Storage

### Server-Side OAuth

The entire OAuth flow runs through Cloud Functions. The client never handles tokens.

1. Client calls `getGitHubAuthUrl` callable → generates a cryptographically random `state` token, stores it in `_secrets/{userId}/oauthState` with a 10-minute TTL, and returns a GitHub authorization URL with scopes `repo`, `read:org` and the random `state` param
2. User approves on GitHub → redirected back to `/dashboard/github/callback?code=...&state=...`
3. Client passes `code` + `state` to `handleGitHubCallback` callable → validates the state token against `_secrets/{userId}/oauthState` (must match and not be expired), deletes it atomically, then exchanges the code for an access token
4. Cloud Function stores the token in `_secrets/{userId}/github` (server-only, no client read/write rules)
5. Cloud Function writes connection metadata to `integrations/{userId}`:

```typescript
interface GitHubIntegration {
  connected: boolean;
  login: string;              // GitHub username
  avatarUrl?: string;
  orgs: string[];             // org logins the user chose to connect
  connectedAt: Date;
  lastSyncAt?: Date;
}
```

The `integrations/{userId}` document stores the `GitHubIntegration` fields directly (flat structure, not nested under a `github` key). All references to integration data use the flat field names: `connected`, `login`, `lastSyncAt`, etc.

### Disconnect

`disconnectGitHub` callable deletes the token from `_secrets`, sets `connected: false` on the `integrations` doc. Does not delete or unlink existing apps — they keep their data but stop syncing.

### Token Handling

GitHub OAuth tokens don't expire unless revoked. Cloud Functions handle 401 responses by marking `connected: false` on the `integrations` doc so the UI prompts reconnection.

**Scope note:** The `repo` scope grants full read/write access to repositories. GitHub's OAuth scope model does not offer a read-only repo scope — this is the minimum required to read private repos. OpenChanges never writes to GitHub (non-goal). If stricter scoping is needed in the future, migrating to a GitHub App installation model is the path.

## Data Model

### Server-Only Collection

| Collection | Access | Purpose |
|---|---|---|
| `_secrets/{userId}/github` | No client rules (default deny) | `{ accessToken: string, scope: string, tokenType: string }` |
| `_secrets/{userId}/oauthState` | No client rules (default deny) | `{ token: string, createdAt: Timestamp }` — 10-minute TTL, deleted after use |

### Client-Readable Collections

| Collection | Access | Purpose |
|---|---|---|
| `integrations/{userId}` | Owner read only, server write | GitHub connection metadata |
| `apps/{appId}/github` | Owner read only, server write | Recent activity docs (commits, PRs, issues, deployments) |

### App Document Extensions

When a repo is linked, these fields are added to the existing `App` document:

```typescript
interface GitHubRepoInfo {
  fullName: string;        // 'owner/repo'
  defaultBranch: string;
  language: string | null;
  topics: string[];
  stargazersCount: number;
  openPrCount: number;     // from GET /repos/{fullName}/pulls?state=open count
  openIssuesCount: number; // from repo.open_issues_count minus openPrCount
  archived: boolean;
  pushedAt: Date;
}

// Added to App interface
githubRepo?: GitHubRepoInfo;
```

### GitHub Activity Subcollection

`apps/{appId}/github/{activityId}` — stores the 5 most recent items per activity type (max 20 docs per app):

```typescript
type GitHubActivityType = 'commit' | 'pull_request' | 'issue' | 'deployment';

interface GitHubActivity {
  id?: string;
  type: GitHubActivityType;
  title: string;
  url: string;
  author: string;
  authorAvatarUrl?: string;
  status?: string;          // PR: open/closed/merged; issue: open/closed; deploy: see mapping below
  createdAt: Date;
  updatedAt: Date;
  number?: number;          // PR/issue number
  sha?: string;             // commit SHA (first 7 chars)
  branch?: string;
}
```

Sync deletes stale entries beyond 5 per type on each run.

**Deployment status mapping** from GitHub's `deployment_status.state`:

| GitHub State | Activity Status |
|---|---|
| `success` | `success` |
| `failure`, `error` | `failure` |
| `in_progress`, `queued`, `pending` | `pending` |
| `inactive` | `inactive` |

### Auto-Population from Repo Metadata

When importing a repo as an app, fields are pre-filled:

| App Field | Source |
|---|---|
| `ownerId` | `request.auth.uid` (required — security rules enforce ownership) |
| `name` | `repo.name` |
| `description` | `repo.description` |
| `repoUrls` | `[repo.html_url]` |
| `techStack` | `[repo.language, ...repo.topics]` (filtered nulls) |
| `platform` | Inferred: swift/kotlin → ios/android, react/vue/angular → web, else 'other' |
| `status` | `repo.archived ? 'retired' : 'active'` |
| `githubRepo` | Full `GitHubRepoInfo` object |

User selects a client during import. All auto-filled fields are editable before saving.

## Cloud Functions

All callable functions use `maxInstances: 10` and `timeoutSeconds: 120` to prevent abuse. Per-user rate limiting is enforced by checking `_secrets/{userId}` state before processing.

### Error Contract

All callable functions return `HttpsError` with these codes:

| Code | Meaning |
|---|---|
| `unauthenticated` | No auth token or invalid auth |
| `failed-precondition` | GitHub not connected (for functions that require it) |
| `invalid-argument` | Missing or invalid parameters |
| `already-exists` | Repo already linked to an app |
| `not-found` | App or repo not found |
| `internal` | GitHub API error or unexpected failure |

### New Callable Functions

**`getGitHubAuthUrl`**
- Generates a random state token via `crypto.randomBytes(32).toString('hex')`
- Stores in `_secrets/{userId}/oauthState` with `createdAt: Timestamp.now()`
- Returns GitHub authorization URL: `https://github.com/login/oauth/authorize?client_id=...&scope=repo,read:org&state={token}&redirect_uri=...`
- Requires: `GITHUB_CLIENT_ID` secret

**`handleGitHubCallback`**
- Receives `{ code: string, state: string }`
- Reads `_secrets/{request.auth.uid}/oauthState`, validates token matches and is <10 minutes old
- Deletes the oauthState doc atomically
- Exchanges code for token via `POST https://github.com/login/oauth/access_token`
- Stores token in `_secrets/{userId}/github`
- Fetches user info (`GET /user`) and orgs (`GET /user/orgs`)
- Writes `integrations/{userId}` doc
- Requires: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` secrets

**`disconnectGitHub`**
- Deletes `_secrets/{userId}/github`
- Sets `connected: false` on `integrations/{userId}`
- Does NOT delete apps or their `githubRepo` field — they stop syncing but keep data

**`importGitHubRepos`**
- Reads token from `_secrets/{userId}/github`
- Fetches repos: `GET /user/repos?per_page=100&sort=updated` + `GET /orgs/{org}/repos?per_page=100` for connected orgs
- Returns the 100 most recently updated repos. GitHub API paginates at 100 per page; this is an acceptable MVP limit. If the user has more, they see the most recently active ones.
- Returns array of repo summaries: `{ fullName, name, description, language, topics, stargazersCount, archived, pushedAt, htmlUrl }`

**`linkRepoToApp`**
- Receives `{ repoFullName: string, appId?: string, clientId?: string }`
- If `appId` provided: updates existing app with `githubRepo` field
- If `clientId` provided (no `appId`): creates new app with auto-populated fields, including `ownerId: request.auth.uid`
- Triggers initial data pull (commits, PRs, issues, deployments)
- Writes activity docs to `apps/{appId}/github`

**`triggerGitHubSync`**
- Callable function for manual "Sync Now" (separate from the scheduled `syncGitHub`)
- Performs sync for `request.auth.uid` only
- Rate-limited: checks `lastSyncAt` on `integrations` doc, rejects if <5 minutes since last sync
- Same sync logic as `syncGitHub` but scoped to one user

### Scheduled Function

**`syncGitHub`** — runs every 6 hours via Cloud Scheduler

1. Query `integrations` for all docs where `connected == true`
2. Process users in batches of 10 to stay within Cloud Functions timeout (540s max)
3. For each user, read token from `_secrets/{userId}/github`
4. Query `apps` where `ownerId == userId` and `githubRepo` field exists
5. For each app, call GitHub API:
   - `GET /repos/{fullName}` — update repo metadata on app doc
   - `GET /repos/{fullName}/commits?per_page=5` — recent commits
   - `GET /repos/{fullName}/pulls?state=open` — count open PRs, store in `githubRepo.openPrCount`
   - `GET /repos/{fullName}/pulls?state=all&sort=updated&per_page=5` — recent PRs for activity
   - `GET /repos/{fullName}/issues?state=all&sort=updated&per_page=5` — recent issues (filter by `pull_request` field absence)
   - `GET /repos/{fullName}/deployments?per_page=5` — recent deployments
6. Write/update activity docs in `apps/{appId}/github`, delete stale entries beyond 5 per type
7. Update `integrations/{userId}.lastSyncAt`
8. If token returns 401: set `connected: false`, skip remaining apps for that user
9. If batch incomplete due to timeout, remaining users are picked up next scheduled run (6h cadence is forgiving)

**Rate limiting:** GitHub allows 5,000 requests/hour per token. 6 API calls per app per sync. A user with 100 linked apps = 600 requests — well within limits.

**Scaling note:** For the current single-owner app, this design is sufficient. If user count grows beyond ~50 concurrent GitHub users, consider Cloud Tasks fan-out (one task per user) instead of sequential batch processing.

### Webhook Endpoint

**`onGitHubWebhook`** — HTTPS endpoint (not callable)

- Validates `X-Hub-Signature-256` header against `GITHUB_WEBHOOK_SECRET`
- Reads `X-GitHub-Event` header for event type
- Parses payload to find repo `full_name`
- Queries `apps` collection where `githubRepo.fullName == full_name` (requires composite index: `githubRepo.fullName` ASC). If multiple apps match (multiple users linked the same repo), updates activity docs for ALL matching apps.
- Writes/updates the relevant activity doc in `apps/{appId}/github` for each matching app

**Supported events:**

| GitHub Event | Maps To | Data Extracted |
|---|---|---|
| `push` | `commit` | HEAD commit message, SHA, author, branch |
| `pull_request` | `pull_request` | title, number, action (opened/closed/merged), author |
| `issues` | `issue` | title, number, action (opened/closed), author |
| `deployment_status` | `deployment` | environment, state (mapped per table above), creator |

**Webhook setup:** manual — user adds the webhook URL and secret to their GitHub repo/org settings. The webhook URL is displayed in the Settings integration panel.

### Required Secrets

| Secret | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | OAuth app client secret |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature validation |

Configured via `firebase functions:secrets:set`.

### Required Composite Indexes

| Collection | Fields | Purpose |
|---|---|---|
| `apps` | `githubRepo.fullName` ASC | Webhook repo lookup |
| `integrations` | `connected` ASC | Scheduled sync query |

## Firestore Security Rules

```
// Server-only secrets — no client access (covered by default deny)
// No rules needed for _secrets — the default deny-all rule blocks client access

// Integrations: owner can read, server writes only
match /integrations/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false; // Server-only writes via Admin SDK
}

// GitHub activity subcollection: owner can read, server writes only
match /apps/{appId}/github/{activityId} {
  allow read: if isContractor() && isOwnerOrLegacy(
    get(/databases/$(database)/documents/apps/$(appId)).data
  );
  allow write: if false; // Server-only writes via Admin SDK
}
```

## Files Requiring Modification

### Web App
| File | Changes |
|---|---|
| `web/src/lib/types.ts` | Add `GitHubIntegration`, `GitHubRepoInfo`, `GitHubActivity`, `GitHubActivityType`; add `githubRepo?: GitHubRepoInfo` to `App` |
| `web/src/services/firestore.ts` | Update `docToApp` to map `githubRepo` field; update `updateApp` to persist `githubRepo`; add `subscribeGitHubActivity`, `subscribeIntegration` |
| `web/src/hooks/useFirestore.ts` | Add `useGitHubActivity(appId)`, `useIntegration(userId)` hooks |
| `web/src/App.tsx` | Add lazy import for `GitHubCallback`, register route, thread integration data |
| `web/src/routes/contractor/Settings.tsx` | Add Integrations section |
| `web/src/routes/contractor/AppsList.tsx` | Add "Import from GitHub" button + modal |
| `web/src/routes/contractor/AppDetail.tsx` | Add GitHub stat cards, timeline tab, sidebar section |
| `web/src/components/AppCard.tsx` | Add GitHub icon indicator and PR count badge |

### Cloud Functions
| File | Changes |
|---|---|
| `functions/src/index.ts` | Export new functions |
| `functions/src/github.ts` | New file: `getGitHubAuthUrl`, `handleGitHubCallback`, `disconnectGitHub`, `importGitHubRepos`, `linkRepoToApp`, `triggerGitHubSync` |
| `functions/src/syncGitHub.ts` | New file: scheduled sync function |
| `functions/src/onGitHubWebhook.ts` | New file: webhook handler |
| `functions/src/utils/github.ts` | New file: GitHub API client wrapper (authenticated fetch, error handling, 401 detection) |

### Config
| File | Changes |
|---|---|
| `firestore.rules` | Add `integrations` and `apps/{appId}/github` rules |
| `firestore.indexes.json` | Add composite indexes for webhook lookup and sync query |

## Routing

| Route | View | Description |
|---|---|---|
| `/dashboard/github/callback` | GitHubCallback | OAuth redirect handler — exchanges code, redirects to Settings |
| `/dashboard/settings` (modified) | Settings | Gains "Integrations" section with GitHub card |
| `/dashboard/apps` (modified) | AppsList | Gains "Import from GitHub" button |

No new top-level nav items. The `github/callback` route is registered in `ContractorRoutes` as a lazy-loaded component.

## Frontend Views

### Settings — Integrations Section

Added to the existing Settings page as a new section.

**Disconnected state:**
- GitHub icon + "Connect GitHub" heading
- Description: "Link your GitHub repos to auto-populate apps and track activity"
- "Connect GitHub" button → calls `getGitHubAuthUrl`, redirects

**Connected state:**
- GitHub avatar + username
- Connected orgs listed as badges
- "Last synced: 2h ago" timestamp
- "Sync Now" button → calls `triggerGitHubSync` callable (rate-limited to once per 5 minutes)
- Webhook URL display with copy button (for manual setup)
- "Disconnect" button with confirmation

### OAuth Callback Route

`/dashboard/github/callback` — minimal component:
1. Shows "Connecting to GitHub..." spinner
2. Reads `code` and `state` from URL params
3. Calls `handleGitHubCallback`
4. On success: redirects to `/dashboard/settings` with success toast
5. On error: redirects to `/dashboard/settings` with error toast

### AppsList — Import from GitHub

"Import from GitHub" button visible when integration `connected == true`.

**Import modal:**
1. Calls `importGitHubRepos` on open, shows loading state
2. Search bar + org filter tabs (All | Personal | org1 | org2)
3. Repo list — each row shows:
   - Repo name + description
   - Language badge + star count + last pushed timestamp
   - "Linked" badge if already linked to an app (disabled, not selectable)
   - Checkbox for selection
4. Bottom: client dropdown ("Associate with client") + "Import N repos" button
5. On import: calls `linkRepoToApp` for each selected repo
6. Shows progress, closes on completion with success toast

### App Detail — GitHub Enhancements

**Stat cards** — when `githubRepo` exists, add:
- "Open PRs" — from `githubRepo.openPrCount`
- "Open Issues" — from `githubRepo.openIssuesCount`

**Timeline filter tabs** — add "GitHub" tab. When selected, shows activity from `apps/{appId}/github` subcollection via `useGitHubActivity` hook:

| Type | Display |
|---|---|
| Commit | `[abc1234]` SHA chip, commit message, author avatar + name, timestamp |
| PR | `#123` number badge, title, status badge (open=green, merged=purple, closed=red), author |
| Issue | `#45` number badge, title, status badge (open=green, closed=gray), author |
| Deployment | Environment badge, status badge (success=green, failure=red, pending=yellow), timestamp |

Each entry has a clickable link icon to view on GitHub.

**Sidebar** — when `githubRepo` exists, add "GitHub" section:
- Default branch badge
- Language badge
- Stars count
- Last push relative timestamp
- "View on GitHub" external link

**AppCard** (list view) — when `githubRepo` exists:
- Small GitHub icon indicator on the card
- Open PR count badge if > 0

### New Hooks

`useGitHubActivity(appId: string)` — `onSnapshot` listener on `apps/{appId}/github` subcollection, ordered by `createdAt` desc. Returns `{ activities: GitHubActivity[], loading: boolean }`.

`useIntegration(userId: string)` — `onSnapshot` listener on `integrations/{userId}`. Returns `{ integration: GitHubIntegration | null, loading: boolean }`.

## Types

Added to `web/src/lib/types.ts`:
- `GitHubIntegration` — connection metadata
- `GitHubRepoInfo` — repo metadata stored on App (with dedicated `openPrCount` and `openIssuesCount` fields)
- `GitHubActivity` — activity subcollection doc (includes `updatedAt`)
- `GitHubActivityType` — `'commit' | 'pull_request' | 'issue' | 'deployment'`

Added to `App` interface:
- `githubRepo?: GitHubRepoInfo`

## Non-Goals

- GitHub App installation model (using OAuth app for simplicity; `repo` scope is broader than needed but required for private repo access)
- Write access to GitHub (no creating issues, PRs, or commits from OpenChanges)
- Code browsing or file viewing
- CI/CD pipeline management
- GitHub Actions integration
- Automated webhook setup (user configures manually for now)
- Multi-token support (one GitHub account per OpenChanges user)
- Paginated repo import beyond 100 repos (MVP limit; shows most recently updated)
