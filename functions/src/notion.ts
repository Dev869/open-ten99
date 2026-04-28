import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString, defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { encryptToken, decryptToken } from "./utils/crypto";

const NOTION_CLIENT_ID = defineString("NOTION_CLIENT_ID");
const NOTION_CLIENT_SECRET = defineString("NOTION_CLIENT_SECRET");
const NOTION_REDIRECT_URI = defineString("NOTION_REDIRECT_URI");
const encryptionKey = defineSecret("TOKEN_ENCRYPTION_KEY");

const STATE_TTL_MS = 10 * 60 * 1000;
const NOTION_VERSION = "2022-06-28";

interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  workspace_id: string;
  owner?: unknown;
  duplicated_template_id?: string | null;
  error?: string;
  error_description?: string;
}

interface NotionPage {
  id: string;
  object: "page" | "database";
  url: string;
  archived?: boolean;
  in_trash?: boolean;
  icon?: { type: string; emoji?: string; external?: { url: string }; file?: { url: string } } | null;
  properties?: Record<string, unknown>;
  parent?: { type: string };
}

/** Resolve a Notion page's display title from its properties. */
function pageTitle(page: NotionPage): string {
  const props = page.properties ?? {};
  for (const value of Object.values(props)) {
    const v = value as { type?: string; title?: Array<{ plain_text?: string }> };
    if (v?.type === "title" && Array.isArray(v.title) && v.title.length > 0) {
      return v.title.map((t) => t.plain_text ?? "").join("").trim() || "Untitled";
    }
  }
  return "Untitled";
}

function pageIcon(page: NotionPage): string | null {
  const icon = page.icon;
  if (!icon) return null;
  if (icon.type === "emoji" && icon.emoji) return icon.emoji;
  if (icon.type === "external" && icon.external?.url) return icon.external.url;
  if (icon.type === "file" && icon.file?.url) return icon.file.url;
  return null;
}

/**
 * Generates a Notion OAuth authorization URL with a one-time CSRF state token.
 */
