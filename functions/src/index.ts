import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK once at the top level.
// This runs when the Cloud Functions instance cold-starts.
admin.initializeApp();

// Re-export all Cloud Functions so the Firebase CLI discovers them.
export { onEmailReceived } from "./parseEmail";
export { generatePDF } from "./generatePdf";
export { onGenerateReport } from "./generateReport";
export { getGitHubAuthUrl, handleGitHubCallback, disconnectGitHub } from "./github";
