import { getGeminiClient } from '../geminiClient';

export async function analyzeExpenses(
  transactions: FirebaseFirestore.DocumentData[]
): Promise<{
  anomalies: Array<{
    transactionId: string; description: string; amount: number;
    category: string; reason: string; severity: 'info' | 'warning';
  }>;
  categoryTrends: Array<{
    category: string; currentMonth: number; previousMonth: number;
    trend: 'up' | 'down' | 'stable'; percentChange: number;
  }>;
}> {
  if (transactions.length === 0) return { anomalies: [], categoryTrends: [] };

  const expenseTransactions = transactions.filter((t) => t.type === 'expense');
  if (expenseTransactions.length === 0) return { anomalies: [], categoryTrends: [] };

  const summaryData = expenseTransactions.map((t) => ({
    id: t.id, description: t.description, amount: t.amount,
    category: t.category, date: t.date?.toDate?.()?.toISOString?.() ?? '',
  }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a financial analyst for a solo contractor. Analyze these expense transactions and return JSON with two arrays:

1. "anomalies" (max 20): Flag expenses that are unusually high compared to the category average, duplicate-looking charges, or other anomalies.
   Each: { "transactionId": string, "description": string, "amount": number, "category": string, "reason": string (plain English explanation), "severity": "info" | "warning" }

2. "categoryTrends": For each expense category present, compare current month spending to previous month.
   Each: { "category": string, "currentMonth": number, "previousMonth": number, "trend": "up" | "down" | "stable", "percentChange": number }

Transactions:
${JSON.stringify(summaryData)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
