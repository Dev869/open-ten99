import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const BATCH_LIMIT = 500;
const RETENTION_DAYS = 30;

/**
 * Scheduled function that runs daily to permanently delete work items
 * that have been in the "discarded" state for more than 30 days.
 *
 * A discarded work item has `discardedAt` set (a Firestore Timestamp)
 * and `status: 'archived'`. Items whose `discardedAt` is older than
 * the retention period are deleted in batches.
 */
export const purgeDiscarded = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "America/Chicago",
    maxInstances: 1,
  },
  async () => {
    const db = admin.firestore();
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    );

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const snapshot = await db
        .collection("workItems")
        .where("discardedAt", "<", cutoff)
        .limit(BATCH_LIMIT)
        .get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      totalDeleted += snapshot.docs.length;

      // If we got fewer than the limit, there are no more to process
      if (snapshot.docs.length < BATCH_LIMIT) {
        hasMore = false;
      }
    }

    logger.info("Purge discarded work items complete", {
      totalDeleted,
      cutoffDate: cutoff.toDate().toISOString(),
    });
  }
);
