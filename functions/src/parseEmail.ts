import { onRequest } from "firebase-functions/v2/https";
import { defineString, defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { getGeminiClient } from "./utils/geminiClient";

const webhookSecret = defineString("POSTMARK_WEBHOOK_SECRET");
const encryptionKey = defineSecret("POSTMARK_ENCRYPTION_KEY");

interface PostmarkInboundPayload {
  From: string;
  FromName: string;
  FromFull: { Email: string; Name: string };
  To: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  Date: string;
  MessageID: string;
  [key: string]: unknown;
}

interface ParsedLineItem {
  description: string;
  hours: number;
  cost: number;
}

interface GeminiParseResult {
  items: Array<{ description: string; hours: number }>;
}

/**
 * Decrypts a Postmark webhook secret stored as AES-256-GCM ciphertext.
 * The ciphertext includes the 16-byte auth tag appended.
 */
function decryptSecret(ciphertextHex: string, ivHex: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const raw = Buffer.from(ciphertextHex, "hex");
  // Last 16 bytes are the GCM auth tag
  const authTag = raw.subarray(raw.length - 16);
  const encrypted = raw.subarray(0, raw.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * HTTP function that receives Postmark inbound email webhooks.
 *
 * Flow:
 * 1. Validate webhook secret
 * 2. Extract sender, subject, body
 * 3. Look up or create client in Firestore
 * 4. Call Gemini to extract change items and hour estimates
 * 5. Calculate costs using the user's hourly rate
 * 6. Create a workItems doc in Firestore
 */
export const onEmailReceived = onRequest(
  { maxInstances: 10, timeoutSeconds: 120, secrets: [encryptionKey] },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // --- Resolve contractor first (needed for Firestore secret lookup) ---
    let contractorUid: string | null;
    try {
      contractorUid = await resolveContractorUid();
    } catch (err) {
      logger.error("Failed to resolve contractor uid", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).send("Service Unavailable");
      return;
    }
    if (!contractorUid) {
      logger.warn(
        "Could not resolve a single contractor uid — skipping email processing"
      );
      res.status(200).send("OK");
      return;
    }

    // --- Validate webhook secret ---
    const providedSecret = req.headers["x-postmark-secret"];
    if (typeof providedSecret !== "string" || providedSecret.length === 0) {
      logger.warn("Missing webhook secret header");
      res.status(401).send("Unauthorized");
      return;
    }

    let expectedSecret: string | null = null;

    // Try Firestore first
    try {
      const integrationSnap = await admin
        .firestore()
        .doc(`integrations/${contractorUid}`)
        .get();
      const pmWebhook = integrationSnap.data()?.postmarkWebhook;

      if (pmWebhook?.ciphertext && pmWebhook?.iv) {
        const keyHex = encryptionKey.value();
        if (!keyHex || keyHex.length !== 64) {
          logger.error("POSTMARK_ENCRYPTION_KEY not configured or invalid");
          res.status(503).send("Service Unavailable");
          return;
        }
        try {
          expectedSecret = decryptSecret(pmWebhook.ciphertext, pmWebhook.iv, keyHex);
        } catch (decryptErr) {
          logger.error("Failed to decrypt Postmark webhook secret", {
            error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr),
          });
          res.status(503).send("Service Unavailable");
          return;
        }
      } else {
        // Field absent — fall back to env var
        const envSecret = webhookSecret.value();
        if (envSecret && envSecret.length > 0) {
          expectedSecret = envSecret;
        }
      }
    } catch (firestoreErr) {
      logger.error("Failed to read integration doc", {
        error: firestoreErr instanceof Error ? firestoreErr.message : String(firestoreErr),
      });
      res.status(503).send("Service Unavailable");
      return;
    }

    if (!expectedSecret) {
      logger.warn("No webhook secret configured (Firestore or env)");
      res.status(401).send("Unauthorized");
      return;
    }

    // Timing-safe comparison with padding to prevent length leakage
    const provided = Buffer.from(providedSecret);
    const expected = Buffer.from(expectedSecret);
    const safeLen = Math.max(provided.length, expected.length);
    const paddedProvided = Buffer.alloc(safeLen);
    const paddedExpected = Buffer.alloc(safeLen);
    provided.copy(paddedProvided);
    expected.copy(paddedExpected);
    const secretValid =
      crypto.timingSafeEqual(paddedProvided, paddedExpected) &&
      provided.length === expected.length;

    if (!secretValid) {
      logger.warn("Invalid webhook secret received");
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const payload = req.body as PostmarkInboundPayload;
      const senderEmail = payload.FromFull?.Email || payload.From;
      const senderName = payload.FromFull?.Name || payload.FromName || "";
      const subject = payload.Subject || "(No Subject)";
      const textBody = payload.TextBody || "";
      const messageId = payload.MessageID || "";

      if (!senderEmail) {
        logger.error("No sender email found in payload");
        res.status(400).send("Missing sender email");
        return;
      }

      logger.info("Processing inbound email", {
        from: senderEmail,
        subject,
      });

      const db = admin.firestore();

      // --- Step 0.5: Dedup — skip if we already processed this email ---
      if (messageId) {
        const existing = await db
          .collection("workItems")
          .where("postmarkMessageId", "==", messageId)
          .limit(1)
          .get();
        if (!existing.empty) {
          logger.info("Duplicate email skipped — work item already exists", {
            messageId,
            existingWorkItemId: existing.docs[0].id,
          });
          res.status(200).json({ success: true, duplicate: true });
          return;
        }
      }

      // --- Step 1: Look up or create client ---
      const clientId = await findOrCreateClient(
        db,
        senderEmail,
        senderName,
        contractorUid
      );

      // --- Step 2: Get user settings for hourly rate (scoped to contractor) ---
      const settingsSnap = await db.doc(`settings/${contractorUid}`).get();
      let hourlyRate = 150;
      if (settingsSnap.exists) {
        hourlyRate = settingsSnap.data()?.hourlyRate ?? hourlyRate;
      }

      // --- Step 3: Call Gemini to extract change items ---
      const parseResult = await extractChangeItems(subject, textBody);

      // --- Step 4: Calculate costs ---
      const lineItems: ParsedLineItem[] = parseResult.items.map((item) => ({
        description: item.description,
        hours: item.hours,
        cost: parseFloat((item.hours * hourlyRate).toFixed(2)),
      }));

      const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);
      const totalCost = parseFloat((totalHours * hourlyRate).toFixed(2));

      // --- Step 5: Create workItem doc ---
      const now = admin.firestore.FieldValue.serverTimestamp();
      const workItemRef = await db.collection("workItems").add({
        type: "changeRequest",
        status: "draft",
        ownerId: contractorUid,
        clientId,
        sourceEmail: textBody.slice(0, 10_000), // truncate to prevent oversized docs
        subject,
        lineItems,
        totalHours,
        totalCost,
        isBillable: true,
        ...(messageId ? { postmarkMessageId: messageId } : {}),
        createdAt: now,
        updatedAt: now,
      });

      logger.info("Work item created", {
        workItemId: workItemRef.id,
        clientId,
        totalHours,
        totalCost,
        itemCount: lineItems.length,
      });

      res.status(200).json({
        success: true,
        workItemId: workItemRef.id,
        clientId,
        lineItems: lineItems.length,
        totalHours,
        totalCost,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      logger.error("Failed to process inbound email", { message: errMsg, stack: errStack });
      res.status(500).send("Internal Server Error");
    }
  }
);

/**
 * Finds the single contractor uid by listing Firebase Auth users whose
 * sign-in provider is google.com. Returns the uid when exactly one such user
 * exists, otherwise returns null.
 */
async function resolveContractorUid(): Promise<string | null> {
  const listResult = await admin.auth().listUsers(1000);
  const contractors = listResult.users.filter((user) =>
    user.providerData.some((p) => p.providerId === "google.com")
  );
  if (contractors.length === 1) {
    return contractors[0].uid;
  }
  if (contractors.length === 0) {
    logger.warn("resolveContractorUid: no google.com users found");
  } else {
    logger.warn("resolveContractorUid: multiple google.com users found", {
      count: contractors.length,
    });
  }
  return null;
}

/**
 * Looks up a client by email scoped to the contractor. If none exists,
 * creates a draft client doc with ownerId set.
 */
async function findOrCreateClient(
  db: admin.firestore.Firestore,
  email: string,
  name: string,
  ownerId: string
): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const clientsSnap = await db
    .collection("clients")
    .where("ownerId", "==", ownerId)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (!clientsSnap.empty) {
    return clientsSnap.docs[0].id;
  }

  // Create a draft client
  const newClient = await db.collection("clients").add({
    name: name || normalizedEmail.split("@")[0],
    email: normalizedEmail,
    ownerId,
    notes: "Auto-created from inbound email",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info("Created draft client", {
    clientId: newClient.id,
    email: normalizedEmail,
  });

  return newClient.id;
}

/**
 * Calls Gemini to extract discrete change items and hour estimates
 * from an email subject and body.
 */
async function extractChangeItems(
  subject: string,
  body: string
): Promise<GeminiParseResult> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = `You are an assistant that extracts change order items from client emails sent to a contractor.

Given the following email, extract each distinct change or task being requested. For each item, provide:
- A clear, concise description of the change
- An estimated number of hours to complete (be realistic for a skilled contractor)

Respond ONLY with valid JSON in this exact format:
{
  "items": [
    { "description": "Description of the change", "hours": 2.0 }
  ]
}

If the email does not contain any clear change requests, return:
{ "items": [{ "description": "General inquiry - review and respond to client", "hours": 0.5 }] }

---
Subject: ${subject}

Body:
${body}
---`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    logger.info("Gemini raw response", { text });

    const parsed = JSON.parse(text) as GeminiParseResult;

    // Validate structure
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error("Parsed result has no items array");
    }

    // Sanitize: ensure every item has required fields with valid types
    parsed.items = parsed.items.map((item) => ({
      description:
        typeof item.description === "string"
          ? item.description
          : "Unspecified change",
      hours:
        typeof item.hours === "number" && item.hours > 0
          ? parseFloat(item.hours.toFixed(2))
          : 1.0,
    }));

    logger.info("Parsed line items", { count: parsed.items.length, items: parsed.items });

    return parsed;
  } catch (parseError: unknown) {
    const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
    logger.error("Failed to parse Gemini response", { message: errMsg });
    return {
      items: [
        {
          description: "Review client email and respond",
          hours: 0.5,
        },
      ],
    };
  }
}
