import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString, defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { githubJson, getGitHubToken, markDisconnected } from "./utils/githubClient";
import { syncAppActivity, GitHubRepo } from "./utils/syncActivity";
import { encryptToken } from "./utils/crypto";

const GITHUB_CLIENT_ID = defineString("GITHUB_CLIENT_ID");
const GITHUB_CLIENT_SECRET = defineString("GITHUB_CLIENT_SECRET");
const encryptionKey = defineSecret("TOKEN_ENCRYPTION_KEY");

const REDIRECT_URI = defineString("GITHUB_REDIRECT_URI");
const OAUTH_SCOPE = "repo,read:org";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubOrg {
  login: string;
  avatar_url: string;
}

/**
 * Generates a GitHub OAuth authorization URL and stores a one-time state token
 * for CSRF protection.
 */
export const getGitHubAuthUrl = onCall(
  { cors: true, invoker: "public", maxInstances: 10, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to connect GitHub."
      );
    }

    const uid = request.auth.uid;
    const db = admin.firestore();

    try {
      const state = crypto.randomBytes(32).toString("hex");

      await db
        .collection("_secrets")
        .doc(uid)
        .collection("oauthState")
        .doc("github")
        .set({
          state,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID.value(),
        scope: OAUTH_SCOPE,
        state,
        redirect_uri: REDIRECT_URI.value(),
      });

      const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

      logger.info("GitHub auth URL generated", { uid });

      return { authUrl };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Failed to generate GitHub auth URL", { error, uid });
      throw new HttpsError(
        "internal",
        "Failed to generate GitHub authorization URL. Please try again."
      );
    }
  }
);

/**
 * Handles the GitHub OAuth callback: validates the state token, exchanges the
 * authorization code for an access token, and persists user/org metadata.
 */
