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
  const doc = await db
    .collection("_secrets")
    .doc(userId)
    .collection("github")
    .doc("token")
    .get();
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
  await db
    .collection("integrations")
    .doc(userId)
    .set(
      {
        connected: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
