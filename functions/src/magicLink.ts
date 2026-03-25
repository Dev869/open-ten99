import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const db = admin.firestore();

/**
 * Generates a magic link token for a client to access a specific work item
 * in the portal. The token is stored in Firestore with an expiry.
 */
export const generateMagicLink = onCall(
  { cors: true, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { clientId, email, workItemId } = request.data as {
      clientId: string;
      email: string;
      workItemId: string;
    };

    if (!clientId || !email || !workItemId) {
      throw new HttpsError("invalid-argument", "clientId, email, and workItemId are required.");
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store the magic link in Firestore
    await db.collection("magicLinks").doc(token).set({
      clientId,
      email: email.toLowerCase(),
      workItemId,
      ownerId: request.auth.uid,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });

    return { token };
  }
);

/**
 * Verifies a magic link token and returns portal access data.
 * Does not require Firebase Auth — the portal uses the token itself for access.
 */
export const verifyMagicLink = onCall(
  { cors: true, maxInstances: 10 },
  async (request) => {
    const { token } = request.data as { token: string };

    if (!token) {
      throw new HttpsError("invalid-argument", "Token is required.");
    }

    const docRef = db.collection("magicLinks").doc(token);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new HttpsError("not-found", "Invalid or expired link.");
    }

    const data = doc.data()!;

    // Check expiry
    const expiresAt = data.expiresAt.toDate();
    if (new Date() > expiresAt) {
      throw new HttpsError("deadline-exceeded", "This link has expired.");
    }

    // Fetch the work item data so the portal doesn't need direct Firestore access
    const workItemSnap = await db.doc(`workItems/${data.workItemId}`).get();
    const workItemData = workItemSnap.exists ? workItemSnap.data() : null;

    // Fetch client data if available
    let clientData = null;
    if (data.clientId && data.clientId !== 'unassigned') {
      const clientSnap = await db.doc(`clients/${data.clientId}`).get();
      clientData = clientSnap.exists ? clientSnap.data() : null;
    }

    return {
      clientId: data.clientId,
      workItemId: data.workItemId,
      email: data.email,
      workItem: workItemData ? {
        id: data.workItemId,
        subject: workItemData.subject,
        type: workItemData.type,
        status: workItemData.status,
        lineItems: workItemData.lineItems,
        totalHours: workItemData.totalHours,
        totalCost: workItemData.totalCost,
        isBillable: workItemData.isBillable,
        clientApproval: workItemData.clientApproval,
        clientNotes: workItemData.clientNotes,
        deductFromRetainer: workItemData.deductFromRetainer,
      } : null,
      client: clientData ? {
        name: clientData.name,
        email: clientData.email,
        company: clientData.company,
      } : null,
    };
  }
);
