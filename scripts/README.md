# Scripts

Operational utilities for Open TEN99.

## Setup

```sh
cd scripts
npm install
```

## Seed a fully populated demo user

Populates clients, apps, work items, transactions, receipts, time entries, and
mileage trips for a single contractor UID. Every document is stamped with
`ownerId = <uid>` so Firestore rules scope it to that user — data for UID A
is invisible to UID B.

### Against the Firebase emulator (auto-provisions a login)

Start both emulators, then let the script create the auth user and seed data:

```sh
# Terminal 1:
firebase emulators:start --only auth,firestore

# Terminal 2:
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
FIREBASE_PROJECT=demo-ten99 \
  node seed-demo-user.mjs --create-auth-user \
    --email demo@ten99.local --password demo1234
```

The script prints the UID, email, and password at the end. Sign in via the
Google provider in the Auth emulator UI at <http://localhost:4000/auth>
— Firestore rules require `sign_in_provider == 'google.com'`.

Or pass your own UID (e.g. after signing in via Google in the emulator UI):

```sh
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_PROJECT=demo-ten99 \
  node seed-demo-user.mjs --uid demo-user-1
```

### Against a real project

Sign in to the web app with Google first, grab the UID from the Firebase
Console (Authentication tab), then seed:

```sh
FIREBASE_PROJECT=open-ten99-abc \
  node seed-demo-user.mjs --uid <real-firebase-uid> --months 9 --clients 5
```

Requires ADC (`gcloud auth application-default login`) or a service account
via `GOOGLE_APPLICATION_CREDENTIALS`. `--create-auth-user` works in
production but produces a password-only user that **will not** pass the
`isContractor()` rule check — only Google sign-in does.

### Flags

| Flag                 | Default           | Description                                      |
| -------------------- | ----------------- | ------------------------------------------------ |
| `--uid <uid>`        | —                 | Target UID (required unless `--create-auth-user`) |
| `--create-auth-user` | off               | Provision a Firebase Auth user via admin SDK     |
| `--email <addr>`     | `demo@ten99.local`| Email for the auth user / profile                |
| `--password <pw>`    | `demo1234`        | Password when creating the auth user             |
| `--clients <n>`      | `5`               | Number of demo clients to create                 |
| `--months <n>`       | `9`               | Months of history to generate                    |
| `--wipe`             | off               | Delete the UID's existing docs before seeding    |

## Verify auth isolation

Rules unit test suite proving no user can read, list, or write another user's
documents across every owner-scoped collection. Also verifies portal clients
can only see work items for their own `clientId`.

```sh
# Emulator must be running:
firebase emulators:start --only firestore

# Run the tests:
cd scripts
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_PROJECT=demo-ten99 \
  npm run test:rules
```

Covered collections: `clients`, `apps`, `workItems`, `transactions`,
`receipts`, `timeEntries`, `mileageTrips`, `connectedAccounts`,
`emailTemplates`, plus user-scoped docs (`profiles`, `settings`,
`integrations`) and the vault subcollection.
