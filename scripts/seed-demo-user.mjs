#!/usr/bin/env node
/**
 * Seed a fully populated demo contractor with realistic history.
 *
 * Every document written carries `ownerId === <uid>` so Firestore rules scope
 * it to this user only. Running this against a different UID is safe: data
 * for user A is invisible to user B because all reads require ownerId match.
 *
 * Usage:
 *   # Against a real Firebase project (uses ADC):
 *   FIREBASE_PROJECT=my-project node seed-demo-user.mjs --uid <UID>
 *
 *   # Against the local emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_PROJECT=demo-ten99 \
 *     node seed-demo-user.mjs --uid demo-user-1
 *
 * Options:
 *   --uid <uid>         Target contractor UID (required)
 *   --email <email>     Email for the seeded contractor profile
 *   --clients <n>       Number of clients to create (default 5)
 *   --months <n>        Months of history to generate (default 9)
 *   --wipe              Delete existing docs owned by this UID before seeding
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';

const args = parseArgs(process.argv.slice(2));
if (!args.uid) {
  console.error('ERROR: --uid <uid> is required.');
  process.exit(1);
}

const UID = args.uid;
const EMAIL = args.email ?? `${UID}@demo.ten99.local`;
const CLIENT_COUNT = Number(args.clients ?? 5);
const HISTORY_MONTHS = Number(args.months ?? 9);
const WIPE = Boolean(args.wipe);
const PROJECT_ID =
  process.env.FIREBASE_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  process.env.GOOGLE_CLOUD_PROJECT;

if (!PROJECT_ID) {
  console.error(
    'ERROR: set FIREBASE_PROJECT (or GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT).'
  );
  process.exit(1);
}

// Initialize admin SDK. Emulator mode auto-detected via FIRESTORE_EMULATOR_HOST.
initializeApp({
  projectId: PROJECT_ID,
  credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : applicationDefault(),
});
const db = getFirestore();

// ── Owner-scoped collections (the ones the seed writes to). ───────────────
const OWNER_SCOPED = [
  'clients',
  'apps',
  'workItems',
  'transactions',
  'receipts',
  'timeEntries',
  'mileageTrips',
];

async function wipeOwnerData() {
  console.log(`Wiping existing data for ownerId=${UID}...`);
  for (const col of OWNER_SCOPED) {
    const snap = await db.collection(col).where('ownerId', '==', UID).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.size > 0) {
      await batch.commit();
      console.log(`  deleted ${snap.size} from ${col}`);
    }
  }
}

// ── Deterministic RNG for reproducible seeds keyed on UID. ────────────────
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(hashString(UID));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const round2 = (n) => Math.round(n * 100) / 100;

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Realistic fixtures ────────────────────────────────────────────────────
const COMPANY_POOL = [
  ['Northwind Labs', 'ops@northwindlabs.test', 'Sierra Patel'],
  ['Brightgrove Studio', 'hello@brightgrove.test', 'Marcus Chen'],
  ['Alpine Retail Co', 'accounts@alpineretail.test', 'Jordan Rivera'],
  ['Meridian Health', 'billing@meridianhealth.test', 'Priya Anand'],
  ['Fernwood Bakery', 'owner@fernwoodbakery.test', 'Tomás García'],
  ['Coastline Legal', 'mgmt@coastlinelegal.test', 'Avery Jackson'],
  ['Signal & Ore', 'studio@signalore.test', 'Riley Novak'],
  ['Garnet Pediatrics', 'front@garnetpeds.test', 'Hana Oyelaran'],
];

const APP_TEMPLATES = [
  { name: 'Customer Portal', platform: 'web', stack: ['React', 'Firebase'] },
  { name: 'Admin Dashboard', platform: 'web', stack: ['Next.js', 'Postgres'] },
  { name: 'Mobile App', platform: 'ios', stack: ['Swift', 'SwiftUI'] },
  { name: 'Webhook Service', platform: 'api', stack: ['Node', 'Cloud Run'] },
  { name: 'Internal Tools', platform: 'web', stack: ['Remix', 'Prisma'] },
];

const WORK_SUBJECTS = [
  'Checkout flow bug — tax rounding',
  'Add SSO via Google Workspace',
  'Migrate cron jobs to Cloud Scheduler',
  'New onboarding email sequence',
  'PDF invoice template redesign',
  'Audit log retention policy',
  'Performance: reduce first-paint on dashboard',
  'Integrate Stripe Identity verification',
  'Role-based access for admin panel',
  'Mobile push notifications for order status',
  'Fix webhook retries on 5xx',
  'Backfill analytics for Q1',
];

const EXPENSE_CATEGORIES = [
  ['Software & Subscriptions', 'Adobe Creative Cloud'],
  ['Software & Subscriptions', 'GitHub Team'],
  ['Software & Subscriptions', 'Figma Professional'],
  ['Software & Subscriptions', 'Notion Team'],
  ['Office Supplies', 'Staples order'],
  ['Meals', 'Client lunch — strategy review'],
  ['Travel', 'Rideshare to client office'],
  ['Travel', 'Rental car — offsite'],
  ['Professional Services', 'CPA consultation'],
  ['Phone & Internet', 'Mobile plan'],
];

const INCOME_DESCRIPTIONS = [
  'Stripe payout',
  'ACH from client',
  'Wire transfer — retainer',
  'Check deposit',
];

// ── Helpers to stamp required timestamps + ownerId ───────────────────────
function owned(doc) {
  return { ownerId: UID, ...doc };
}

async function seed() {
  if (WIPE) await wipeOwnerData();

  console.log(`Seeding contractor ${UID} (${EMAIL})`);
  console.log(
    `  project=${PROJECT_ID} clients=${CLIENT_COUNT} history=${HISTORY_MONTHS}mo`
  );

  // 1) Profile + settings (user-scoped by doc ID).
  await db.collection('profiles').doc(UID).set({
    displayName: 'Demo Contractor',
    company: 'Demo Workshop LLC',
    phone: '+1 555 0100',
    website: 'https://demo.ten99.local',
    bio: 'Seeded demo account — generated history for previews and testing.',
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection('settings').doc(UID).set({
    accentColor: '#0D9488',
    hourlyRate: 145,
    companyName: 'Demo Workshop LLC',
    invoicePrefix: 'INV-',
    invoiceNextNumber: 1042,
    invoicePaymentTerms: 'Net 30',
    invoiceNotes: 'Thanks for your business!',
    invoiceTaxRate: 0,
    mileageRate: 0.7,
    roundTimeToQuarterHour: true,
  });

  // 2) Clients
  const clientIds = [];
  for (let i = 0; i < CLIENT_COUNT; i++) {
    const [name, email, contact] = COMPANY_POOL[i % COMPANY_POOL.length];
    const ref = db.collection('clients').doc();
    clientIds.push(ref.id);
    await ref.set(
      owned({
        name: contact,
        email,
        company: name,
        phone: `+1 555 01${String(randInt(10, 99))}`,
        retainerHours: pick([0, 10, 20, 40]),
        retainerBillingMode: 'usage',
        retainerPaused: false,
        createdAt: daysAgo(HISTORY_MONTHS * 30 + randInt(0, 60)),
      })
    );
  }
  console.log(`  ✓ ${clientIds.length} clients`);

  // 3) Apps (1–2 per client)
  const appIds = [];
  for (const clientId of clientIds) {
    const count = randInt(1, 2);
    for (let i = 0; i < count; i++) {
      const tpl = pick(APP_TEMPLATES);
      const ref = db.collection('apps').doc();
      appIds.push({ id: ref.id, clientId });
      await ref.set(
        owned({
          clientId,
          name: tpl.name,
          platform: tpl.platform,
          status: pick(['active', 'active', 'maintenance', 'development']),
          url: 'https://example.test',
          repoUrls: [],
          techStack: tpl.stack,
          environment: 'production',
          createdAt: daysAgo(randInt(60, HISTORY_MONTHS * 30)),
          updatedAt: daysAgo(randInt(1, 30)),
        })
      );
    }
  }
  console.log(`  ✓ ${appIds.length} apps`);

  // 4) Work items — spread across statuses + history window
  const statuses = [
    ['draft', 0.1],
    ['inReview', 0.1],
    ['approved', 0.15],
    ['completed', 0.6],
    ['archived', 0.05],
  ];
  const workItemCount = HISTORY_MONTHS * 6; // ~6 per month
  let completedCount = 0;
  for (let i = 0; i < workItemCount; i++) {
    const { id: appId, clientId } = pick(appIds);
    const status = weightedPick(statuses);
    const type = pick(['changeRequest', 'featureRequest', 'maintenance']);
    const hours = round2(randInt(1, 16) + rand());
    const rate = 145;
    const cost = round2(hours * rate);
    const createdAt = daysAgo(randInt(1, HISTORY_MONTHS * 30));
    const isCompleted = status === 'completed' || status === 'archived';
    if (isCompleted) completedCount++;

    const ref = db.collection('workItems').doc();
    await ref.set(
      owned({
        clientId,
        appId,
        type,
        status,
        subject: pick(WORK_SUBJECTS),
        sourceEmail: `from ${EMAIL}`,
        lineItems: [
          {
            id: randomUUID(),
            description: pick([
              'Engineering time',
              'Design & scoping',
              'QA + deployment',
              'Investigation',
            ]),
            hours,
            cost,
          },
        ],
        totalHours: hours,
        totalCost: cost,
        isBillable: true,
        completed: isCompleted,
        invoiceStatus: isCompleted
          ? pick(['draft', 'sent', 'sent', 'paid', 'paid'])
          : undefined,
        invoiceSentDate: isCompleted ? daysAgo(randInt(1, 60)) : undefined,
        invoicePaidDate:
          isCompleted && rand() > 0.4 ? daysAgo(randInt(0, 45)) : undefined,
        clientApproval: isCompleted ? 'approved' : 'pending',
        createdAt,
        updatedAt: new Date(
          createdAt.getTime() + randInt(1, 20) * 24 * 3600 * 1000
        ),
      })
    );
  }
  console.log(`  ✓ ${workItemCount} workItems (${completedCount} completed)`);

  // 5) Transactions — income + expenses over the history window
  const txCount = HISTORY_MONTHS * 10;
  let txIncome = 0;
  let txExpense = 0;
  for (let i = 0; i < txCount; i++) {
    const isIncome = rand() < 0.35;
    const amount = isIncome
      ? round2(randInt(400, 6000) + rand() * 100)
      : round2(randInt(9, 350) + rand() * 50);
    if (isIncome) txIncome += amount;
    else txExpense += amount;
    const [category, vendor] = isIncome
      ? ['Income', pick(INCOME_DESCRIPTIONS)]
      : pick(EXPENSE_CATEGORIES);
    const date = daysAgo(randInt(0, HISTORY_MONTHS * 30));

    const ref = db.collection('transactions').doc();
    await ref.set(
      owned({
        provider: 'manual',
        date,
        amount: isIncome ? amount : -amount,
        description: vendor,
        category,
        type: isIncome ? 'income' : 'expense',
        matchStatus: 'unmatched',
        isManual: true,
        taxDeductible: !isIncome,
        createdAt: date,
        updatedAt: date,
      })
    );
  }
  console.log(
    `  ✓ ${txCount} transactions ($${round2(txIncome)} in / $${round2(
      txExpense
    )} out)`
  );

  // 6) Receipts
  const receiptCount = Math.floor(HISTORY_MONTHS * 3);
  for (let i = 0; i < receiptCount; i++) {
    const [category, vendor] = pick(EXPENSE_CATEGORIES);
    const date = daysAgo(randInt(0, HISTORY_MONTHS * 30));
    const amount = round2(randInt(8, 280) + rand() * 20);
    const ref = db.collection('receipts').doc();
    await ref.set(
      owned({
        status: pick(['matched', 'unmatched', 'confirmed']),
        imageUrl: 'https://via.placeholder.com/400x600.png?text=Receipt',
        fileName: `receipt-${i + 1}.jpg`,
        uploadedAt: date,
        vendor,
        amount,
        date,
        category,
        createdAt: date,
        updatedAt: date,
      })
    );
  }
  console.log(`  ✓ ${receiptCount} receipts`);

  // 7) Time entries (last 60 days)
  const teCount = 60;
  for (let i = 0; i < teCount; i++) {
    const clientId = pick(clientIds);
    const started = daysAgo(randInt(0, 60));
    const duration = randInt(25, 180) * 60;
    const ended = new Date(started.getTime() + duration * 1000);
    const ref = db.collection('timeEntries').doc();
    await ref.set(
      owned({
        clientId,
        description: pick([
          'Pairing on bug fix',
          'Architecture review',
          'Deploy + smoke test',
          'Code review',
          'Client call',
        ]),
        durationSeconds: duration,
        isBillable: rand() > 0.2,
        startedAt: started,
        endedAt: ended,
        createdAt: ended,
      })
    );
  }
  console.log(`  ✓ ${teCount} timeEntries`);

  // 8) Mileage trips
  const mileageCount = 24;
  for (let i = 0; i < mileageCount; i++) {
    const miles = round2(randInt(3, 48) + rand());
    const rate = 0.7;
    const roundTrip = rand() > 0.5;
    const effective = roundTrip ? miles * 2 : miles;
    const date = daysAgo(randInt(0, HISTORY_MONTHS * 30));
    const ref = db.collection('mileageTrips').doc();
    await ref.set(
      owned({
        date,
        description: pick(['Client visit', 'Offsite meeting', 'Supply run']),
        miles,
        purpose: 'business',
        clientId: pick(clientIds),
        roundTrip,
        rate,
        deduction: round2(effective * rate),
        createdAt: date,
        updatedAt: date,
      })
    );
  }
  console.log(`  ✓ ${mileageCount} mileageTrips`);

  console.log('\nDone. All documents owned by', UID);
}

function weightedPick(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
