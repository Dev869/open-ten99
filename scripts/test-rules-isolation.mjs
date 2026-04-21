/**
 * Firestore rules isolation tests.
 *
 * Proves that no authenticated user can read, list, or write another user's
 * data across every owner-scoped collection. Runs against the Firebase
 * emulator using @firebase/rules-unit-testing.
 *
 * Prereqs:
 *   - Emulator running: `firebase emulators:start --only firestore`
 *   - Env: FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT=demo-ten99
 *   - `npm install` inside scripts/
 *
 * Run:
 *   cd scripts && npm run test:rules
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(__dirname, '..', 'firestore.rules');

const PROJECT_ID = process.env.FIREBASE_PROJECT ?? 'demo-ten99';

const OWNER_COLLECTIONS = [
  'clients',
  'apps',
  'workItems',
  'quotes',
  'transactions',
  'receipts',
  'timeEntries',
  'mileageTrips',
  'connectedAccounts',
  'emailTemplates',
];

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await fs.readFile(rulesPath, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

/** Returns a Firestore client for a contractor (Google sign-in provider). */
function contractorCtx(uid) {
  return testEnv
    .authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } })
    .firestore();
}

/** Seeds a doc owned by `ownerUid` via admin (bypasses rules). */
async function seedAs(ownerUid, col, docId, extra = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), col, docId), {
      ownerId: ownerUid,
      createdAt: new Date(),
      ...extra,
    });
  });
}

