import { getGeminiClient } from '../geminiClient';

export async function forecastRevenue(
  transactions: FirebaseFirestore.DocumentData[],
  workItems: FirebaseFirestore.DocumentData[]
): Promise<{
  revenue: Array<{ month: string; amount: number }>;
  expenses: Array<{ month: string; amount: number }>;
  confidence: number;
}> {
  if (transactions.length === 0) return { revenue: [], expenses: [], confidence: 0 };

  const monthlyData: Record<string, { revenue: number; expenses: number }> = {};
  for (const t of transactions) {
    const d = t.date?.toDate?.();
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { revenue: 0, expenses: 0 };
    if (t.type === 'income') monthlyData[key].revenue += t.amount;
    if (t.type === 'expense') monthlyData[key].expenses += t.amount;
  }

  const activeWorkItems = workItems
    .filter((w) => ['draft', 'inReview', 'approved'].includes(w.status))
    .map((w) => ({
      subject: w.subject,
      status: w.status,
      totalCost: w.totalCost ?? 0,
      invoiceStatus: w.invoiceStatus ?? null,
    }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const now = new Date();
  const nextMonths = [1, 2, 3].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const result = await model.generateContent(`
You are a financial forecaster for a solo contractor. Based on historical monthly revenue/expense data and active work items, predict the next 3 months.

Return JSON:
{
  "revenue": [{ "month": "YYYY-MM", "amount": number }, ...],
  "expenses": [{ "month": "YYYY-MM", "amount": number }, ...],
  "confidence": number
}

Revenue and expenses arrays must each have exactly 3 entries for months: ${nextMonths.join(', ')}.
Confidence is 0.0 to 1.0.

Consider seasonal patterns, current pipeline (active work items), and trends.

Historical monthly data:
${JSON.stringify(monthlyData)}

Active work items (potential upcoming revenue):
${JSON.stringify(activeWorkItems)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
