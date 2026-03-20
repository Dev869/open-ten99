# GitHub Integration Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub OAuth, repo import, scheduled sync, and webhook handling as Firebase Cloud Functions so the frontend can connect GitHub accounts, import repos as apps, and display live activity.

**Architecture:** All GitHub API interactions happen server-side via Cloud Functions. OAuth tokens are stored in a server-only `_secrets` collection. Callable functions handle OAuth, import, and manual sync. A scheduled function syncs every 6 hours. An HTTPS endpoint receives GitHub webhooks. A shared GitHub API client wrapper handles auth and 401 detection.

**Tech Stack:** Firebase Cloud Functions v2, firebase-admin, Node 20, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-19-github-integration-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `functions/src/utils/githubClient.ts` | GitHub API client wrapper — authenticated fetch, error handling, 401 detection |
| Create | `functions/src/utils/syncActivity.ts` | Shared sync logic: `syncAppActivity` function + GitHub API types (avoids circular import between github.ts and syncGitHub.ts) |
| Create | `functions/src/github.ts` | Callable functions: `getGitHubAuthUrl`, `handleGitHubCallback`, `disconnectGitHub`, `importGitHubRepos`, `linkRepoToApp`, `triggerGitHubSync` |
| Create | `functions/src/syncGitHub.ts` | Scheduled sync function (every 6 hours) |
| Create | `functions/src/onGitHubWebhook.ts` | HTTPS webhook endpoint for GitHub events |
| Modify | `functions/src/index.ts` | Export new functions |
| Modify | `functions/package.json` | Add `node-fetch` if needed (or use built-in fetch in Node 20) |
| Modify | `firestore.rules` | Add `integrations` and `apps/{appId}/github` rules |
| Modify | `firestore.indexes.json` | Add composite indexes |

---

## Task 1: GitHub API Client Wrapper

**Files:**
- Create: `functions/src/utils/githubClient.ts`

- [ ] **Step 1: Create the GitHub API client**

```typescript
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const GITHUB_API = "https://api.github.com";

export class GitHubTokenRevoked extends Error {
  constructor() {
    super("GitHub token has been revoked");
    this.name = "GitHubTokenRevoked";
  }
}

export async function getGitHubToken(userId: string): Promise<string> {
  const db = admin.firestore();
  const doc = await db.collection("_secrets").doc(userId).collection("github").doc("token").get();
  if (!doc.exists) {
    throw new Error("GitHub not connected");
  }
  const data = doc.data();
  return data?.accessToken as string;
}

export async function githubFetch(
  token: string,
  path: string,
  options?: { method?: string; body?: string }
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body,
  });

  if (res.status === 401) {
    throw new GitHubTokenRevoked();
  }

  if (!res.ok) {
    const text = await res.text();
    logger.error("GitHub API error", { status: res.status, path, body: text });
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }

  return res;
}

export async function githubJson<T>(token: string, path: string): Promise<T> {
  const res = await githubFetch(token, path);
  return (await res.json()) as T;
}

export async function markDisconnected(userId: string): Promise<void> {
  const db = admin.firestore();
  await db.collection("integrations").doc(userId).set({
    connected: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd functions && npm run build`

- [ ] **Step 3: Commit**

```bash
git add functions/src/utils/githubClient.ts
git commit -m "feat: add GitHub API client wrapper with token management"
```

---

## Task 2: OAuth Functions (getGitHubAuthUrl + handleGitHubCallback + disconnectGitHub)

**Files:**
- Create: `functions/src/github.ts`

- [ ] **Step 1: Create github.ts with OAuth functions**

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { getGitHubToken, githubJson, markDisconnected } from "./utils/githubClient";

const githubClientId = defineString("GITHUB_CLIENT_ID");
const githubClientSecret = defineString("GITHUB_CLIENT_SECRET");

// ---------- Types ----------

interface GitHubUser {
  login: string;
  avatar_url: string;
  id: number;
}

interface GitHubOrg {
  login: string;
}

// ---------- getGitHubAuthUrl ----------

