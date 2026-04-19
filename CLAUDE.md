# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Ten99 (AKA Ten99) is a work order management platform for independent contractors. It has three codebases in this repo:

- **`web/`** — React 19 + TypeScript + Vite + Tailwind CSS 4 (contractor dashboard + client portal)
- **`functions/`** — Firebase Cloud Functions (email parsing via Gemini AI, PDF generation via pdf-lib)
- **`OpenChanges/`** — SwiftUI iOS app (deprecated)

Deploy to your own Firebase project. See README for setup instructions.

## Commands

### Web App (`cd web`)

```sh
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Cloud Functions (`cd functions`)

```sh
npm run build          # tsc
npm run build:watch    # tsc --watch
npm run serve          # firebase emulators:start --only functions
npm run deploy         # firebase deploy --only functions
```

### Firebase Deploy (from root)

```sh
firebase deploy                    # Everything (hosting, functions, rules, storage)
firebase deploy --only hosting     # Web app only
firebase deploy --only functions   # Cloud functions only
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Build web before deploying hosting: `cd web && npm run build && cd .. && firebase deploy --only hosting`

## Architecture

### Two User Roles, One Web App

- **Contractors** sign in via Google. Identified by `sign_in_provider == 'google.com'` in Firebase auth token.
- **Portal clients** authenticate via custom token (magic link). They get a `clientId` custom claim and read-only access to their work items.

The `isContractorUser()` helper in `web/src/hooks/useAuth.ts` distinguishes roles. Firestore rules enforce this server-side with `isContractor()` / `isOwnerOrLegacy()` / `claimsOwnership()` helpers.

### Data Ownership

Every document in `workItems`, `clients`, and `projects` has an `ownerId` field scoped to the contractor. Legacy documents without `ownerId` are allowed for migration compatibility (`isOwnerOrLegacy`). All new writes must set `ownerId == request.auth.uid`.

### Real-Time Data Flow

```
Firestore onSnapshot listeners (hooks)
  → Local state (useState)
    → Component render
      → User actions
        → Firestore service layer (addDoc/updateDoc/deleteDoc)
```

Key hooks: `useWorkItems`, `useClients`, `useSettings`, `useTeam`, `useTeamMembers`, `useTeamInvites` — all use `onSnapshot` for real-time updates with Firestore converters (`docToWorkItem`, `docToClient`).

### Email-to-Work-Order Pipeline

Postmark inbound webhook → `onEmailReceived` Cloud Function → validates webhook secret → finds/creates client → Gemini 2.5 Flash parses email into structured line items → draft work item written to Firestore.

### Key Vault

Zero-knowledge encrypted credential storage. Master password → PBKDF2 (600k iterations) → AES-256-GCM. All crypto happens in-browser (`web/src/lib/crypto.ts`). Firestore only stores ciphertext. Auto-locks after 5 min inactivity.

## Key Conventions

### Routing

React Router v7 with lazy-loaded routes. Contractor routes under `/dashboard/*`, portal under `/portal/*`. Route components live in `web/src/routes/contractor/` and `web/src/routes/portal/`.

### Styling

Tailwind CSS 4 via `@tailwindcss/vite`. Warm retro palette with CSS custom properties (`--bg-page`, `--bg-card`, `--text-primary`, `--accent`). Dark mode via `.dark` class toggle. Font: Plus Jakarta Sans. Custom retro sci-fi SVG icon library in `web/src/components/icons/Icons.tsx` using CSS variables (`--icon-fill`, `--icon-highlight`, `--icon-accent`, `--icon-stroke`).

### Types

All TypeScript interfaces in `web/src/lib/types.ts`. Domain types: `WorkItem`, `Client`, `AppSettings`, `UserProfile`, `VaultCredential`, `Team`, `TeamMember`, `TeamInvite`. Status/type enums use string unions with corresponding `*_LABELS` record constants.

### Services Layer

`web/src/services/firestore.ts` — centralized Firestore CRUD. All data access goes through this layer, not direct Firestore calls from components.

### Terminology

"Work orders" not "change orders". Work order statuses: `draft → inReview → approved → completed → archived`.

## Environment Variables

**Web** (`.env` from `.env.example`): `VITE_FIREBASE_*` keys (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID).

**Functions** (`.env` from `.env.example`): `GOOGLE_AI_API_KEY`, `POSTMARK_WEBHOOK_SECRET`. For production, use `firebase functions:secrets:set`.

## Design Skills

ALWAYS invoke all three of these skills for any UI/UX work in this project (new components, visual changes, layout work, styling, or UI reviews). This is mandatory — do not skip them even for small changes:

- `/frontend-design:frontend-design` — production-grade frontend interfaces with high design quality
- `/ui-ux-pro-max:ui-ux-pro-max` — UI/UX design intelligence (styles, palettes, font pairings)
- `/web-design-guidelines` — review UI code for Web Interface Guidelines compliance
