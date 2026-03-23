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
      used: false,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });

    return { token };
  }
);

/**
 * Verifies a magic link token and returns a Firebase custom auth token
 * with the clientId as a custom claim.
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

    // Allow reuse within the 7-day window (don't enforce single-use)

    // Create or get a portal user for this client email
    const email = data.email;
    const clientId = data.clientId;

    let uid: string;
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      uid = existingUser.uid;
    } catch {
      // Create a new user for this portal client
      const newUser = await admin.auth().createUser({
        email,
        displayName: email.split("@")[0],
      });
      uid = newUser.uid;
    }

    // Set custom claims with clientId
    await admin.auth().setCustomUserClaims(uid, { clientId });

    // Generate a custom token
    const customToken = await admin.auth().createCustomToken(uid, { clientId });

    return {
      customToken,
      workItemId: data.workItemId,
    };
  }
);