export const getNotionAuthUrl = onCall(
  { cors: true, invoker: "public", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to connect Notion.");
    }
    const uid = request.auth.uid;
    const db = admin.firestore();

    try {
      const state = crypto.randomBytes(32).toString("hex");
      await db
        .collection("_secrets")
        .doc(uid)
        .collection("oauthState")
        .doc("notion")
        .set({
          state,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      const params = new URLSearchParams({
        client_id: NOTION_CLIENT_ID.value(),
        response_type: "code",
        owner: "user",
        redirect_uri: NOTION_REDIRECT_URI.value(),
        state,
      });

      const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
      logger.info("Notion auth URL generated", { uid });
      return { authUrl };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Failed to generate Notion auth URL", { error, uid });
      throw new HttpsError("internal", "Failed to start Notion authorization.");
    }
  }
);

/**
 * Exchanges the OAuth code for an access token, persists it encrypted, and
 * stores workspace metadata for display.
 */
export const handleNotionCallback = onCall(
  { cors: true, invoker: "public", maxInstances: 10, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to complete Notion authorization.");
    }
    const uid = request.auth.uid;
    const { code, state } = (request.data ?? {}) as { code?: string; state?: string };

    if (!code || typeof code !== "string") {
      throw new HttpsError("invalid-argument", "Authorization code is required.");
    }
    if (!state || typeof state !== "string") {
      throw new HttpsError("invalid-argument", "State token is required.");
    }

    const db = admin.firestore();

    try {
      const stateRef = db
        .collection("_secrets")
        .doc(uid)
        .collection("oauthState")
        .doc("notion");
      const stateSnap = await stateRef.get();

      if (!stateSnap.exists) {
        throw new HttpsError("not-found", "OAuth state not found. Restart the connection flow.");
      }
      const stateData = stateSnap.data()!;
      if (stateData.state !== state) {
        throw new HttpsError("permission-denied", "Invalid OAuth state. Restart the connection flow.");
      }
      const createdAt: admin.firestore.Timestamp = stateData.createdAt;
      if (Date.now() - createdAt.toMillis() > STATE_TTL_MS) {
        throw new HttpsError("deadline-exceeded", "OAuth state expired. Restart the connection flow.");
      }
      await stateRef.delete();

      const basic = Buffer.from(
        `${NOTION_CLIENT_ID.value()}:${NOTION_CLIENT_SECRET.value()}`
      ).toString("base64");

      const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Basic ${basic}`,
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: NOTION_REDIRECT_URI.value(),
        }),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        logger.error("Notion token exchange failed", { status: tokenRes.status, body: text, uid });
        throw new HttpsError("internal", "Failed to exchange Notion authorization code.");
      }

      const tokenData = (await tokenRes.json()) as NotionTokenResponse;
      if (tokenData.error || !tokenData.access_token) {
        logger.error("Notion token exchange returned error", {
          error: tokenData.error,
          description: tokenData.error_description,
          uid,
        });
        throw new HttpsError(
          "permission-denied",
          tokenData.error_description ?? "Notion authorization was denied."
        );
      }

      const encryptedAccessToken = encryptToken(tokenData.access_token, encryptionKey.value());

      await db
        .collection("_secrets")
        .doc(uid)
        .collection("notion")
        .doc("connection")
        .set({
          accessToken: encryptedAccessToken,
          tokenType: tokenData.token_type ?? "bearer",
          botId: tokenData.bot_id,
          workspaceId: tokenData.workspace_id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      await db
        .collection("integrations")
        .doc(uid)
        .collection("notion")
        .doc("connection")
        .set(
          {
            connected: true,
            workspaceId: tokenData.workspace_id,
            workspaceName: tokenData.workspace_name,
            workspaceIcon: tokenData.workspace_icon,
            botId: tokenData.bot_id,
            connectedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      await db.collection("integrations").doc(uid).set(
        {
          notionConnected: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("Notion workspace connected", {
        uid,
        workspaceId: tokenData.workspace_id,
        workspaceName: tokenData.workspace_name,
      });

      return {
        success: true,
        workspaceId: tokenData.workspace_id,
        workspaceName: tokenData.workspace_name,
        workspaceIcon: tokenData.workspace_icon,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Notion callback failed", { error, uid });
      throw new HttpsError("internal", "Failed to complete Notion authorization.");
    }
  }
);

async function getNotionAccessToken(uid: string, hexKey: string): Promise<string> {
  const db = admin.firestore();
  const snap = await db
    .collection("_secrets")
    .doc(uid)
    .collection("notion")
    .doc("connection")
    .get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "Notion is not connected.");
  }
  const encrypted = snap.data()?.accessToken as string | undefined;
  if (!encrypted) {
    throw new HttpsError("failed-precondition", "Notion access token missing.");
  }
  return decryptToken(encrypted, hexKey);
}

/**
 * Searches the connected Notion workspace for pages matching a query.
 * Returns lightweight metadata suitable for a picker UI.
 */
export const searchNotionPages = onCall(
  { cors: true, invoker: "public", maxInstances: 10, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const { query, pageSize } = (request.data ?? {}) as { query?: string; pageSize?: number };

    try {
      const token = await getNotionAccessToken(uid, encryptionKey.value());
      const res = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: typeof query === "string" ? query : "",
          filter: { property: "object", value: "page" },
          sort: { direction: "descending", timestamp: "last_edited_time" },
          page_size: Math.min(Math.max(pageSize ?? 20, 1), 50),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error("Notion search failed", { status: res.status, body: text, uid });
        if (res.status === 401) {
          throw new HttpsError(
            "unauthenticated",
            "Notion access token rejected. Please reconnect."
          );
        }
        throw new HttpsError("internal", "Notion search failed.");
      }

      const data = (await res.json()) as { results?: NotionPage[] };
      const pages = (data.results ?? [])
        .filter((p) => !p.archived && !p.in_trash)
        .map((p) => ({
          id: p.id,
          url: p.url,
          title: pageTitle(p),
          icon: pageIcon(p),
        }));

      return { pages };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Notion search error", { error, uid });
      throw new HttpsError("internal", "Failed to search Notion pages.");
    }
  }
);

/**
 * Disconnects Notion: clears stored token + integration metadata.
 */
export const disconnectNotion = onCall(
  { cors: true, invoker: "public", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const db = admin.firestore();

    try {
      await db
        .collection("_secrets")
        .doc(uid)
        .collection("notion")
        .doc("connection")
        .delete();
      await db
        .collection("integrations")
        .doc(uid)
        .collection("notion")
        .doc("connection")
        .delete();
      await db.collection("integrations").doc(uid).set(
        {
          notionConnected: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      logger.info("Notion disconnected", { uid });
      return { success: true };
    } catch (error) {
      logger.error("Notion disconnect failed", { error, uid });
      throw new HttpsError("internal", "Failed to disconnect Notion.");
    }
  }
);