export const getGitHubAuthUrl = onCall(
  { maxInstances: 10, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const state = crypto.randomBytes(32).toString("hex");
    const db = admin.firestore();

    // Store state token with 10-minute TTL
    await db
      .collection("_secrets")
      .doc(request.auth.uid)
      .collection("oauthState")
      .doc("github")
      .set({
        token: state,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    const redirectUri = `https://openchanges.web.app/dashboard/github/callback`;
    const url =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${githubClientId.value()}` +
      `&scope=repo,read:org` +
      `&state=${state}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return { url };
  }
);

// ---------- handleGitHubCallback ----------

export const handleGitHubCallback = onCall(
  { maxInstances: 10, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { code, state } = (request.data ?? {}) as {
      code?: string;
      state?: string;
    };

    if (!code || !state) {
      throw new HttpsError("invalid-argument", "code and state are required.");
    }

    const db = admin.firestore();
    const uid = request.auth.uid;

    // Validate and consume state token
    const stateRef = db
      .collection("_secrets")
      .doc(uid)
      .collection("oauthState")
      .doc("github");
    const stateDoc = await stateRef.get();

    if (!stateDoc.exists) {
      throw new HttpsError("failed-precondition", "No pending OAuth flow.");
    }

    const stateData = stateDoc.data();
    if (stateData?.token !== state) {
      throw new HttpsError("invalid-argument", "Invalid state parameter.");
    }

    // Check 10-minute TTL
    const createdAt = stateData?.createdAt?.toDate?.() ?? new Date(0);
    if (Date.now() - createdAt.getTime() > 10 * 60 * 1000) {
      await stateRef.delete();
      throw new HttpsError("failed-precondition", "OAuth session expired. Please try again.");
    }

    // Delete state token (one-time use)
    await stateRef.delete();

    // Exchange code for access token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: githubClientId.value(),
          client_secret: githubClientSecret.value(),
          code,
        }),
      }
    );

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      logger.error("GitHub token exchange failed", { error: tokenData.error });
      throw new HttpsError(
        "internal",
        tokenData.error_description ?? "Failed to connect to GitHub."
      );
    }

    // Store token server-side
    await db
      .collection("_secrets")
      .doc(uid)
      .collection("github")
      .doc("token")
      .set({
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type ?? "bearer",
        scope: tokenData.scope ?? "",
      });

    // Fetch GitHub user info and orgs
    const user = await githubJson<GitHubUser>(
      tokenData.access_token,
      "/user"
    );
    const orgs = await githubJson<GitHubOrg[]>(
      tokenData.access_token,
      "/user/orgs"
    );

    // Write integration metadata (client-readable)
    await db.collection("integrations").doc(uid).set({
      connected: true,
      login: user.login,
      avatarUrl: user.avatar_url,
      orgs: orgs.map((o) => o.login),
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("GitHub connected", { uid, login: user.login });

    return { success: true, login: user.login };
  }
);

// ---------- disconnectGitHub ----------

export const disconnectGitHub = onCall(
  { maxInstances: 10, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const db = admin.firestore();
    const uid = request.auth.uid;

    // Delete token
    await db
      .collection("_secrets")
      .doc(uid)
      .collection("github")
      .doc("token")
      .delete();

    // Mark disconnected (uses set+merge to handle case where doc doesn't exist)
    await markDisconnected(uid);

    logger.info("GitHub disconnected", { uid });

    return { success: true };
  }
);
```

- [ ] **Step 2: Verify build passes**

Run: `cd functions && npm run build`

- [ ] **Step 3: Commit**

```bash
git add functions/src/github.ts
git commit -m "feat: add GitHub OAuth callable functions"
```

---

## Task 3: Shared Sync Activity Module + Import & Link Functions

**Files:**
- Create: `functions/src/utils/syncActivity.ts`
- Modify: `functions/src/github.ts`

- [ ] **Step 1: Create `functions/src/utils/syncActivity.ts`**

This shared module contains `syncAppActivity` and its GitHub API types to avoid a circular import between `github.ts` and `syncGitHub.ts`.

```typescript
// ---------- Types for repos ----------

interface GitHubRepo {
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  open_issues_count: number;
  archived: boolean;
  pushed_at: string;
  html_url: string;
  default_branch: string;
}

interface GitHubPull {
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url: string };
  html_url: string;
  created_at: string;
  merged_at: string | null;
}

interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { date: string } };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url: string };
  html_url: string;
  created_at: string;
  pull_request?: unknown;
}

