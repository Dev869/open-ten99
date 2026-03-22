import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { getGeminiClient } from "./utils/geminiClient";

interface AnalyzeReportRequest {
  startDate: string; // ISO date string
  endDate: string;
  skipAi?: boolean;
}

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  revenueByMonth: Array<{ month: string; amount: number }>;
  expensesByMonth: Array<{ month: string; amount: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  revenueByClient: Array<{ clientName: string; amount: number; count: number }>;
  workOrderCount: number;
  avgWorkOrderValue: number;
  topExpenseCategory: string;
  periodLabel: string;
}

export const onAnalyzeReport = onCall(
  { cors: true, maxInstances: 10, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { startDate: startStr, endDate: endStr, skipAi } = (request.data ?? {}) as AnalyzeReportRequest;
    if (!startStr || !endStr) {
      throw new HttpsError("invalid-argument", "startDate and endDate are required");
    }

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new HttpsError("invalid-argument", "Invalid date format");
    }

    const uid = request.auth.uid;
    const db = admin.firestore();

    try {
      // Fetch data in parallel
      const [workItemsSnap, transactionsSnap, clientsSnap] = await Promise.all([
        db.collection("workItems").where("ownerId", "==", uid).get(),
        db.collection("transactions").where("ownerId", "==", uid).get(),
        db.collection("clients").where("ownerId", "==", uid).get(),
      ]);

      // Build clients map
      const clientsMap = new Map<string, string>();
      for (const doc of clientsSnap.docs) {
        const data = doc.data();
        clientsMap.set(doc.id, data.name ?? "Unknown");
      }

      // Filter and aggregate work items
      const workItems = workItemsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item: any) => {
          if (!item.createdAt) return false;
          const d = item.createdAt.toDate();
          return d >= startDate && d <= endDate;
        }) as any[];

      // Filter transactions
      const transactions = transactionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t: any) => {
          if (!t.date) return false;
          const d = t.date.toDate();
          return d >= startDate && d <= endDate;
        }) as any[];

      // Compute revenue by month
      const revenueByMonth = new Map<string, number>();
      const expensesByMonth = new Map<string, number>();
      const expensesByCategory = new Map<string, number>();
      const revenueByClient = new Map<string, { amount: number; count: number }>();

      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const item of workItems) {
        if (!item.isBillable || !item.createdAt) continue;
        const d = item.createdAt.toDate();
        const key = d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
        revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + (item.totalCost ?? 0));
        totalRevenue += item.totalCost ?? 0;

        const clientName = clientsMap.get(item.clientId) ?? "Unknown";
        const existing = revenueByClient.get(clientName);
        if (existing) {
          existing.amount += item.totalCost ?? 0;
          existing.count += 1;
        } else {
          revenueByClient.set(clientName, { amount: item.totalCost ?? 0, count: 1 });
        }
      }

      for (const t of transactions) {
        if (t.type !== "expense") continue;
        const d = t.date.toDate();
        const key = d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
        const absAmount = Math.abs(t.amount ?? 0);
        expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + absAmount);
        expensesByCategory.set(t.category ?? "Uncategorized", (expensesByCategory.get(t.category ?? "Uncategorized") ?? 0) + absAmount);
        totalExpenses += absAmount;
      }

      // Build sorted arrays
      const revenueByMonthArr = Array.from(revenueByMonth.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      const expensesByMonthArr = Array.from(expensesByMonth.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      const expensesByCategoryArr = Array.from(expensesByCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      const revenueByClientArr = Array.from(revenueByClient.entries())
        .map(([clientName, data]) => ({ clientName, ...data }))
        .sort((a, b) => b.amount - a.amount);

      const topExpenseCategory = expensesByCategoryArr[0]?.category ?? "None";
      const periodLabel = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      const summary: FinancialSummary = {
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        revenueByMonth: revenueByMonthArr,
        expensesByMonth: expensesByMonthArr,
        expensesByCategory: expensesByCategoryArr,
        revenueByClient: revenueByClientArr,
        workOrderCount: workItems.length,
        avgWorkOrderValue: workItems.length > 0 ? totalRevenue / workItems.length : 0,
        topExpenseCategory,
        periodLabel,
      };

      // Skip AI analysis when caller requests summary-only (fast path)
      if (skipAi === true) {
        return { summary, aiInsights: null };
      }

      // Generate AI interpretation
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });

      const prompt = `You are a financial advisor for a solo independent contractor. Analyze this financial summary for the period ${periodLabel} and provide insights.

Return JSON with this exact structure:
{
  "headline": "A single-sentence summary of the financial period (e.g. 'Strong revenue growth with controlled spending')",
  "highlights": ["3-5 key positive observations about the finances"],
  "concerns": ["1-3 areas of concern or risk, or empty array if none"],
  "recommendations": ["2-4 specific actionable recommendations"],
  "trends": "A 2-3 sentence paragraph about the trends you observe in revenue and expenses over the period",
  "taxTip": "One specific tax-related tip relevant to the data"
}

Financial data:
- Total Revenue: $${totalRevenue.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Net Income: $${(totalRevenue - totalExpenses).toFixed(2)}
- Work Orders: ${workItems.length}
- Average Work Order Value: $${summary.avgWorkOrderValue.toFixed(2)}
- Revenue by Client: ${JSON.stringify(revenueByClientArr.slice(0, 10))}
- Expenses by Category: ${JSON.stringify(expensesByCategoryArr.slice(0, 10))}
- Monthly Revenue: ${JSON.stringify(revenueByMonthArr)}
- Monthly Expenses: ${JSON.stringify(expensesByMonthArr)}`;

      let aiInsights = {
        headline: "",
        highlights: [] as string[],
        concerns: [] as string[],
        recommendations: [] as string[],
        trends: "",
        taxTip: "",
      };

      try {
        const result = await model.generateContent(prompt);
        aiInsights = JSON.parse(result.response.text());
      } catch (e) {
        logger.error("Gemini analysis failed", { error: e });
        aiInsights = {
          headline: "Financial summary generated",
          highlights: [`Generated ${summary.workOrderCount} work orders totaling $${totalRevenue.toFixed(2)}`],
          concerns: [],
          recommendations: ["Connect more accounts and add transactions for deeper analysis"],
          trends: "Insufficient data for detailed trend analysis.",
          taxTip: "Track all business expenses throughout the year to maximize deductions.",
        };
      }

      return { summary, aiInsights };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("analyzeReport failed", { error, uid });
      throw new HttpsError("internal", "Failed to analyze report");
    }
  }
);
