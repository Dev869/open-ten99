import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { analyzeExpenses } from './utils/insights/analyzeExpenses';
import { analyzeTaxDeductions } from './utils/insights/analyzeTaxDeductions';
import { forecastRevenue } from './utils/insights/forecastRevenue';
import { analyzePayments } from './utils/insights/analyzePayments';
import { scoreClients } from './utils/insights/scoreClients';
import { projectCashFlow } from './utils/insights/projectCashFlow';
import { analyzeProjects } from './utils/insights/analyzeProjects';

const db = getFirestore();

interface InsightData {
  transactions: FirebaseFirestore.DocumentData[];
  workItems: FirebaseFirestore.DocumentData[];
  clients: FirebaseFirestore.DocumentData[];
}

async function fetchUserData(uid: string): Promise<InsightData> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [transactionsSnap, workItemsSnap, clientsSnap] = await Promise.all([
    db.collection('transactions')
      .where('ownerId', '==', uid)
      .where('date', '>=', twelveMonthsAgo)
      .get(),
    db.collection('workItems')
      .where('ownerId', '==', uid)
      .get(),
    db.collection('clients')
      .where('ownerId', '==', uid)
      .get(),
  ]);

  return {
    transactions: transactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    workItems: workItemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    clients: clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export const onGenerateInsights = onCall(
  { cors: true, maxInstances: 10, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = request.auth.uid;
    const force = request.data?.force === true;

    const insightRef = db.collection('insights').doc(uid);
    const existing = await insightRef.get();

    if (existing.exists) {
      const data = existing.data();
      const generatedAt = data?.generatedAt?.toDate?.();
      const status = data?.status;

      // Concurrency guard: skip if already generating within last 5 minutes
      if (status === 'generating' && generatedAt) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (generatedAt > fiveMinAgo) {
          return { skipped: true, reason: 'already_generating' };
        }
      }

      // Staleness guard: skip if generated within last 24 hours (unless forced)
      if (!force && generatedAt) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (generatedAt > twentyFourHoursAgo) {
          return { skipped: true, reason: 'fresh' };
        }
      }
    }

    // Mark as generating
    await insightRef.set(
      { status: 'generating', generatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    try {
      const userData = await fetchUserData(uid);
      const errors: string[] = [];

      // Run all 7 analyzers in parallel with individual error handling
      const [expenses, tax, forecast, payments, clients, cashFlow, projects] =
        await Promise.all([
          analyzeExpenses(userData.transactions).catch((e) => {
            errors.push(`expenses: ${e.message}`);
            return { anomalies: [], categoryTrends: [] };
          }),
          analyzeTaxDeductions(userData.transactions).catch((e) => {
            errors.push(`tax: ${e.message}`);
            return { estimatedSavings: 0, effectiveRate: 0, missedDeductions: [], deductionsByCategory: {}, totalDeductible: 0 };
          }),
          forecastRevenue(userData.transactions, userData.workItems).catch((e) => {
            errors.push(`forecast: ${e.message}`);
            return { revenue: [], expenses: [], confidence: 0 };
          }),
          analyzePayments(userData.workItems, userData.clients).catch((e) => {
            errors.push(`payments: ${e.message}`);
            return { invoiceRisks: [], clientPatterns: {} };
          }),
          scoreClients(userData.clients, userData.workItems, userData.transactions).catch((e) => {
            errors.push(`clients: ${e.message}`);
            return { scores: [], concentrationRisk: { level: 'healthy', topClientShare: 0, recommendation: '' } };
          }),
          projectCashFlow(userData.transactions, userData.workItems).catch((e) => {
            errors.push(`cashFlow: ${e.message}`);
            return { projections: [], runway: { months: 0, status: 'comfortable' } };
          }),
          analyzeProjects(userData.workItems).catch((e) => {
            errors.push(`projects: ${e.message}`);
            return { completionEstimates: [], scopeCreep: [], utilization: { currentRate: 0, trend: 'stable', recommendation: '' } };
          }),
        ]);

      await insightRef.set({
        generatedAt: FieldValue.serverTimestamp(),
        status: 'ready',
        errors: errors.length > 0 ? errors : null,
        expenses,
        tax,
        forecast,
        payments,
        clients,
        cashFlow,
        projects,
      });

      return { success: true, errors };
    } catch (error) {
      logger.error('generateInsights fatal error', { uid, error });
      await insightRef.set(
        { status: 'error', errors: [`fatal: ${(error as Error).message}`] },
        { merge: true }
      );
      throw new HttpsError('internal', 'Failed to generate insights');
    }
  }
);
