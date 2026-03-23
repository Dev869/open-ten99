import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { encryptToken } from "./utils/crypto";

const encryptionKey = defineSecret("TOKEN_ENCRYPTION_KEY");

// Printable ASCII: space (0x20) through tilde (0x7E)
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

export const onSavePostmarkSecret = onCall(
  { secrets: [encryptionKey] },
  async (request) => {
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

    const secret = request.data?.secret;

    // Step 0: Disconnect — empty string clears the field
    if (secret === "") {
      await admin
        .firestore()
        .doc(`integrations/${uid}`)
        .set(
          { postmarkWebhook: admin.firestore.FieldValue.delete() },
          { merge: true }
        );
      return { success: true, cleared: true };
    }

    // Validate secret
    if (typeof secret !== "string") {
      throw new HttpsError("invalid-argument", "Secret must be a string");
    }
    if (secret.length < 1 || secret.length > 256) {
      throw new HttpsError(
        "invalid-argument",
        "Secret must be 1-256 characters"
      );
    }
    if (!PRINTABLE_ASCII.test(secret)) {
      throw new HttpsError(
        "invalid-argument",
        "Secret must contain only printable ASCII characters"
      );
    }

    // Encrypt using shared TOKEN_ENCRYPTION_KEY (same key used by Stripe/Plaid/GitHub)
    const encrypted = encryptToken(secret, encryptionKey.value());

    // Store encrypted secret
    await admin
      .firestore()
      .doc(`integrations/${uid}`)
      .set(
        {
          postmarkWebhook: {
            encryptedSecret: encrypted,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    return { success: true };
  }
);