export const handleGitHubCallback = onCall(
  { cors: true, invoker: "public", maxInstances: 10, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to complete GitHub authorization."
      );
    }

    const uid = request.auth.uid;
    const { code, state } = request.data as { code?: string; state?: string };

    if (!code || typeof code !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Authorization code is required."
      );
    }
    if (!state || typeof state !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "State token is required."
      );
    }

    const db = admin.firestore();

    try {
      // --- Validate state token ---
      const stateRef = db
        .collection("_secrets")
        .doc(uid)
        .collection("oauthState")
        .doc("github");

      const stateSnap = await stateRef.get();

      if (!stateSnap.exists) {
        throw new HttpsError(
          "not-found",
          "OAuth state token not found. Please restart the GitHub connection flow."
        );
      }

      const stateData = stateSnap.data()!;

      if (stateData.state !== state) {
        throw new HttpsError(
          "permission-denied",
          "Invalid OAuth state token. Please restart the GitHub connection flow."
        );
      }

      const createdAt: admin.firestore.Timestamp = stateData.createdAt;
      const ageMs = Date.now() - createdAt.toMillis();
      if (ageMs > STATE_TTL_MS) {
        throw new HttpsError(
          "deadline-exceeded",
          "OAuth state token has expired. Please restart the GitHub connection flow."
        );
      }

      // Delete the one-time state token immediately
      await stateRef.delete();

      // --- Exchange code for access token ---
      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID.value(),
            client_secret: GITHUB_CLIENT_SECRET.value(),
            code,
            redirect_uri: REDIRECT_URI.value(),
          }),
        }
      );

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        logger.error("GitHub token exchange failed", {
          status: tokenRes.status,
          body: text,
          uid,
        });
        throw new HttpsError(
          "internal",
          "Failed to exchange authorization code for GitHub token."
        );
      }

      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        token_type?: string;
        scope?: string;
        error?: string;
        error_description?: string;
      };

      if (tokenData.error || !tokenData.access_token) {
        logger.error("GitHub token exchange returned error", {
          error: tokenData.error,
          description: tokenData.error_description,
          uid,
        });
        throw new HttpsError(
          "permission-denied",
          tokenData.error_description ?? "GitHub authorization was denied."
        );
      }

      const accessToken = tokenData.access_token;
      const encryptedAccessToken = encryptToken(accessToken, encryptionKey.value());

      // --- Fetch GitHub user info and orgs in parallel ---
      const [user, orgs] = await Promise.all([
        githubJson<GitHubUser>(accessToken, "/user"),
        githubJson<GitHubOrg[]>(accessToken, "/user/orgs"),
      ]);

      const accountId = String(user.id);

      // --- Store token securely at the per-account path ---
      await db
        .collection("_secrets")
        .doc(uid)
        .collection("githubAccounts")
        .doc(accountId)
        .set({
          accessToken: encryptedAccessToken,
          tokenType: tokenData.token_type ?? "bearer",
          scope: tokenData.scope ?? OAUTH_SCOPE,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // --- Write per-account metadata into the githubAccounts sub-collection ---
      await db
        .collection("integrations")
        .doc(uid)
        .collection("githubAccounts")
        .doc(accountId)
        .set(
          {
            accountId,
            login: user.login,
            name: user.name,
            avatarUrl: user.avatar_url,
            profileUrl: user.html_url,
            orgs: orgs.map((org) => ({
              login: org.login,
              avatarUrl: org.avatar_url,
            })),
            scope: tokenData.scope ?? OAUTH_SCOPE,
            connectedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      // --- Update the parent integration doc with a lightweight aggregate. ---
      // Legacy single-account fields (githubLogin etc.) are left on the doc
      // if present; the frontend now reads the sub-collection as the source
      // of truth. The "connected" flag remains for any existing queries.
      await db.collection("integrations").doc(uid).set(
        {
          connected: true,
          provider: "github",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("GitHub account connected", {
        uid,
        accountId,
        githubLogin: user.login,
      });

      return {
        success: true,
        accountId,
        githubLogin: user.login,
        githubName: user.name,
        githubAvatarUrl: user.avatar_url,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("GitHub callback handling failed", { error, uid });
      throw new HttpsError(
        "internal",
        "Failed to complete GitHub authorization. Please try again."
      );
    }
  }
);

// ---------------------------------------------------------------------------
// inferPlatform
// ---------------------------------------------------------------------------

/**
 * Infers an app platform label from a repo's primary language and topics.
 */
function inferPlatform(
  language: string | null,
  topics: string[]
): string {
  const allTopics = topics.map((t) => t.toLowerCase());

  if (allTopics.includes("ios") || allTopics.includes("swift")) return "ios";
  if (allTopics.includes("android") || allTopics.includes("kotlin")) return "android";
  if (
    allTopics.includes("react-native") ||
    allTopics.includes("flutter") ||
    allTopics.includes("expo")
  ) {
    return "mobile";
  }
  if (
    allTopics.includes("web") ||
    allTopics.includes("react") ||
    allTopics.includes("nextjs") ||
    allTopics.includes("vue") ||
    allTopics.includes("angular")
  ) {
    return "web";
  }

  const lang = (language ?? "").toLowerCase();
  if (lang === "swift") return "ios";
  if (lang === "kotlin" || lang === "java") return "android";
  if (lang === "dart") return "mobile";
  if (
    lang === "typescript" ||
    lang === "javascript" ||
    lang === "html" ||
    lang === "css"
  ) {
    return "web";
  }
  if (lang === "python" || lang === "go" || lang === "rust" || lang === "ruby") {
    return "backend";
  }

  return "other";
}

// ---------------------------------------------------------------------------
// importGitHubRepos
// ---------------------------------------------------------------------------

/**
 * Fetches all repos the authenticated user has access to (personal + org repos)
 * and returns a deduplicated summary list.
 */
export const importGitHubRepos = onCall(
  { cors: true, invoker: "public", maxInstances: 10, timeoutSeconds: 120, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to import GitHub repositories."
      );
    }

    const uid = request.auth.uid;
    const { accountId } = (request.data ?? {}) as { accountId?: string };
    const db = admin.firestore();

    try {
      const token = await getGitHubToken(uid, accountId);

      // Determine orgs: sub-doc when accountId supplied, otherwise legacy
      // fields on the parent integration doc.
      const orgsDocRef = accountId
        ? db
            .collection("integrations")
            .doc(uid)
            .collection("githubAccounts")
            .doc(accountId)
        : db.collection("integrations").doc(uid);

      const [userRepos, orgsSnap] = await Promise.all([
        githubJson<GitHubRepo[]>(
          token,
          "/user/repos?per_page=100&sort=updated&type=all"
        ),
        orgsDocRef.get(),
      ]);

      const orgs: Array<{ login: string }> = orgsSnap.data()?.orgs ?? [];

      // Fetch org repos in parallel
      const orgRepoArrays = await Promise.all(
        orgs.map((org) =>
          githubJson<GitHubRepo[]>(
            token,
            `/orgs/${org.login}/repos?per_page=100&sort=updated&type=all`
          ).catch(() => [] as GitHubRepo[])
        )
      );

      // Merge and deduplicate by full_name
      const allRepos = [userRepos, ...orgRepoArrays].flat();
      const seen = new Set<string>();
      const dedupedRepos: GitHubRepo[] = [];
      for (const repo of allRepos) {
        if (!seen.has(repo.full_name)) {
          seen.add(repo.full_name);
          dedupedRepos.push(repo);
        }
      }

      // Return summaries
      const summaries = dedupedRepos.map((repo) => ({
        fullName: repo.full_name,
        name: repo.name,
        description: repo.description ?? "",
        htmlUrl: repo.html_url,
        language: repo.language ?? "",
        topics: repo.topics ?? [],
        private: repo.private,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        openIssuesCount: repo.open_issues_count,
        defaultBranch: repo.default_branch,
        pushedAt: repo.pushed_at ?? null,
        updatedAt: repo.updated_at ?? null,
        platform: inferPlatform(repo.language, repo.topics ?? []),
      }));

      logger.info("importGitHubRepos complete", {
        uid,
        accountId,
        repoCount: summaries.length,
      });

      return { repos: summaries, accountId: accountId ?? null };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("importGitHubRepos failed", { error, uid });
      throw new HttpsError(
        "internal",
        "Failed to import GitHub repositories. Please try again."
      );
    }
  }
);

// ---------------------------------------------------------------------------
// linkRepoToApp
// ---------------------------------------------------------------------------

/**
 * Links a GitHub repository to an existing app or creates a new app for it.
 * If appId is provided, updates the existing app (ownership verified).
 * If clientId is provided, creates a new app with auto-populated fields.
 */
export const linkRepoToApp = onCall(
  { cors: true, invoker: "public", maxInstances: 10, timeoutSeconds: 120, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to link a repository."
      );
    }

    const uid = request.auth.uid;
    const { repoFullName, appId, clientId, githubAccountId } =
      request.data as {
        repoFullName?: string;
        appId?: string;
        clientId?: string;
        githubAccountId?: string;
      };

    if (!repoFullName || typeof repoFullName !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "repoFullName is required."
      );
    }
    if (!appId && !clientId) {
      throw new HttpsError(
        "invalid-argument",
        "Either appId or clientId must be provided."
      );
    }

    const db = admin.firestore();

    try {
      const token = await getGitHubToken(uid, githubAccountId);

      // Check for duplicate: same owner already linked this repo
      const duplicateSnap = await db
        .collection("apps")
        .where("ownerId", "==", uid)
        .where("githubRepo.fullName", "==", repoFullName)
        .limit(1)
        .get();

      if (!duplicateSnap.empty) {
        throw new HttpsError(
          "already-exists",
          `Repository ${repoFullName} is already linked to one of your apps.`
        );
      }

      // Fetch repo metadata for populating fields
      const repo = await githubJson<GitHubRepo>(
        token,
        `/repos/${repoFullName}`
      );

      const githubRepoData = {
        fullName: repo.full_name,
        name: repo.name,
        description: repo.description ?? "",
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        language: repo.language ?? "",
        topics: repo.topics ?? [],
        defaultBranch: repo.default_branch,
        private: repo.private,
      };

      let resolvedAppId: string;

      if (appId) {
        // Verify ownership
        const appSnap = await db.collection("apps").doc(appId).get();
        if (!appSnap.exists) {
          throw new HttpsError("not-found", "App not found.");
        }
        const appData = appSnap.data()!;
        if (appData.ownerId !== uid) {
          throw new HttpsError(
            "permission-denied",
            "You do not have permission to modify this app."
          );
        }

        const appUpdate: Record<string, unknown> = {
          githubRepo: githubRepoData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (githubAccountId) {
          appUpdate.githubAccountId = githubAccountId;
        }
        await db.collection("apps").doc(appId).update(appUpdate);

        resolvedAppId = appId;
        logger.info("linkRepoToApp: updated existing app", {
          uid,
          appId,
          repoFullName,
        });
      } else {
        // Create a new app
        const platform = inferPlatform(repo.language, repo.topics ?? []);
        const techStack: string[] = [];
        if (repo.language) techStack.push(repo.language);
        if (repo.topics) {
          for (const topic of repo.topics.slice(0, 4)) {
            if (!techStack.includes(topic)) techStack.push(topic);
          }
        }

        const newAppRef = db.collection("apps").doc();
        await newAppRef.set({
          ownerId: uid,
          clientId: clientId ?? null,
          name: repo.name,
          description: repo.description ?? "",
          platform,
          status: "active",
          repoUrls: [repo.html_url],
          techStack,
          githubRepo: githubRepoData,
          githubAccountId: githubAccountId ?? null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        resolvedAppId = newAppRef.id;
        logger.info("linkRepoToApp: created new app", {
          uid,
          appId: resolvedAppId,
          repoFullName,
          clientId,
        });
      }

      // Perform initial activity sync (non-fatal)
      try {
        await syncAppActivity(token, resolvedAppId, repoFullName);
      } catch (syncError) {
        logger.warn("linkRepoToApp: initial syncAppActivity failed (non-fatal)", {
          syncError,
          appId: resolvedAppId,
          repoFullName,
        });
      }

      return { success: true, appId: resolvedAppId };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("linkRepoToApp failed", { error, uid });
      throw new HttpsError(
        "internal",
        "Failed to link repository. Please try again."
      );
    }
  }
);

// ---------------------------------------------------------------------------
// triggerGitHubSync
// ---------------------------------------------------------------------------

/**
 * Callable function that lets a user manually trigger a GitHub sync for their
 * apps. Rate-limited to once per 5 minutes.
 */
export const triggerGitHubSync = onCall(
  { cors: true, invoker: "public", maxInstances: 10, timeoutSeconds: 300, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const db = admin.firestore();

    try {
      // Rate limit: 5 minutes between syncs
      const integrationDoc = await db.collection("integrations").doc(uid).get();
      if (!integrationDoc.exists || !integrationDoc.data()?.connected) {
        throw new HttpsError("failed-precondition", "GitHub not connected.");
      }
      const lastSync = integrationDoc.data()?.lastSyncAt?.toDate?.();
      if (lastSync && Date.now() - lastSync.getTime() < 5 * 60 * 1000) {
        throw new HttpsError(
          "failed-precondition",
          "Please wait at least 5 minutes between syncs."
        );
      }

      const { syncUserApps } = await import("./syncGitHub");
      await syncUserApps(uid);

      return { success: true };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("triggerGitHubSync failed", { error, uid });
      throw new HttpsError(
        "internal",
        "Failed to trigger GitHub sync. Please try again."
      );
    }
  }
);

// ---------------------------------------------------------------------------
// disconnectGitHub
// ---------------------------------------------------------------------------

/**
 * Disconnects GitHub by removing the stored access token and marking the
 * integration as disconnected.
 */
export const disconnectGitHub = onCall(
  { cors: true, invoker: "public", maxInstances: 10, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to disconnect GitHub."
      );
    }

    const uid = request.auth.uid;
    const { accountId } = (request.data ?? {}) as { accountId?: string };
    const db = admin.firestore();

    try {
      if (accountId) {
        // Multi-account path: remove just this account's token and metadata.
        await Promise.all([
          db
            .collection("_secrets")
            .doc(uid)
            .collection("githubAccounts")
            .doc(accountId)
            .delete(),
          db
            .collection("integrations")
            .doc(uid)
            .collection("githubAccounts")
            .doc(accountId)
            .delete(),
        ]);

        // If no accounts remain, clear the parent aggregate too.
        const remaining = await db
          .collection("integrations")
          .doc(uid)
          .collection("githubAccounts")
          .limit(1)
          .get();
        if (remaining.empty) {
          await markDisconnected(uid);
        }

        logger.info("GitHub account disconnected", { uid, accountId });
        return { success: true, accountId };
      }

      // Legacy path: wipe everything GitHub for this user.
      const accountsSnap = await db
        .collection("integrations")
        .doc(uid)
        .collection("githubAccounts")
        .get();

      const secretsAccountsSnap = await db
        .collection("_secrets")
        .doc(uid)
        .collection("githubAccounts")
        .get();

      const deletions: Promise<unknown>[] = [
        db
          .collection("_secrets")
          .doc(uid)
          .collection("github")
          .doc("token")
          .delete(),
      ];
      accountsSnap.forEach((d) => deletions.push(d.ref.delete()));
      secretsAccountsSnap.forEach((d) => deletions.push(d.ref.delete()));
      await Promise.all(deletions);

      await markDisconnected(uid);

      logger.info("GitHub disconnected (all accounts)", { uid });

      return { success: true };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Failed to disconnect GitHub", { error, uid });
      throw new HttpsError(
        "internal",
        "Failed to disconnect GitHub. Please try again."
      );
    }
  }
);