interface GitHubDeployment {
  id: number;
  environment: string;
  creator: { login: string; avatar_url: string };
  created_at: string;
  // deployment statuses fetched separately
}

// ---------- Platform inference ----------

function inferPlatform(
  language: string | null,
  topics: string[]
): string {
  const all = [language?.toLowerCase(), ...topics.map((t) => t.toLowerCase())].filter(Boolean);
  if (all.some((t) => ["swift", "swiftui"].includes(t!))) return "ios";
  if (all.some((t) => ["kotlin", "android"].includes(t!))) return "android";
  if (all.some((t) => ["react", "vue", "angular", "nextjs", "svelte", "html", "css"].includes(t!))) return "web";
  if (all.some((t) => ["express", "fastapi", "django", "flask", "rails"].includes(t!))) return "api";
  if (all.some((t) => ["electron", "tauri"].includes(t!))) return "desktop";
  return "other";
}

// ---------- Sync activity for one app ----------

export async function syncAppActivity(
  token: string,
  appId: string,
  repoFullName: string
): Promise<void> {
  const db = admin.firestore();
  const activityRef = db.collection("apps").doc(appId).collection("github");

  // Fetch repo metadata
  const repo = await githubJson<GitHubRepo>(token, `/repos/${repoFullName}`);

  // Fetch open PR count
  const openPrs = await githubJson<GitHubPull[]>(
    token,
    `/repos/${repoFullName}/pulls?state=open&per_page=100`
  );
  const openPrCount = openPrs.length;

  // Update app document with repo metadata
  await db
    .collection("apps")
    .doc(appId)
    .update({
      "githubRepo.fullName": repo.full_name,
      "githubRepo.defaultBranch": repo.default_branch,
      "githubRepo.language": repo.language,
      "githubRepo.topics": repo.topics ?? [],
      "githubRepo.stargazersCount": repo.stargazers_count,
      "githubRepo.openPrCount": openPrCount,
      "githubRepo.openIssuesCount": Math.max(0, repo.open_issues_count - openPrCount),
      "githubRepo.archived": repo.archived,
      "githubRepo.pushedAt": new Date(repo.pushed_at),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Fetch recent activity
  const [commits, pulls, issues, deployments] = await Promise.all([
    githubJson<GitHubCommit[]>(token, `/repos/${repoFullName}/commits?per_page=5`),
    githubJson<GitHubPull[]>(token, `/repos/${repoFullName}/pulls?state=all&sort=updated&per_page=5`),
    githubJson<GitHubIssue[]>(token, `/repos/${repoFullName}/issues?state=all&sort=updated&per_page=5`),
    githubJson<GitHubDeployment[]>(token, `/repos/${repoFullName}/deployments?per_page=5`),
  ]);

  // Filter issues to exclude PRs (GitHub API includes PRs in issues endpoint)
  const pureIssues = issues.filter((i) => !i.pull_request);

  // Build activity docs
  const now = admin.firestore.FieldValue.serverTimestamp();
  const activities: Record<string, unknown>[] = [];

  for (const c of commits) {
    activities.push({
      type: "commit",
      title: c.commit.message.split("\n")[0],
      url: c.html_url,
      author: c.author?.login ?? "unknown",
      authorAvatarUrl: c.author?.avatar_url ?? null,
      sha: c.sha.substring(0, 7),
      createdAt: new Date(c.commit.author.date),
      updatedAt: now,
    });
  }

  for (const p of pulls) {
    activities.push({
      type: "pull_request",
      title: p.title,
      url: p.html_url,
      author: p.user.login,
      authorAvatarUrl: p.user.avatar_url,
      number: p.number,
      status: p.merged_at ? "merged" : p.state,
      createdAt: new Date(p.created_at),
      updatedAt: now,
    });
  }

  for (const i of pureIssues.slice(0, 5)) {
    activities.push({
      type: "issue",
      title: i.title,
      url: i.html_url,
      author: i.user.login,
      authorAvatarUrl: i.user.avatar_url,
      number: i.number,
      status: i.state,
      createdAt: new Date(i.created_at),
      updatedAt: now,
    });
  }

  for (const d of deployments) {
    activities.push({
      type: "deployment",
      title: `Deploy to ${d.environment}`,
      url: `https://github.com/${repoFullName}/deployments/${d.id}`,
      author: d.creator.login,
      authorAvatarUrl: d.creator.avatar_url,
      branch: d.environment,
      status: "pending", // Updated by webhook or next sync with status check
      createdAt: new Date(d.created_at),
      updatedAt: now,
    });
  }

  // Delete existing activity docs and write new ones
  const existing = await activityRef.get();
  const batch = db.batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));
  for (const activity of activities) {
    batch.set(activityRef.doc(), activity);
  }
  await batch.commit();
}
```

This file needs imports:
```typescript
import * as admin from "firebase-admin";
import { githubJson } from "./githubClient";
```

- [ ] **Step 2: Add importGitHubRepos and linkRepoToApp to `functions/src/github.ts`**

Add the import for `syncAppActivity` and the platform inference function, then append the callable functions.

Add to imports in `github.ts`:
```typescript
import { syncAppActivity } from "./utils/syncActivity";
```

Add `inferPlatform` as a local function in `github.ts`:

```typescript
function inferPlatform(language: string | null, topics: string[]): string {
  const all = [language?.toLowerCase(), ...topics.map((t) => t.toLowerCase())].filter(Boolean);
  if (all.some((t) => ["swift", "swiftui"].includes(t!))) return "ios";
  if (all.some((t) => ["kotlin", "android"].includes(t!))) return "android";
  if (all.some((t) => ["react", "vue", "angular", "nextjs", "svelte", "html", "css"].includes(t!))) return "web";
  if (all.some((t) => ["express", "fastapi", "django", "flask", "rails"].includes(t!))) return "api";
  if (all.some((t) => ["electron", "tauri"].includes(t!))) return "desktop";
  return "other";
}
```

// ---------- importGitHubRepos ----------

export const importGitHubRepos = onCall(
  { maxInstances: 10, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const uid = request.auth.uid;
    const token = await getGitHubToken(uid);

    // Fetch user repos (up to 100 most recently updated)
    const repos = await githubJson<GitHubRepo[]>(
      token,
      "/user/repos?per_page=100&sort=updated&type=all"
    );

    // Fetch integration to get connected orgs
    const db = admin.firestore();
    const integrationDoc = await db.collection("integrations").doc(uid).get();
    const orgs = (integrationDoc.data()?.orgs as string[]) ?? [];

    // Fetch org repos
    const orgRepos: GitHubRepo[] = [];
    for (const org of orgs) {
      try {
        const oRepos = await githubJson<GitHubRepo[]>(
          token,
          `/orgs/${org}/repos?per_page=100&sort=updated`
        );
        orgRepos.push(...oRepos);
      } catch (e) {
        logger.warn("Failed to fetch org repos", { org, error: e });
      }
    }

    // Deduplicate by full_name
    const allRepos = [...repos, ...orgRepos];
    const seen = new Set<string>();
    const unique = allRepos.filter((r) => {
      if (seen.has(r.full_name)) return false;
      seen.add(r.full_name);
      return true;
    });

    // Return summaries
    return {
      repos: unique.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        description: r.description,
        language: r.language,
        topics: r.topics ?? [],
        stargazersCount: r.stargazers_count,
        archived: r.archived,
        pushedAt: r.pushed_at,
        htmlUrl: r.html_url,
      })),
    };
  }
);

// ---------- linkRepoToApp ----------

export const linkRepoToApp = onCall(
  { maxInstances: 10, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { repoFullName, appId, clientId } = (request.data ?? {}) as {
      repoFullName?: string;
      appId?: string;
      clientId?: string;
    };

    if (!repoFullName) {
      throw new HttpsError("invalid-argument", "repoFullName is required.");
    }
    if (!appId && !clientId) {
      throw new HttpsError(
        "invalid-argument",
        "Either appId or clientId is required."
      );
    }

    const uid = request.auth.uid;
    const token = await getGitHubToken(uid);
    const db = admin.firestore();

    // Check if repo is already linked to an app owned by this user
    const existingSnap = await db
      .collection("apps")
      .where("ownerId", "==", uid)
      .where("githubRepo.fullName", "==", repoFullName)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      throw new HttpsError("already-exists", "This repo is already linked to an app.");
    }

    // Fetch repo info
    const repo = await githubJson<GitHubRepo>(
      token,
      `/repos/${repoFullName}`
    );

    const githubRepoData = {
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      language: repo.language,
      topics: repo.topics ?? [],
      stargazersCount: repo.stargazers_count,
      openPrCount: 0,
      openIssuesCount: repo.open_issues_count,
      archived: repo.archived,
      pushedAt: new Date(repo.pushed_at),
    };

    let targetAppId: string;

    if (appId) {
      // Link to existing app
      const appDoc = await db.collection("apps").doc(appId).get();
      if (!appDoc.exists) {
        throw new HttpsError("not-found", "App not found.");
      }
      if (appDoc.data()?.ownerId !== uid) {
        throw new HttpsError("permission-denied", "Not your app.");
      }
      await db.collection("apps").doc(appId).update({
        githubRepo: githubRepoData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      targetAppId = appId;
    } else {
      // Create new app
      const platform = inferPlatform(repo.language, repo.topics ?? []);
      const newApp = await db.collection("apps").add({
        ownerId: uid,
        clientId,
        name: repo.name,
        description: repo.description ?? "",
        platform,
        status: repo.archived ? "retired" : "active",
        url: "",
        repoUrls: [repo.html_url],
        techStack: [repo.language, ...(repo.topics ?? [])].filter(Boolean),
        hosting: "",
        githubRepo: githubRepoData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      targetAppId = newApp.id;
    }

    // Pull initial activity
    try {
      await syncAppActivity(token, targetAppId, repoFullName);
    } catch (e) {
      logger.warn("Initial activity sync failed", { appId: targetAppId, error: e });
      // Non-fatal — app is linked, sync will retry
    }

    logger.info("Repo linked to app", { uid, repoFullName, appId: targetAppId });

    return { success: true, appId: targetAppId };
  }
);
```

