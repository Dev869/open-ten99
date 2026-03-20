import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
  getGitHubToken,
  GitHubTokenRevoked,
  markDisconnected,
} from "./utils/githubClient";
import { syncAppActivity } from "./utils/syncActivity";

/**
 * Syncs all GitHub-linked apps for a single user. Fetches the user's token,
 * finds every app with a linked repo, and calls syncAppActivity for each one.
 * If the token is revoked mid-sync the integration is marked disconnected and
 * the loop exits early. All other per-app errors are logged and skipped so that
 * one bad repo cannot block the rest.
 */
export async function syncUserApps(userId: string): Promise<void> {
  const db = admin.firestore();
  let token: string;
  try {
    token = await getGitHubToken(userId);
  } catch {
    logger.warn("No GitHub token for user", { userId });
    return;
  }

  const appsSnap = await db
    .collection("apps")
    .where("ownerId", "==", userId)
    .get();
  const linkedApps = appsSnap.docs.filter(
    (doc) => doc.data().githubRepo?.fullName
  );

  logger.info("Syncing GitHub apps", { userId, appCount: linkedApps.length });

  for (const appDoc of linkedApps) {
    const fullName = appDoc.data().githubRepo.fullName as string;
    try {
      await syncAppActivity(token, appDoc.id, fullName);
    } catch (error) {
      if (error instanceof GitHubTokenRevoked) {
        await markDisconnected(userId);
        logger.warn("Token revoked during sync", { userId });
        return;
      }
      logger.error("Failed to sync app", {
        userId,
        appId: appDoc.id,
        fullName,
        error,
      });
    }
  }

  await db
    .collection("integrations")
    .doc(userId)
    .set(
      { lastSyncAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
}

/**
 * Scheduled function that runs every 6 hours to sync GitHub activity for all
 * connected integrations.
 */
export const syncGitHub = onSchedule(
  { schedule: "every 6 hours", timeoutSeconds: 540, maxInstances: 1 },
  async () => {
    const db = admin.firestore();
    const integrationsSnap = await db
      .collection("integrations")
      .where("connected", "==", true)
      .get();

    logger.info("Starting GitHub sync", {
      userCount: integrationsSnap.docs.length,
    });

    for (const doc of integrationsSnap.docs) {
      try {
        await syncUserApps(doc.id);
      } catch (error) {
        logger.error("User sync failed", { userId: doc.id, error });
      }
    }

    logger.info("GitHub sync complete");
  }
);
