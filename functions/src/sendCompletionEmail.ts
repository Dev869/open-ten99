import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sgMail = require("@sendgrid/mail");
import * as logger from "firebase-functions/logger";

const sendgridApiKey = defineSecret("SENDGRID_API_KEY");

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
  { secrets: [sendgridApiKey] },
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

    sgMail.setApiKey(sendgridApiKey.value());

    const ccList = Array.isArray(data.cc) ? data.cc : [];
    const cc = ccList.filter((addr) => typeof addr === "string" && addr && addr !== data.to);

    try {
      await sgMail.send({
        to: {
          email: data.to,
          name: data.toName || undefined,
        },
        cc: cc.length > 0 ? cc : undefined,
        from: {
          email: data.fromEmail || "noreply@example.com",
          name: data.fromName || "Open TEN99",
        },
        subject: data.subject,
        html: data.html,
        attachments: data.pdfBase64
          ? [
              {
                content: data.pdfBase64,
                filename: data.pdfFilename || "invoice.pdf",
                type: "application/pdf",
                disposition: "attachment",
              },
            ]
          : undefined,
      });

      logger.info("Email sent", {
        to: data.to,
        cc: cc.length,
        subject: data.subject,
        hasAttachment: Boolean(data.pdfBase64),
      });
      return { success: true };
    } catch (err) {
      // SendGrid puts the actionable detail (e.g. unverified sender) in
      // response.body.errors — log only the structured error array to avoid
      // persisting recipient PII; client gets a generic message.
      const sgErrors = (err as { response?: { body?: { errors?: unknown } } })
        ?.response?.body?.errors;
      logger.error("SendGrid error", {
        message: (err as Error)?.message,
        errors: sgErrors,
      });
      throw new HttpsError("internal", "Failed to send email.");
    }
  }
);
