import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { getGeminiClient } from "./utils/geminiClient";

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
 * HTTP function that receives Postmark inbound email webhooks.
 *
 * Flow:
 * 1. Validate webhook secret
 * 2. Extract sender, subject, body
 * 3. Look up existing client in Firestore (unassigned if no match)
 * 4. Call Gemini to extract change items and hour estimates
 * 5. Calculate costs using the user's hourly rate
 * 6. Create a work order doc in Firestore
 */
export const onEmailReceived = onRequest(
  { maxInstances: 10, timeoutSeconds: 120, invoker: "public" },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // --- Authenticate via URL token and resolve contractor in one query ---
    const providedToken = req.query.token;
    if (typeof providedToken !== "string" || providedToken.length === 0) {
      logger.warn("Missing webhook token query parameter");
      res.status(401).send("Unauthorized");
      return;
    }

    let contractorUid: string | null = null;
    try {
      const integrationsSnap = await admin
        .firestore()
        .collection("integrations")
        .get();

      for (const doc of integrationsSnap.docs) {
        const data = doc.data();
        const storedToken = data?.postmarkWebhook?.token;
        logger.info("Token comparison", {
          docId: doc.id,
          hasPostmarkWebhook: !!data?.postmarkWebhook,
          storedTokenPrefix: typeof storedToken === "string" ? storedToken.substring(0, 8) : "none",
          providedTokenPrefix: providedToken.substring(0, 8),
          match: storedToken === providedToken,
        });
        if (typeof storedToken === "string" && storedToken === providedToken) {
          contractorUid = doc.id;
          break;
        }
      }

      if (!contractorUid) {
        logger.warn("No matching webhook token found", {
          docsChecked: integrationsSnap.size,
        });
        res.status(401).send("Unauthorized");
        return;
      }
    } catch (firestoreErr) {
      logger.error("Failed to look up webhook token", {
        error: firestoreErr instanceof Error ? firestoreErr.message : String(firestoreErr),
      });
      res.status(503).send("Service Unavailable");
      return;
    }

    try {
      const payload = req.body as PostmarkInboundPayload;
      const senderEmail = payload.FromFull?.Email || payload.From;
      const senderName = payload.FromFull?.Name || payload.FromName || "";
      const subject = payload.Subject || "(No Subject)";
      const textBody = payload.TextBody || "";
      const htmlBody = payload.HtmlBody || "";
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
          logger.info("Duplicate email skipped — work order already exists", {
            messageId,
            existingWorkItemId: existing.docs[0].id,
          });
          res.status(200).json({ success: true, duplicate: true });
          return;
        }
      }

      // --- Step 1: Look up client by email (never auto-create) ---
      const clientId = await findClientByEmail(db, senderEmail, contractorUid);
      if (!clientId) {
        logger.info("No matching client found for sender — work order will be unassigned", {
          senderEmail,
        });
      }

      // --- Step 2: Get user settings for hourly rate (scoped to contractor) ---
      const settingsSnap = await db.doc(`settings/${contractorUid}`).get();
      let hourlyRate = 150;
      if (settingsSnap.exists) {
        hourlyRate = settingsSnap.data()?.hourlyRate ?? hourlyRate;
      }

      // --- Step 3: Call Gemini to extract change items ---
      // Use the richer content source: if textBody is very short (common in forwards),
      // fall back to htmlBody which contains the forwarded message
      const emailContent = textBody.length > 100 ? textBody : (htmlBody || textBody);
      const parseResult = await extractChangeItems(subject, emailContent);

      // --- Step 4: Calculate costs ---
      const lineItems: ParsedLineItem[] = parseResult.items.map((item) => ({
        description: item.description,
        hours: item.hours,
        cost: parseFloat((item.hours * hourlyRate).toFixed(2)),
      }));

      const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);
      const totalCost = parseFloat((totalHours * hourlyRate).toFixed(2));

      // --- Step 5: Create work order doc ---
      const now = admin.firestore.FieldValue.serverTimestamp();
      const workItemRef = await db.collection("workItems").add({
        type: "changeRequest",
        status: "draft",
        ownerId: contractorUid,
        ...(clientId ? { clientId } : {}),
        senderEmail,
        senderName,
        sourceEmail: textBody.slice(0, 10_000),
        sourceHtml: htmlBody.slice(0, 50_000),
        subject,
        lineItems,
        totalHours,
        totalCost,
        isBillable: true,
        ...(messageId ? { postmarkMessageId: messageId } : {}),
        createdAt: now,
        updatedAt: now,
      });

      logger.info("Work order created", {
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
 * Looks up a client by email scoped to the contractor.
 * Returns the client ID if found, or null if no match exists.
 * Never creates new clients automatically.
 */
async function findClientByEmail(
  db: admin.firestore.Firestore,
  email: string,
  ownerId: string
): Promise<string | null> {
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

  return null;
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
