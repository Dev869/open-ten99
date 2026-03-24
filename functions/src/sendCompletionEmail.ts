import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sgMail = require("@sendgrid/mail");
import * as logger from "firebase-functions/logger";

const sendgridApiKey = defineSecret("SENDGRID_API_KEY");

interface SendEmailRequest {
  to: string;
  toName?: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  html: string;
}

export const sendCompletionEmail = onCall(
  { secrets: [sendgridApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const data = request.data as SendEmailRequest;

    if (!data.to || !data.subject || !data.html) {
      throw new HttpsError("invalid-argument", "Missing required fields: to, subject, html.");
    }

    sgMail.setApiKey(sendgridApiKey.value());

    try {
      await sgMail.send({
        to: {
          email: data.to,
          name: data.toName || undefined,
        },
        from: {
          email: data.fromEmail || "noreply@dwtailored.com",
          name: data.fromName || "DW Tailored Systems",
        },
        subject: data.subject,
        html: data.html,
      });

      logger.info("Email sent", { to: data.to, subject: data.subject });
      return { success: true };
    } catch (err) {
      logger.error("SendGrid error", err);
      throw new HttpsError("internal", "Failed to send email.");
    }
  }
);