describe('Firestore rules — cross-user isolation', () => {
  for (const col of OWNER_COLLECTIONS) {
    describe(col, () => {
      test('user B cannot read user A document', async () => {
        const docId = `${col}-a-1`;
        await seedAs('userA', col, docId, clientSpecificExtras(col));
        const b = contractorCtx('userB');
        await assertFails(getDoc(doc(b, col, docId)));
      });

      test('user B cannot list user A documents via query', async () => {
        const docId = `${col}-a-2`;
        await seedAs('userA', col, docId, clientSpecificExtras(col));
        const b = contractorCtx('userB');
        await assertFails(
          getDocs(query(collection(b, col), where('ownerId', '==', 'userA')))
        );
      });

      test('user B cannot overwrite user A document (even claiming ownership)', async () => {
        const docId = `${col}-a-3`;
        await seedAs('userA', col, docId, clientSpecificExtras(col));
        const b = contractorCtx('userB');
        await assertFails(
          setDoc(doc(b, col, docId), {
            ownerId: 'userB', // try to steal
            ...clientSpecificExtras(col),
          })
        );
      });

      test('user B cannot update user A document', async () => {
        const docId = `${col}-a-4`;
        await seedAs('userA', col, docId, clientSpecificExtras(col));
        const b = contractorCtx('userB');
        await assertFails(
          updateDoc(doc(b, col, docId), { ownerId: 'userB' })
        );
      });

      test('user B cannot delete user A document', async () => {
        const docId = `${col}-a-5`;
        await seedAs('userA', col, docId, clientSpecificExtras(col));
        const b = contractorCtx('userB');
        await assertFails(deleteDoc(doc(b, col, docId)));
      });

      test('user A can CRUD their own document', async () => {
        const a = contractorCtx('userA');
        const ref = doc(a, col, `${col}-a-own`);
        await assertSucceeds(
          setDoc(ref, { ownerId: 'userA', ...clientSpecificExtras(col) })
        );
        await assertSucceeds(getDoc(ref));
        await assertSucceeds(
          updateDoc(ref, { ownerId: 'userA', updatedAt: new Date() })
        );
        await assertSucceeds(deleteDoc(ref));
      });

      test('user A cannot create document claiming another ownerId', async () => {
        const a = contractorCtx('userA');
        const ref = doc(a, col, `${col}-a-bad`);
        await assertFails(
          setDoc(ref, { ownerId: 'userB', ...clientSpecificExtras(col) })
        );
      });
    });
  }

  describe('user-scoped by doc ID (profiles, settings, integrations)', () => {
    for (const col of ['profiles', 'settings', 'integrations']) {
      test(`${col}: user B cannot read user A's document`, async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await setDoc(doc(ctx.firestore(), col, 'userA'), { any: 'data' });
        });
        const b = contractorCtx('userB');
        await assertFails(getDoc(doc(b, col, 'userA')));
      });

      test(`${col}: user A can read their own document`, async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await setDoc(doc(ctx.firestore(), col, 'userA'), { any: 'data' });
        });
        const a = contractorCtx('userA');
        await assertSucceeds(getDoc(doc(a, col, 'userA')));
      });
    }
  });

  describe('vault credentials', () => {
    test('user B cannot read user A vault credentials', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'vaults/userA/credentials/cred-1'),
          { encryptedData: 'ciphertext' }
        );
      });
      const b = contractorCtx('userB');
      await assertFails(
        getDoc(doc(b, 'vaults/userA/credentials/cred-1'))
      );
    });

    test('user A can read their own vault credentials', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'vaults/userA/credentials/cred-1'),
          { encryptedData: 'ciphertext' }
        );
      });
      const a = contractorCtx('userA');
      await assertSucceeds(
        getDoc(doc(a, 'vaults/userA/credentials/cred-1'))
      );
    });
  });

  describe('portal client isolation', () => {
    test('portal client cannot read a work item for a different clientId', async () => {
      await seedAs('contractorA', 'workItems', 'wi-1', {
        clientId: 'client-1',
        subject: 'secret',
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-2' })
        .firestore();
      await assertFails(getDoc(doc(portalCtx, 'workItems', 'wi-1')));
    });

    test('portal client can read their own work item', async () => {
      await seedAs('contractorA', 'workItems', 'wi-2', {
        clientId: 'client-1',
        subject: 'visible',
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-1' })
        .firestore();
      await assertSucceeds(getDoc(doc(portalCtx, 'workItems', 'wi-2')));
    });

    test('portal client cannot modify arbitrary fields', async () => {
      await seedAs('contractorA', 'workItems', 'wi-3', {
        clientId: 'client-1',
        subject: 'locked',
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-1' })
        .firestore();
      await assertFails(
        updateDoc(doc(portalCtx, 'workItems', 'wi-3'), { subject: 'tampered' })
      );
    });

    test('portal client cannot read a quote for a different clientId', async () => {
      await seedAs('contractorA', 'quotes', 'q-1', {
        clientId: 'client-1',
        title: 'secret',
        status: 'sent',
        lineItems: [],
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-2' })
        .firestore();
      await assertFails(getDoc(doc(portalCtx, 'quotes', 'q-1')));
    });

    test('portal client can read their own quote', async () => {
      await seedAs('contractorA', 'quotes', 'q-2', {
        clientId: 'client-1',
        title: 'visible',
        status: 'sent',
        lineItems: [],
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-1' })
        .firestore();
      await assertSucceeds(getDoc(doc(portalCtx, 'quotes', 'q-2')));
    });

    test('portal client can accept their own quote', async () => {
      await seedAs('contractorA', 'quotes', 'q-3', {
        clientId: 'client-1',
        title: 'accept-me',
        status: 'sent',
        lineItems: [],
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-1' })
        .firestore();
      await assertSucceeds(
        updateDoc(doc(portalCtx, 'quotes', 'q-3'), {
          status: 'accepted',
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    test('portal client cannot mutate quote pricing', async () => {
      await seedAs('contractorA', 'quotes', 'q-4', {
        clientId: 'client-1',
        title: 'locked',
        status: 'sent',
        totalCost: 100,
        lineItems: [],
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-1' })
        .firestore();
      await assertFails(
        updateDoc(doc(portalCtx, 'quotes', 'q-4'), { totalCost: 1 })
      );
    });

    test('portal client cannot bypass quote status to "converted"', async () => {
      await seedAs('contractorA', 'quotes', 'q-5', {
        clientId: 'client-1',
        title: 'no-bypass',
        status: 'sent',
        lineItems: [],
      });
      const portalCtx = testEnv
        .authenticatedContext('portal-user', { clientId: 'client-1' })
        .firestore();
      await assertFails(
        updateDoc(doc(portalCtx, 'quotes', 'q-5'), {
          status: 'converted',
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });
  });
});

// Some collections have required fields or types that rules read; keep
// payloads rule-safe by adding per-collection stubs here.
function clientSpecificExtras(col) {
  switch (col) {
    case 'workItems':
      return { clientId: 'c1', subject: 'x', status: 'draft' };
    case 'quotes':
      return { clientId: 'c1', title: 'x', status: 'draft', lineItems: [] };
    case 'apps':
      return { clientId: 'c1', name: 'x', repoUrls: [] };
    default:
      return {};
  }
}
