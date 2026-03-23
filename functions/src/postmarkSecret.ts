import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const encryptionKey = defineSecret("POSTMARK_ENCRYPTION_KEY");

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
        "Secret must be 1–256 characters"
      );
    }
    if (!PRINTABLE_ASCII.test(secret)) {
      throw new HttpsError(
        "invalid-argument",
        "Secret must contain only printable ASCII characters"
      );
    }

    // Validate encryption key
    const keyHex = encryptionKey.value();
    if (!keyHex || keyHex.length !== 64) {
      throw new HttpsError(
        "internal",
        "Encryption not configured — set POSTMARK_ENCRYPTION_KEY in Cloud Functions secrets"
      );
    }

    // Encrypt with AES-256-GCM
    const key = Buffer.from(keyHex, "hex");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Store ciphertext + authTag + iv
    await admin
      .firestore()
      .doc(`integrations/${uid}`)
      .set(
        {
          postmarkWebhook: {
            ciphertext: Buffer.concat([encrypted, authTag]).toString("hex"),
            iv: iv.toString("hex"),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    return { success: true };
  }
);