- [ ] **Step 3: Verify build passes**

Run: `cd functions && npm run build`

- [ ] **Step 4: Commit**

```bash
git add functions/src/utils/syncActivity.ts functions/src/github.ts
git commit -m "feat: add syncActivity module, importGitHubRepos and linkRepoToApp"
```

---

## Task 4: triggerGitHubSync Callable

**Files:**
- Modify: `functions/src/github.ts`

- [ ] **Step 1: Add triggerGitHubSync**

Append to `functions/src/github.ts`:

```typescript
// ---------- triggerGitHubSync ----------

export const triggerGitHubSync = onCall(
  { maxInstances: 10, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const uid = request.auth.uid;
    const db = admin.firestore();

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

    // Import syncUserApps — this is safe because syncGitHub.ts no longer
    // imports from github.ts (syncAppActivity is in utils/syncActivity.ts)
    const { syncUserApps } = await import("./syncGitHub");
    await syncUserApps(uid);

    return { success: true };
  }
);
```

- [ ] **Step 2: Verify build passes**

Run: `cd functions && npm run build`
Expected: May fail until Task 5 creates `syncGitHub.ts`. That's OK — commit after Task 5.

---

## Task 5: Scheduled Sync Function

**Files:**
- Create: `functions/src/syncGitHub.ts`

