import { getGeminiClient } from '../geminiClient';

export async function projectCashFlow(
  transactions: FirebaseFirestore.DocumentData[],
  workItems: FirebaseFirestore.DocumentData[]
): Promise<{
  projections: Array<{ month: string; inflow: number; outflow: number; netCash: number }>;
  runway: { months: number; status: 'comfortable' | 'caution' | 'critical' };
}> {
  if (transactions.length === 0) return { projections: [], runway: { months: 0, status: 'comfortable' } };

  const monthlyData: Record<string, { inflow: number; outflow: number }> = {};
  for (const t of transactions) {
    const d = t.date?.toDate?.();
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { inflow: 0, outflow: 0 };
    if (t.type === 'income') monthlyData[key].inflow += t.amount;
    if (t.type === 'expense') monthlyData[key].outflow += Math.abs(t.amount);
  }

  const unpaidInvoices = workItems
    .filter((w) => w.invoiceStatus && w.invoiceStatus !== 'paid')
    .map((w) => ({
      amount: w.totalCost ?? 0,
      dueDate: w.invoiceDueDate?.toDate?.()?.toISOString?.() ?? null,
      sentDate: w.invoiceSentDate?.toDate?.()?.toISOString?.() ?? null,
    }));

  const now = new Date();
  const nextMonths = [1, 2, 3].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a cash flow analyst for a solo contractor. Project cash flow for the next 3 months.

Return JSON:
{
  "projections": [
    { "month": "YYYY-MM", "inflow": number, "outflow": number, "netCash": number }
  ],
  "runway": {
    "months": number,
    "status": "comfortable"|"caution"|"critical"
  }
}

Projections must have exactly 3 entries for months: ${nextMonths.join(', ')}.
Runway: comfortable = 6+ months positive, caution = 3-6, critical = <3.

Factor in: historical patterns, seasonal trends, unpaid invoices (expected inflow), recurring expenses.
Today: ${now.toISOString().split('T')[0]}

Historical monthly cash flow:
${JSON.stringify(monthlyData)}

Unpaid invoices (expected inflow):
${JSON.stringify(unpaidInvoices)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
