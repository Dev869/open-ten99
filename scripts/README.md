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

### Against the Firebase emulator

```sh
# In one terminal:
firebase emulators:start --only firestore

# In another:
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_PROJECT=demo-ten99 \
  node seed-demo-user.mjs --uid demo-user-1
```

### Against a real project

Requires Application Default Credentials (`gcloud auth application-default login`)
or a service account via `GOOGLE_APPLICATION_CREDENTIALS`.

```sh
FIREBASE_PROJECT=open-ten99-abc \
  node seed-demo-user.mjs --uid <real-firebase-uid> --months 9 --clients 5
```

### Flags

| Flag            | Default | Description                                     |
| --------------- | ------- | ----------------------------------------------- |
| `--uid <uid>`   | —       | Target contractor UID (required)                |
| `--email <addr>`| generated | Email used in the seeded profile              |
| `--clients <n>` | `5`     | Number of demo clients to create                |
| `--months <n>`  | `9`     | Months of history to generate                   |
| `--wipe`        | off     | Delete the UID's existing docs before seeding   |

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
