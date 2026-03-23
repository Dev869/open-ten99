import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

export const onSavePostmarkSecret = onCall(async (request) => {
  // Verify authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }
  const uid = request.auth.uid;

  // Verify contractor (Google sign-in)
  const user = await admin.auth().getUser(uid);
  const isGoogle = user.providerData.some(
    (p) => p.providerId === "google.com"
  );
  if (!isGoogle) {
    throw new HttpsError("permission-denied", "Contractor access only");
  }

  const { disconnect } = request.data ?? {};

  // Disconnect — clear the webhook token
  if (disconnect === true) {
    await admin
      .firestore()
      .doc(`integrations/${uid}`)
      .set(
        { postmarkWebhook: admin.firestore.FieldValue.delete() },
        { merge: true }
      );
    return { success: true, cleared: true };
  }

  // Generate a random 32-byte token
  const token = crypto.randomBytes(32).toString("hex");

  // Store token
  await admin
    .firestore()
    .doc(`integrations/${uid}`)
    .set(
      {
        postmarkWebhook: {
          token,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

  return { success: true, token };
});
