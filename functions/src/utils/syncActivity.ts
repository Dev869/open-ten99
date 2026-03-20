import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { githubJson } from "./githubClient";

// ---------------------------------------------------------------------------
// GitHub API type interfaces
// ---------------------------------------------------------------------------

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  language: string | null;
  topics: string[];
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  private: boolean;
  pushed_at: string | null;
  updated_at: string | null;
}

export interface GitHubPull {
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
  };
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    } | null;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

export interface GitHubDeployment {
  id: number;
  sha: string;
  ref: string;
  environment: string;
  description: string | null;
  creator: {
    login: string;
    avatar_url: string;
  } | null;
  created_at: string;
  updated_at: string;
  statuses_url: string;
}

interface GitHubDeploymentStatus {
  state: string;
}

// ---------------------------------------------------------------------------
// syncAppActivity
// ---------------------------------------------------------------------------

/**
 * Fetches recent GitHub activity for a repo and writes it to Firestore.
 * Updates the app doc with live repo metadata.
 */
export async function syncAppActivity(
  token: string,
  appId: string,
  repoFullName: string
): Promise<void> {
  const db = admin.firestore();

  // 1. Fetch repo metadata
  const repo = await githubJson<GitHubRepo>(
    token,
    `/repos/${repoFullName}`
  );

  // 2. Fetch open PRs to count them
  const openPulls = await githubJson<GitHubPull[]>(
    token,
    `/repos/${repoFullName}/pulls?state=open&per_page=100`
  );
  const openPrCount = openPulls.length;

  // 3. Update app doc with githubRepo.* fields (dot notation)
  const appRef = db.collection("apps").doc(appId);
  await appRef.update({
    "githubRepo.fullName": repo.full_name,
    "githubRepo.name": repo.name,
    "githubRepo.description": repo.description ?? "",
    "githubRepo.htmlUrl": repo.html_url,
    "githubRepo.cloneUrl": repo.clone_url,
    "githubRepo.sshUrl": repo.ssh_url,
    "githubRepo.language": repo.language ?? "",
    "githubRepo.topics": repo.topics ?? [],
    "githubRepo.defaultBranch": repo.default_branch,
    "githubRepo.stargazersCount": repo.stargazers_count,
    "githubRepo.forksCount": repo.forks_count,
    "githubRepo.openIssuesCount": repo.open_issues_count,
    "githubRepo.openPrCount": openPrCount,
    "githubRepo.private": repo.private,
    "githubRepo.pushedAt": repo.pushed_at ?? null,
    "githubRepo.syncedAt": admin.firestore.FieldValue.serverTimestamp(),
  });

  // 4. Fetch recent activity in parallel
  const [commits, pulls, issues, deployments] = await Promise.all([
    githubJson<GitHubCommit[]>(
      token,
      `/repos/${repoFullName}/commits?per_page=5`
    ).catch(() => [] as GitHubCommit[]),
    githubJson<GitHubPull[]>(
      token,
      `/repos/${repoFullName}/pulls?state=all&per_page=5`
    ).catch(() => [] as GitHubPull[]),
    githubJson<GitHubIssue[]>(
      token,
      `/repos/${repoFullName}/issues?state=all&per_page=5`
    ).catch(() => [] as GitHubIssue[]),
    githubJson<GitHubDeployment[]>(
      token,
      `/repos/${repoFullName}/deployments?per_page=5`
    ).catch(() => [] as GitHubDeployment[]),
  ]);

  // Filter issues to exclude pull requests
  const trueIssues = issues.filter((i) => !i.pull_request);

  // Fetch latest deployment statuses
  const deploymentsWithStatus = await Promise.all(
    deployments.map(async (dep) => {
      const statuses = await githubJson<GitHubDeploymentStatus[]>(
        token,
        dep.statuses_url
      ).catch(() => [] as GitHubDeploymentStatus[]);
      return { dep, latestStatus: statuses[0]?.state ?? "unknown" };
    })
  );

  // 5. Build activity docs
  type ActivityDoc = {
    type: string;
    title: string;
    url: string;
    author: string;
    authorAvatarUrl: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    number?: number;
    sha?: string;
    branch?: string;
  };

  const activities: ActivityDoc[] = [
    ...commits.map((c) => ({
      type: "commit" as const,
      title: c.commit.message.split("\n")[0],
      url: c.html_url,
      author: c.author?.login ?? c.commit.author?.name ?? "",
      authorAvatarUrl: c.author?.avatar_url ?? "",
      status: "merged",
      createdAt: c.commit.author?.date ?? "",
      updatedAt: c.commit.author?.date ?? "",
      sha: c.sha,
      branch: repo.default_branch,
    })),
    ...pulls.map((p) => ({
      type: "pull_request" as const,
      title: p.title,
      url: p.html_url,
      author: p.user?.login ?? "",
      authorAvatarUrl: p.user?.avatar_url ?? "",
      status: p.state,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      number: p.number,
      branch: p.head.ref,
    })),
    ...trueIssues.map((i) => ({
      type: "issue" as const,
      title: i.title,
      url: i.html_url,
      author: i.user?.login ?? "",
      authorAvatarUrl: i.user?.avatar_url ?? "",
      status: i.state,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      number: i.number,
    })),
    ...deploymentsWithStatus.map(({ dep, latestStatus }) => ({
      type: "deployment" as const,
      title: `Deploy to ${dep.environment}`,
      url: `https://github.com/${repoFullName}/deployments`,
      author: dep.creator?.login ?? "",
      authorAvatarUrl: dep.creator?.avatar_url ?? "",
      status: latestStatus,
      createdAt: dep.created_at,
      updatedAt: dep.updated_at,
      sha: dep.sha,
      branch: dep.ref,
    })),
  ];

  // 6. Delete existing activity docs and write new ones in a batch
  const activityRef = appRef.collection("activity");
  const existingDocs = await activityRef.listDocuments();

  const batch = db.batch();

  for (const docRef of existingDocs) {
    batch.delete(docRef);
  }

  for (const activity of activities) {
    const newRef = activityRef.doc();
    batch.set(newRef, {
      ...activity,
      appId,
      repoFullName,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  logger.info("syncAppActivity complete", {
    appId,
    repoFullName,
    activityCount: activities.length,
  });
}
