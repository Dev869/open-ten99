# Open Ten99

A full-stack work order management platform for independent contractors. Track client requests, generate PDF estimates, manage retainers, and give clients visibility into project status through a dedicated portal.

**Live:** [openchanges.web.app](https://openchanges.web.app)

## Architecture

```
OpenChanges/          SwiftUI iOS app (contractor mobile)
web/                  React web app (contractor dashboard + client portal)
functions/            Firebase Cloud Functions (email parsing, PDF generation)
```

### Web App

React 19 with TypeScript, Vite, and Tailwind CSS 4. Icon-based sidebar navigation, mobile-responsive layout, and a clean design system built on Plus Jakarta Sans.

**Contractor dashboard** (`/dashboard`) — work orders, clients, calendar, analytics, invoicing, profile, and settings.

**Client portal** (`/portal`) — read-only view for clients to check work order status. Accessed via magic link, no sign-up required.

### Cloud Functions

- **`onEmailReceived`** — Postmark inbound webhook. Receives forwarded client emails, uses Gemini AI to parse them into structured work orders (type, line items, hours), and writes to Firestore as drafts.
- **`generatePDF`** — Callable function. Builds a branded PDF work order from Firestore data using pdf-lib and uploads to Cloud Storage.

### iOS App

SwiftUI app targeting iOS. Google Sign-In authentication, real-time Firestore sync, and native UI for managing work orders on the go.

## Setup

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Authentication (Google provider), Firestore, Storage, and Cloud Functions enabled

### Web App

```sh
cd web
cp .env.example .env        # fill in your Firebase config
npm install
npm run dev                  # http://localhost:5173
```

### Cloud Functions

```sh
cd functions
cp .env.example .env         # add your Google AI and Postmark keys
npm install
npm run build
```

Configure secrets for production:

```sh
firebase functions:secrets:set GOOGLE_AI_API_KEY
firebase functions:secrets:set POSTMARK_WEBHOOK_SECRET
```

### Deploy

```sh
# Build web app and deploy everything
cd web && npm run build && cd ..
firebase deploy
```

Or deploy individually:

```sh
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## Data Model

| Collection | Description |
|---|---|
| `workItems` | Work orders with type, status, line items, hours, cost, recurrence, and scheduling |
| `clients` | Client profiles with contact info and retainer configuration |
| `settings/{userId}` | Per-user app settings (company name, hourly rate, accent color, PDF logo) |
| `profiles/{userId}` | Extended user profile (phone, company, bio, website, address) |
| `vaults/{userId}` | Vault metadata (PBKDF2 salt, encrypted verification token) |
| `vaults/{userId}/credentials/*` | Client credentials — AES-256-GCM encrypted, per-credential IV |

### Work Order Lifecycle

```
Email received → Gemini parses → Draft created
       ↓
    Draft → In Review → Approved → Completed
                                       ↓
                                  PDF generated → sent to client
```

## Key Vault

Encrypted credential manager for storing client API keys, service logins, and secrets. Built with a zero-knowledge architecture — all encryption and decryption happens in the browser.

**Security model:**

- **Master password** — never stored; used to derive an AES-256 encryption key via PBKDF2 with 600,000 iterations and a random 256-bit salt
- **AES-256-GCM** — authenticated encryption with a unique 96-bit IV per credential; tamper-evident by design
- **Zero-knowledge storage** — Firestore only sees ciphertext; the plaintext never leaves the browser
- **Verification token** — a known phrase encrypted with the derived key lets the app confirm the password is correct without storing it
- **Auto-lock** — the derived key is held in memory only and cleared after 5 minutes of inactivity or when navigating away
- **Owner-only Firestore rules** — vault documents are scoped to `request.auth.uid == userId`

**Supported services:** Firebase, Google Cloud, Google AI Studio, AWS, GitHub, Vercel, Stripe, Netlify, and custom entries.

Each credential stores a client association, service type, label (all plaintext for filtering), and an encrypted payload containing username, password, API key, and notes.

## Project Structure

```
web/src/
  components/       Sidebar, StatCard, WorkItemCard, StatusBadge, FilterTabs, modals
  routes/
    contractor/     Dashboard, WorkItems, Calendar, Clients, Analytics, Vault, Settings, Profile
    portal/         PortalAuth, PortalHome, PortalDetail
  hooks/            useAuth, useFirestore
  services/         Firestore CRUD operations
  lib/              Theme, types, utilities, crypto engine, PDF builder, Firebase config

functions/src/
  index.ts          Function exports
  parseEmail.ts     Postmark webhook → Gemini AI → Firestore
  generatePdf.ts    Callable PDF generation
  utils/            Gemini client wrapper
```

## License

Private. All rights reserved.
