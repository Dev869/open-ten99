# OpenChanges Web App — Design Spec

## Overview

A React web app that mirrors and extends the iOS app's functionality, sharing the same Firebase backend. Provides a contractor dashboard for managing work orders and a client portal for viewing/approving them.

## Stack

- **Framework:** Vite + React 19 with TypeScript
- **Routing:** React Router v7 with lazy-loaded role modules
- **Styling:** Tailwind CSS
- **Backend:** Firebase JS SDK (Auth, Firestore realtime listeners, Storage)
- **Charts:** Recharts (analytics dashboard)
- **Hosting:** Firebase Hosting

## Architecture

Single SPA with two lazy-loaded modules:

- `/dashboard/*` — Contractor routes (Google Sign-In)
- `/portal/*` — Client routes (magic link auth)

```
web/
├── src/
│   ├── main.tsx                  # Entry, Firebase init, router
│   ├── routes/
│   │   ├── contractor/           # Lazy-loaded contractor module
│   │   │   ├── Dashboard.tsx
│   │   │   ├── WorkItems.tsx
│   │   │   ├── WorkItemDetail.tsx
│   │   │   ├── Calendar.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── ClientDetail.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── Analytics.tsx
│   │   └── portal/               # Lazy-loaded client module
│   │       ├── PortalHome.tsx
│   │       └── PortalDetail.tsx
│   ├── components/               # Shared UI components
│   ├── hooks/                    # Firebase hooks, auth hooks
│   ├── services/                 # Firebase service layer
│   └── lib/                      # Utils, types, constants
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

## Visual Design

Matches the Open TEN99 brand identity, adapted for desktop information density.

### Theme Tokens

| Token | Value | Usage |
|---|---|---|
| `background` | `#F5F0E8` | Page background (warm cream) |
| `sidebar-bg` | `#2D2D2D` | Dark charcoal sidebar |
| `accent` | `#2AACB0` | Primary teal accent |
| `card-bg` | `#FFFFFF` | Card backgrounds |
| `text-primary` | `#2D2D2D` | Primary text |
| `text-secondary` | `#9A9486` | Secondary/muted text |
| `text-sidebar` | `#999999` | Inactive sidebar text |
| `border` | `#D9D2C4` | Subtle borders |
| `input-bg` | `#EDE8DC` | Input field backgrounds |
| `status-draft` | `#E67E22` | Draft status (orange) |
| `status-review` | `#2AACB0` | In review status (teal) |
| `status-approved` | `#27AE60` | Approved status (green) |
| `status-completed` | `#888888` | Completed status (gray) |
| `type-change` | `#2AACB0` | Change request (teal) |
| `type-feature` | `#27AE60` | Feature request (green) |
| `type-maintenance` | `#E67E22` | Maintenance (orange) |

### Brand Elements

- **5-stripe accent bar** at top of sidebar: red `#E74C3C`, orange `#E67E22`, yellow `#F1C40F`, green `#27AE60`, teal `#2AACB0`
- **Uppercase geometric headings** with letter-spacing
- **Outlined pill buttons** for secondary actions
- **Filled teal pill buttons** for primary actions
- **White cards** with subtle shadows on cream background
- **Colored left border** on work item cards (by type)

### Layout

- **Desktop:** Persistent dark sidebar (fixed left, ~220px) + scrollable content area
- **Mobile/tablet:** Sidebar collapses to hamburger drawer overlay
- Sidebar contains: logo, nav items (Dashboard, Work Items, Calendar, Clients, Analytics), bottom-pinned Settings link
- Active nav item: teal background highlight
- Inbox badge count on Dashboard nav item

## Authentication

### Contractor

Google Sign-In via Firebase Auth. Contractor's UID is checked against an allowed list (hardcoded or in Firestore). Redirects to `/dashboard`.

### Client Portal

Magic link flow:

