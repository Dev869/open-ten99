import { GoogleGenerativeAI } from "@google/generative-ai";
import { defineString } from "firebase-functions/params";

const geminiApiKey = defineString("GOOGLE_AI_API_KEY");

let genAIInstance: GoogleGenerativeAI | null = null;

/**
 * Returns a singleton GoogleGenerativeAI client configured from the environment.
 * Using a singleton avoids re-creating the client on every function
 * invocation within the same Cloud Functions instance.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const key = geminiApiKey.value();
    if (!key) {
      throw new Error(
        "GOOGLE_AI_API_KEY is not set. " +
        "Configure it with: firebase functions:secrets:set GOOGLE_AI_API_KEY"
      );
    }
    genAIInstance = new GoogleGenerativeAI(key);
  }
  return genAIInstance;
}
