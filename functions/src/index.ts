import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK once at the top level.
// This runs when the Cloud Functions instance cold-starts.
admin.initializeApp();

// Re-export all Cloud Functions so the Firebase CLI discovers them.
export { onEmailReceived } from "./parseEmail";
export { generatePDF } from "./generatePdf";
export { onGenerateReport } from "./generateReport";
export {
  getGitHubAuthUrl,
  handleGitHubCallback,
  disconnectGitHub,
  importGitHubRepos,
  linkRepoToApp,
  triggerGitHubSync,
} from "./github";
export { syncGitHub } from "./syncGitHub";
export { onGitHubWebhook } from "./onGitHubWebhook";
export { onPlaidLinkToken, onPlaidExchange, onPlaidSync, onPlaidWebhook } from "./plaid";
export { onStripeConnect, onStripeSync, onStripeWebhook } from "./stripe";
export { onManualSync, onDeleteConnectedAccount, onPlaidUpdateLinkToken } from "./manualSync";
export { onTransactionCreated } from './matchTransaction';
export { onSmartCategorize } from './smartCategorize';
export { sendCompletionEmail } from './sendCompletionEmail';
export { onReceiptUploaded } from './processReceipt';
export { onReceiptMatchOnTransaction } from './receiptMatchOnTransaction';
export { purgeDiscarded } from './purgeDiscarded';
export { onGenerateInsights } from './generateInsights';
export { onAnalyzeReport } from './analyzeReport';
export { generateMagicLink, verifyMagicLink } from './magicLink';
export { onSavePostmarkSecret } from "./postmarkSecret";
export { generateRetainerInvoices, generateRetainerInvoiceManual } from './generateRetainerInvoices';