- [ ] **Step 1: Create syncGitHub.ts**

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
  getGitHubToken,
  GitHubTokenRevoked,
  markDisconnected,
} from "./utils/githubClient";
import { syncAppActivity } from "./utils/syncActivity";

// Sync all GitHub-connected apps for a single user
export async function syncUserApps(userId: string): Promise<void> {
  const db = admin.firestore();

  let token: string;
  try {
    token = await getGitHubToken(userId);
  } catch {
    logger.warn("No GitHub token for user", { userId });
    return;
  }

  // Get all apps with githubRepo linked
  const appsSnap = await db
    .collection("apps")
    .where("ownerId", "==", userId)
    .get();

  const linkedApps = appsSnap.docs.filter(
    (doc) => doc.data().githubRepo?.fullName
  );

  logger.info("Syncing GitHub apps", {
    userId,
    appCount: linkedApps.length,
  });

  for (const appDoc of linkedApps) {
    const fullName = appDoc.data().githubRepo.fullName as string;
    try {
      await syncAppActivity(token, appDoc.id, fullName);
    } catch (error) {
      if (error instanceof GitHubTokenRevoked) {
        await markDisconnected(userId);
        logger.warn("Token revoked during sync", { userId });
        return; // Stop syncing for this user
      }
      logger.error("Failed to sync app", {
        userId,
        appId: appDoc.id,
        fullName,
        error,
      });
      // Continue with other apps
    }
  }

  // Update lastSyncAt
  await db.collection("integrations").doc(userId).update({
    lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Scheduled function: every 6 hours
export const syncGitHub = onSchedule(
  {
    schedule: "every 6 hours",
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    const db = admin.firestore();

    // Find all connected users
    const integrationsSnap = await db
      .collection("integrations")
      .where("connected", "==", true)
      .get();

    logger.info("Starting GitHub sync", {
      userCount: integrationsSnap.docs.length,
    });

    // Process users sequentially (within timeout)
    for (const doc of integrationsSnap.docs) {
      try {
        await syncUserApps(doc.id);
      } catch (error) {
        logger.error("User sync failed", { userId: doc.id, error });
        // Continue with other users
      }
    }

    logger.info("GitHub sync complete");
  }
);
```

- [ ] **Step 2: Verify build passes**

Run: `cd functions && npm run build`

- [ ] **Step 3: Commit**

```bash
git add functions/src/github.ts functions/src/syncGitHub.ts
git commit -m "feat: add triggerGitHubSync callable and scheduled sync function"
```

---

## Task 6: GitHub Webhook Endpoint

**Files:**
- Create: `functions/src/onGitHubWebhook.ts`

- [ ] **Step 1: Create the webhook handler**

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

const webhookSecret = defineString("GITHUB_WEBHOOK_SECRET");

function verifySignature(
  payload: Buffer,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export const onGitHubWebhook = onRequest(
  { maxInstances: 10, timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Verify webhook signature using raw body bytes (req.rawBody)
    // IMPORTANT: Do NOT use JSON.stringify(req.body) — Firebase parses JSON
    // bodies automatically, and re-serializing may change byte ordering,
    // causing signature verification to always fail.
    const signature = req.headers["x-hub-signature-256"] as
      | string
      | undefined;

    if (!verifySignature(req.rawBody, signature, webhookSecret.value())) {
      logger.warn("Invalid webhook signature");
      res.status(401).send("Unauthorized");
      return;
    }

    const event = req.headers["x-github-event"] as string;
    const payload = req.body; // Already parsed by Firebase
    const repoFullName = payload?.repository?.full_name as string | undefined;

    if (!repoFullName) {
      res.status(200).send("OK — no repo in payload");
      return;
    }

    const db = admin.firestore();

    // Find all apps linked to this repo
    const appsSnap = await db
      .collection("apps")
      .where("githubRepo.fullName", "==", repoFullName)
      .get();

    if (appsSnap.empty) {
      res.status(200).send("OK — no linked apps");
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Build activity doc based on event type
    let activity: Record<string, unknown> | null = null;

    switch (event) {
      case "push": {
        const headCommit = payload.head_commit;
        if (headCommit) {
          activity = {
            type: "commit",
            title: (headCommit.message as string).split("\n")[0],
            url: headCommit.url,
            author: headCommit.author?.username ?? "unknown",
            authorAvatarUrl: payload.sender?.avatar_url ?? null,
            sha: (headCommit.id as string).substring(0, 7),
            branch: (payload.ref as string).replace("refs/heads/", ""),
            createdAt: new Date(headCommit.timestamp),
            updatedAt: now,
          };
        }
        break;
      }

      case "pull_request": {
        const pr = payload.pull_request;
        activity = {
          type: "pull_request",
          title: pr.title,
          url: pr.html_url,
          author: pr.user.login,
          authorAvatarUrl: pr.user.avatar_url,
          number: pr.number,
          status: pr.merged_at ? "merged" : pr.state,
          createdAt: new Date(pr.created_at),
          updatedAt: now,
        };
        break;
      }

      case "issues": {
        const issue = payload.issue;
        if (issue.pull_request) break; // Skip PRs in issues events
        activity = {
          type: "issue",
          title: issue.title,
          url: issue.html_url,
          author: issue.user.login,
          authorAvatarUrl: issue.user.avatar_url,
          number: issue.number,
          status: issue.state,
          createdAt: new Date(issue.created_at),
          updatedAt: now,
        };
        break;
      }

      case "deployment_status": {
        const deployment = payload.deployment;
        const status = payload.deployment_status;
        const stateMap: Record<string, string> = {
          success: "success",
          failure: "failure",
          error: "failure",
          in_progress: "pending",
          queued: "pending",
          pending: "pending",
          inactive: "inactive",
        };
        activity = {
          type: "deployment",
          title: `Deploy to ${deployment.environment}`,
          url: deployment.url,
          author: status.creator?.login ?? "unknown",
          authorAvatarUrl: status.creator?.avatar_url ?? null,
          branch: deployment.environment,
          status: stateMap[status.state] ?? status.state,
          createdAt: new Date(status.created_at),
          updatedAt: now,
        };
        break;
      }

      default:
        // Unsupported event type
        res.status(200).send(`OK — event ${event} not handled`);
        return;
    }

    if (!activity) {
      res.status(200).send("OK — no activity to record");
      return;
    }

    // Write activity to all matching apps
    const batch = db.batch();
    for (const appDoc of appsSnap.docs) {
      const activityRef = appDoc.ref.collection("github").doc();
      batch.set(activityRef, activity);
    }
    await batch.commit();

    logger.info("Webhook processed", {
      event,
      repo: repoFullName,
      appsUpdated: appsSnap.docs.length,
    });

    res.status(200).json({ success: true, appsUpdated: appsSnap.docs.length });
  }
);
```

- [ ] **Step 2: Verify build passes**

Run: `cd functions && npm run build`

- [ ] **Step 3: Commit**

```bash
git add functions/src/onGitHubWebhook.ts
git commit -m "feat: add GitHub webhook endpoint for real-time activity"
```

---

## Task 7: Export Functions & Update Index

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add exports**

Add to `functions/src/index.ts`:

```typescript
export {
  getGitHubAuthUrl,
  handleGitHubCallback,
  disconnectGitHub,
  importGitHubRepos,
  linkRepoToApp,
  triggerGitHubSync,
} from "./github";
export { syncGitHub } from "./syncGitHub";
export { onGitHubWebhook } from "./onGitHubWebhook";
```

- [ ] **Step 2: Verify build passes**

Run: `cd functions && npm run build`

- [ ] **Step 3: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat: export GitHub functions from index"
```

---

## Task 8: Firestore Rules & Indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Add security rules**

Add to `firestore.rules` before the Settings section:

```
    // ---------------------------------------------------------------------------
    // Integrations: owner can read, server writes only
    // ---------------------------------------------------------------------------
    match /integrations/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }

    // ---------------------------------------------------------------------------
    // GitHub activity subcollection: owner can read, server writes only
    // ---------------------------------------------------------------------------
    // Note: This extends the existing apps/{appId} match block.
    // Add inside the apps match block or as a separate match:
```

Since the `apps` match block doesn't exist as a parent match, add a new top-level match for the subcollection:

```
    match /apps/{appId}/github/{activityId} {
      allow read: if isContractor() && isOwnerOrLegacy(
        get(/databases/$(database)/documents/apps/$(appId)).data
      );
      allow write: if false;
    }
```

- [ ] **Step 2: Add composite indexes**

Add to `firestore.indexes.json`:

```json
{
  "collectionGroup": "apps",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "githubRepo.fullName", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "integrations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "connected", "order": "ASCENDING" }
  ]
}
```

Note: Single-field indexes are created automatically by Firestore, but explicitly listing them ensures they're deployed with `firebase deploy --only firestore:indexes`.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat: add Firestore rules and indexes for GitHub integration"
```

---

## Task 9: Build Verification & Deploy

- [ ] **Step 1: Full functions build**

Run: `cd functions && npm run build`
Expected: Clean build.

- [ ] **Step 2: Add required secrets to .env.example**

Add to `functions/.env.example`:

```
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
```

- [ ] **Step 3: Commit**

```bash
git add functions/.env.example
git commit -m "docs: add GitHub secrets to .env.example"
```

- [ ] **Step 4: Deploy functions and rules**

Run: `firebase deploy --only functions,firestore:rules,firestore:indexes`
Verify deployment succeeds.
