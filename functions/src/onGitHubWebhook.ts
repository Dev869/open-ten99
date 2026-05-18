import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

const githubWebhookSecret = defineSecret("GITHUB_WEBHOOK_SECRET");

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Payload type interfaces
// ---------------------------------------------------------------------------

interface PushPayload {
  ref: string;
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
    author: { username?: string; name: string };
  } | null;
  repository: { full_name: string };
}

interface PullRequestPayload {
  pull_request: {
    number: number;
    title: string;
    state: string;
    merged_at: string | null;
    created_at: string;
    updated_at: string;
    user: { login: string };
  };
  repository: { full_name: string };
}

interface IssuesPayload {
  issue: {
    number: number;
    title: string;
    state: string;
    created_at: string;
    updated_at: string;
    user: { login: string };
    pull_request?: unknown;
  };
  repository: { full_name: string };
}

interface DeploymentStatusPayload {
  deployment_status: {
    state: string;
    created_at: string;
    updated_at: string;
    creator: { login: string } | null;
  };
  deployment: {
    id: number;
    environment: string;
  };
  repository: { full_name: string };
}

type ActivityDoc = {
  type: string;
  title: string;
  author: string;
  status: string;
  createdAt: string;
  updatedAt: admin.firestore.FieldValue;
  // Optional fields per event type
  sha?: string;
  branch?: string;
  number?: number;
  environment?: string;
};

// ---------------------------------------------------------------------------
// Event builder helpers
// ---------------------------------------------------------------------------

