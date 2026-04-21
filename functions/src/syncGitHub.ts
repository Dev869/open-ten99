import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
  getGitHubToken,
  GitHubTokenRevoked,
  listGitHubAccountIds,
  markDisconnected,
} from "./utils/githubClient";
import { syncAppActivity } from "./utils/syncActivity";

/**
 * Fetch a token for a user, trying each linked account in order. Accounts
 * whose tokens are revoked have their per-account docs removed. Falls back
 * to the legacy single-account token path when no multi-account docs exist.
 */
async function resolveTokenForApp(
  userId: string,
  preferredAccountId: string | null
): Promise<{ token: string; accountId: string | null } | null> {
  if (preferredAccountId) {
    try {
      const token = await getGitHubToken(userId, preferredAccountId);
      return { token, accountId: preferredAccountId };
    } catch (err) {
      logger.warn("Preferred GitHub account unavailable, falling back", {
        userId,
        accountId: preferredAccountId,
        err,
      });
    }
  }
  const accountIds = await listGitHubAccountIds(userId);
  for (const accountId of accountIds) {
    try {
      const token = await getGitHubToken(userId, accountId);
      return { token, accountId };
    } catch {
      // ignore — try the next account
    }
  }
  try {
    const token = await getGitHubToken(userId);
    return { token, accountId: null };
  } catch {
    return null;
  }
}

/**
 * Syncs all GitHub-linked apps for a single user. Each app is synced with
 * the token of the GitHub account it was linked under (when recorded);
 * otherwise the first available account's token is used. Revoked tokens
 * disconnect just the account they came from rather than the whole user.
 */
export async function syncUserApps(userId: string): Promise<void> {
  const db = admin.firestore();

  const appsSnap = await db
    .collection("apps")
    .where("ownerId", "==", userId)
    .get();
  const linkedApps = appsSnap.docs.filter(
    (doc) => doc.data().githubRepo?.fullName
  );

  logger.info("Syncing GitHub apps", { userId, appCount: linkedApps.length });

  for (const appDoc of linkedApps) {
    const appData = appDoc.data();
    const fullName = appData.githubRepo.fullName as string;
    const preferredAccountId: string | null = appData.githubAccountId ?? null;

    const resolved = await resolveTokenForApp(userId, preferredAccountId);
    if (!resolved) {
      logger.warn("No GitHub token available for app; skipping", {
        userId,
        appId: appDoc.id,
        fullName,
      });
      continue;
    }

    try {
      await syncAppActivity(resolved.token, appDoc.id, fullName);
    } catch (error) {
      if (error instanceof GitHubTokenRevoked) {
        logger.warn("Token revoked during sync", {
          userId,
          accountId: resolved.accountId,
        });
        if (resolved.accountId) {
          await Promise.all([
            db
              .collection("_secrets")
              .doc(userId)
              .collection("githubAccounts")
              .doc(resolved.accountId)
              .delete(),
            db
              .collection("integrations")
              .doc(userId)
              .collection("githubAccounts")
              .doc(resolved.accountId)
              .delete(),
          ]);
        } else {
          // Legacy path — the only available token is gone.
          await markDisconnected(userId);
          return;
        }
        continue;
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
