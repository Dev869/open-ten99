/**
 * One-time backfill for documents created before the `ownerId` field existed.
 *
 * Context: firestore.rules was tightened so documents WITHOUT `ownerId` are no
 * longer client-accessible (the old "legacy => allow" branch let any contractor
 * read/delete pre-backfill docs cross-tenant). Run this once to assign ownership
 * to legacy documents, then they become accessible again under the strict rule.
 *
 * IMPORTANT: a truly orphaned legacy document has no reliable owner signal. For
 * a single-contractor (self-hosted) deployment, pass the contractor's uid via
 * --owner=<uid> to assign ALL legacy docs to them. For multi-tenant data you
 * must determine ownership another way — do NOT blindly run with --owner.
 *
 * Usage:
 *   # Dry run (default) — only reports what would change:
 *   npx ts-node functions/scripts/backfillOwnerId.ts --owner=<contractorUid>
 *   # Apply:
 *   npx ts-node functions/scripts/backfillOwnerId.ts --owner=<contractorUid> --apply
 *
 * Auth: requires GOOGLE_APPLICATION_CREDENTIALS to point at a service account
 * key with Firestore write access (Admin SDK bypasses security rules).
 */
import * as admin from "firebase-admin";

const COLLECTIONS = ["clients", "projects", "workItems", "quotes", "apps"] as const;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : undefined;
}

async function main(): Promise<void> {
  const ownerId = arg("owner");
  const apply = process.argv.includes("--apply");

  if (!ownerId) {
    console.error("Missing required --owner=<contractorUid>");
    process.exit(1);
  }

  admin.initializeApp();
  const db = admin.firestore();

  let totalLegacy = 0;
  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).get();
    const legacy = snap.docs.filter((d) => d.data().ownerId === undefined);
    totalLegacy += legacy.length;
    console.log(`${col}: ${legacy.length} legacy doc(s) without ownerId`);

    if (apply && legacy.length > 0) {
      // Firestore batches cap at 500 writes.
      for (let i = 0; i < legacy.length; i += 450) {
        const batch = db.batch();
        for (const d of legacy.slice(i, i + 450)) {
          batch.update(d.ref, { ownerId });
        }
        await batch.commit();
      }
      console.log(`  -> assigned ownerId=${ownerId} to ${legacy.length} doc(s)`);
    }
  }

  console.log(
    apply
      ? `Done. Backfilled ${totalLegacy} document(s).`
      : `Dry run: ${totalLegacy} document(s) would be backfilled. Re-run with --apply.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