function buildPushActivity(body: PushPayload): ActivityDoc | null {
  const commit = body.head_commit;
  if (!commit) return null;

  const branch = body.ref.replace(/^refs\/heads\//, "");
  const message = commit.message.split("\n")[0];
  const sha = commit.id.substring(0, 7);
  const author = commit.author.username ?? commit.author.name;

  return {
    type: "commit",
    title: message,
    author,
    status: "merged",
    sha,
    branch,
    createdAt: commit.timestamp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildPullRequestActivity(body: PullRequestPayload): ActivityDoc {
  const pr = body.pull_request;
  const status = pr.merged_at ? "merged" : pr.state;

  return {
    type: "pull_request",
    title: pr.title,
    number: pr.number,
    author: pr.user.login,
    status,
    createdAt: pr.created_at,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildIssueActivity(body: IssuesPayload): ActivityDoc | null {
  const issue = body.issue;

  // Skip if this is actually a pull request
  if (issue.pull_request) return null;

  return {
    type: "issue",
    title: issue.title,
    number: issue.number,
    author: issue.user.login,
    status: issue.state,
    createdAt: issue.created_at,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function mapDeploymentState(state: string): string {
  if (state === "success") return "success";
  if (state === "failure" || state === "error") return "failure";
  if (
    state === "in_progress" ||
    state === "queued" ||
    state === "pending"
  ) {
    return "pending";
  }
  if (state === "inactive") return "inactive";
  return state;
}

function buildDeploymentStatusActivity(
  body: DeploymentStatusPayload
): ActivityDoc {
  const ds = body.deployment_status;
  const environment = body.deployment.environment;
  const creator = ds.creator?.login ?? "";

  return {
    type: "deployment",
    title: `Deploy to ${environment}`,
    environment,
    author: creator,
    status: mapDeploymentState(ds.state),
    createdAt: ds.created_at,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

// ---------------------------------------------------------------------------
// Idempotency: deterministic document ids
// ---------------------------------------------------------------------------

/**
 * Derives a deterministic, idempotent Firestore document id from the event
 * payload. GitHub delivers webhooks at-least-once, so re-deliveries of the
 * same logical event must resolve to the same document id and become a no-op
 * batch.set overwrite rather than creating duplicate activity docs.
 *
 * Returns null when no stable identifier can be derived (caller falls back to
 * an auto-generated id, preserving prior behavior for unexpected payloads).
 */
function deterministicActivityId(
  event: string,
  body: unknown
): string | null {
  switch (event) {
    case "push": {
      const sha = (body as PushPayload).head_commit?.id;
      return sha ? `commit-${sha}` : null;
    }
    case "pull_request": {
      const num = (body as PullRequestPayload).pull_request?.number;
      return typeof num === "number" ? `pr-${num}` : null;
    }
    case "issues": {
      const num = (body as IssuesPayload).issue?.number;
      return typeof num === "number" ? `issue-${num}` : null;
    }
    case "deployment_status": {
      const ds = body as DeploymentStatusPayload;
      const id = ds.deployment?.id;
      const state = ds.deployment_status?.state;
      return typeof id === "number" && state
        ? `deployment-${id}-${state}`
        : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

/**
 * Receives GitHub webhook events and writes activity docs to Firestore
 * under apps/{appId}/github for every app whose githubRepo.fullName matches
 * the event's repository full_name.
 */
export const onGitHubWebhook = onRequest(
  { maxInstances: 10, timeoutSeconds: 60, secrets: [githubWebhookSecret] },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Validate HMAC signature using raw body buffer
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = req.rawBody as Buffer | undefined;

    if (!rawBody) {
      logger.warn("onGitHubWebhook: missing rawBody");
      res.status(400).send("Bad Request");
      return;
    }

    if (!verifySignature(rawBody, signature, githubWebhookSecret.value())) {
      logger.warn("onGitHubWebhook: invalid signature");
      res.status(401).send("Unauthorized");
      return;
    }

    const event = req.headers["x-github-event"] as string | undefined;
    if (!event) {
      logger.warn("onGitHubWebhook: missing X-GitHub-Event header");
      res.status(400).send("Bad Request");
      return;
    }

    // Extract repo full_name from payload
    const repoFullName: string | undefined =
      (req.body as { repository?: { full_name?: string } })?.repository
        ?.full_name;

    if (!repoFullName) {
      logger.warn("onGitHubWebhook: missing repository.full_name", { event });
      res.status(400).send("Bad Request");
      return;
    }

    logger.info("onGitHubWebhook received", { event, repoFullName });

    // Build activity doc based on event type
    let activity: ActivityDoc | null = null;

    try {
      switch (event) {
        case "push":
          activity = buildPushActivity(req.body as PushPayload);
          break;
        case "pull_request":
          activity = buildPullRequestActivity(req.body as PullRequestPayload);
          break;
        case "issues":
          activity = buildIssueActivity(req.body as IssuesPayload);
          break;
        case "deployment_status":
          activity = buildDeploymentStatusActivity(
            req.body as DeploymentStatusPayload
          );
          break;
        default:
          // Acknowledge unhandled events without writing anything
          logger.info("onGitHubWebhook: unhandled event type, ignoring", {
            event,
          });
          res.status(200).json({ received: true, handled: false });
          return;
      }
    } catch (buildError: unknown) {
      const msg =
        buildError instanceof Error ? buildError.message : String(buildError);
      logger.error("onGitHubWebhook: failed to build activity doc", {
        event,
        message: msg,
      });
      res.status(400).send("Bad Request");
      return;
    }

    // Null means the event was valid but intentionally skipped
    if (activity === null) {
      logger.info("onGitHubWebhook: event skipped (no activity to write)", {
        event,
        repoFullName,
      });
      res.status(200).json({ received: true, handled: false });
      return;
    }

    try {
      const db = admin.firestore();

      // Query all apps matching this repo
      const appsSnap = await db
        .collection("apps")
        .where("githubRepo.fullName", "==", repoFullName)
        .get();

      if (appsSnap.empty) {
        logger.info("onGitHubWebhook: no apps matched", { repoFullName });
        res.status(200).json({ received: true, matched: 0 });
        return;
      }

      // Derive a deterministic document id so GitHub's at-least-once
      // re-deliveries overwrite (idempotent no-op) instead of duplicating.
      const deterministicId = deterministicActivityId(event, req.body);

      // Write activity to each matching app's github subcollection
      const batch = db.batch();

      for (const appDoc of appsSnap.docs) {
        const githubCol = db
          .collection("apps")
          .doc(appDoc.id)
          .collection("github");
        const githubRef = deterministicId
          ? githubCol.doc(deterministicId)
          : githubCol.doc();

        batch.set(githubRef, {
          ...activity,
          appId: appDoc.id,
          repoFullName,
        });
      }

      await batch.commit();

      logger.info("onGitHubWebhook: activity written", {
        event,
        repoFullName,
        appCount: appsSnap.size,
      });

      res.status(200).json({
        received: true,
        handled: true,
        matched: appsSnap.size,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      logger.error("onGitHubWebhook: failed to write activity", {
        message: errMsg,
        stack: errStack,
      });
      res.status(500).send("Internal Server Error");
    }
  }
);