1. Contractor clicks "Send to Client" on a work order
2. `generateMagicLink` Cloud Function creates a token doc in `magicLinks/{token}` with: `clientId`, `email`, `workItemId`, `expiresAt` (e.g., 7 days)
3. App opens a `mailto:` link pre-filled with:
   - **To:** client email
   - **Subject:** "Work Order: {subject} — Review & Approve"
   - **Body:** Branded message with work order summary (type, line items, total) and magic link URL (e.g., `https://your-domain.web.app/portal/auth?token={token}`)
4. Contractor reviews/edits in their mail app and sends
5. Client clicks link → Cloud Function `verifyMagicLink` validates token, creates Firebase custom auth token → client is signed in with custom claims (`role: "client"`, `clientId: "xxx"`)
6. Client sees their work orders at `/portal`

## Screens

### Contractor — Dashboard

Landing page after login. Serves as the Inbox equivalent — surfaces pending work that needs attention.

- **Stats row:** Pending work orders count, hours this week, revenue this month
- **Pending work orders:** Work items with status `draft` or `inReview`, sorted by `createdAt` desc. These are the items needing triage — equivalent to the iOS Inbox.
- **Recently completed:** Last 5 approved/completed items for reference

### Contractor — Work Items

Full work item management:

- **"+ New Work Order" button** in toolbar — opens a modal/drawer form matching the iOS AddWorkOrderSheet: type picker, client selector, subject, notes, scheduled date toggle, line items with auto-cost, billable toggle
- **Search bar** with text filtering
- **Filter tabs:** By type (All, Change Requests, Feature Requests, Maintenance) and by status (All, Draft, In Review, Approved, Completed)
- **Bulk actions:** Checkbox selection on each row. Toolbar appears when items selected:
  - "Approve Selected" — only applies to items with status `draft` or `inReview`, sets status to `approved`
  - "Archive Selected" — sets status to a new `archived` status (soft delete, preserves audit history)
- **Work item rows:** Subject, client name, type tag, status tag, billable indicator, hours, cost
- Click row → Work Item Detail

### Contractor — Work Item Detail

Edit and manage a single work order:

- **Header card:** Client name, subject, type, date, billable status
- **Original email section:** Collapsible, shows `sourceEmail` content
- **Line items section:** Editable descriptions, hours (cost auto-calculates from hourly rate). Add/remove items.
- **Totals card:** Total hours, hourly rate, total cost
- **Action bar:**
  - "Discard" — sets status to `archived` (soft delete, preserves history)
  - "Approve & Generate PDF" — sets status to approved, calls `generatePDF` Cloud Function
  - "Send to Client" — generates magic link, opens `mailto:` with pre-filled branded email

### Contractor — Calendar

- **View modes:** Month (default), week, list — toggle in toolbar
- **Color-coded events:** Teal (change), green (feature), orange (maintenance)
- Click day → see work items scheduled for that date
- Click work item → navigate to detail

### Contractor — Clients

- **Client list:** Searchable, shows name, email, work order count
- **Add client:** Modal/drawer form (name, email, phone, company, notes)
- Click client → **Client Detail:**
  - Contact info (editable)
  - Work order history for that client
  - Stats: total hours, total revenue from this client

### Contractor — Analytics

