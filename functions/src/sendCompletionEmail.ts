import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

const brevoApiKey = defineSecret("BREVO_API_KEY");

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

interface SendEmailRequest {
  to: string;
  toName?: string;
  cc?: string[];
  subject: string;
  fromEmail: string;
  fromName: string;
  html: string;
  /** Base64-encoded PDF (no data: prefix) to attach, e.g. the invoice copy. */
  pdfBase64?: string;
  pdfFilename?: string;
}

export const sendCompletionEmail = onCall(
  { secrets: [brevoApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    // Only contractors (Google sign-in) may send mail from the verified
    // sender. Portal clients authenticate via custom token and must never
    // be able to call this.
    if (request.auth.token.firebase?.sign_in_provider !== "google.com") {
      throw new HttpsError("permission-denied", "Contractor access only.");
    }

    const data = request.data as SendEmailRequest;

    if (!data.to || !data.subject || !data.html) {
      throw new HttpsError("invalid-argument", "Missing required fields: to, subject, html.");
    }
    if (data.pdfBase64 !== undefined && typeof data.pdfBase64 !== "string") {
      throw new HttpsError("invalid-argument", "pdfBase64 must be a string.");
    }

    const ccList = Array.isArray(data.cc) ? data.cc : [];
    const cc = ccList
      .filter((addr) => typeof addr === "string" && addr && addr !== data.to)
      .map((email) => ({ email }));

    const payload: Record<string, unknown> = {
      sender: {
        email: data.fromEmail || "noreply@example.com",
        name: data.fromName || "Open TEN99",
      },
      to: [{ email: data.to, name: data.toName || undefined }],
      subject: data.subject,
      htmlContent: data.html,
    };
    if (cc.length > 0) {
      payload.cc = cc;
    }
    if (data.pdfBase64) {
      payload.attachment = [
        {
          content: data.pdfBase64,
          name: data.pdfFilename || "invoice.pdf",
        },
      ];
    }

    try {
      const res = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": brevoApiKey.value(),
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Brevo returns { code, message } — log the structured fields only
        // (no recipient PII) and surface a generic error to the client.
        let brevoError: unknown;
        try {
          brevoError = await res.json();
        } catch {
          brevoError = undefined;
        }
        logger.error("Brevo error", { status: res.status, body: brevoError });
        throw new HttpsError("internal", "Failed to send email.");
      }

      logger.info("Email sent", {
        to: data.to,
        cc: cc.length,
        subject: data.subject,
        hasAttachment: Boolean(data.pdfBase64),
      });
      return { success: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error("Brevo request failed", { message: (err as Error)?.message });
      throw new HttpsError("internal", "Failed to send email.");
    }
  }
);