All analytics are computed client-side from the `workItems` collection (sufficient for a solo contractor's data volume). Default view shows current month; date range picker allows filtering.

- **Revenue over time:** Line/bar chart (monthly)
- **Hours by client:** Horizontal bar chart
- **Top clients:** Ranked by revenue
- **Monthly breakdown:** Table with totals

### Contractor — Settings & Profile

- **Hourly rate** input
- **Company name** input
- **Accent color** swatches (configurable theme override)
- **Profile:** Name, email, profile photo
- **Account:** Sign out

### Client Portal — Portal Home

After magic link auth, client sees:

- List of their work orders (filtered by `clientId`)
- Status badges, dates, totals
- Click → Portal Detail

### Client Portal — Portal Detail

- Work order summary: subject, type, line items, hours, cost
- Download PDF button — if `pdfStoragePath` exists, calls a `getFreshPdfUrl` Cloud Function to generate a new signed URL on demand (avoids expired URL issues)
- **Approve button** — updates work item status to `approved`

## Firebase Changes

### New Cloud Functions

**`generateMagicLink`** (callable):
1. Takes `workItemId` and `clientEmail`
2. Generates a random token
3. Stores in `magicLinks/{token}`: `clientId`, `email`, `workItemId`, `expiresAt`, `used: false`
4. Returns the token and the full portal URL

**`verifyMagicLink`** (callable):
1. Takes `token` param
2. Validates: exists, not expired, not used
3. Marks as `used: true`
4. Creates Firebase custom auth token with claims: `{ role: "client", clientId: "xxx" }`
5. Returns the custom token

The portal auth page (`/portal/auth?token={token}`) is a React route that reads the token from the URL, calls the `verifyMagicLink` Cloud Function via client-side fetch, receives the custom token, and calls `signInWithCustomToken()`. On success, redirects to `/portal`. Firebase Auth persistence keeps the session alive so the magic link is single-use but the session persists across browser restarts.

**`getFreshPdfUrl`** (callable):
1. Takes `workItemId`
2. Verifies caller is contractor or a portal client whose `clientId` matches the work item
3. Reads `pdfStoragePath` from the work item doc
4. Generates a new 1-hour signed URL from Firebase Storage
5. Returns the signed URL

### Firestore Rules Update

Contractor is identified by UID stored in an `admins` collection. Portal clients use custom claims set during magic link auth.

```
// Helper function
function isContractor() {
  return request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}

function isPortalClient() {
  return request.auth != null && request.auth.token.role == "client";
}

// Clients collection: contractor full access, portal clients read their own
match /clients/{clientId} {
  allow read, write: if isContractor();
  allow read: if isPortalClient() && request.auth.token.clientId == clientId;
}

// Work items: contractor full access, portal clients scoped access
match /workItems/{workItemId} {
  allow read, create, delete: if isContractor();
  allow update: if isContractor();
  // Portal client: read own, approve own
  allow read: if isPortalClient()
    && resource.data.clientId == request.auth.token.clientId;
  allow update: if isPortalClient()
    && resource.data.clientId == request.auth.token.clientId
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["status"])
    && request.resource.data.status == "approved";
}

// Settings: contractor only
match /settings/{userId} {
  allow read, write: if isContractor() && request.auth.uid == userId;
}

// Projects: contractor only
match /projects/{projectId} {
  allow read, write: if isContractor();
}

// Magic links: read by Cloud Functions (admin SDK), no client access
match /magicLinks/{token} {
  allow read, write: if false;
}
```

### New Firestore Collection

```
magicLinks/{token}
  clientId: String
  email: String
  workItemId: String
  expiresAt: Timestamp
  used: Boolean
  createdAt: Timestamp
```

## Shared Services Layer

The web app's Firebase service layer mirrors the iOS `FirestoreService`:

- `useWorkItems()` — realtime listener on `workItems` collection
- `useClients()` — realtime listener on `clients` collection
- `useSettings()` — listener on `settings/{uid}`
- `createWorkItem()`, `updateWorkItem()`, `archiveWorkItem()` (sets status to `archived`)
- `createClient()`, `updateClient()`
- `generatePDF()` — calls the existing `generatePDF` Cloud Function
- `generateMagicLink()` — calls the new Cloud Function
- `getFreshPdfUrl()` — calls Cloud Function to get a fresh signed URL for PDF download

**Note:** TypeScript types must include `projectId` on WorkItem to preserve compatibility with the iOS app. The `projects` collection is not actively managed in the web app v1 but the field is preserved on all read/write operations.

## Data Model Changes

### New WorkItem status: `archived`

Add `archived` to the `Status` enum in both web TypeScript types and iOS Swift model. Archived items are excluded from default list views and dashboard counts but remain in Firestore for audit history.

### New Firestore collection: `admins`

Single doc `admins/{contractorUid}` with `{ role: "contractor" }`. Used by Firestore rules to verify contractor access. Created manually or via a setup script.

## Deployment

Firebase Hosting at your configured domain.

```json
"hosting": {
  "public": "web/dist",
  "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
  "rewrites": [{ "source": "**", "destination": "/index.html" }]
}
```
