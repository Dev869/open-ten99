import { getGeminiClient } from '../geminiClient';

export async function analyzePayments(
  workItems: FirebaseFirestore.DocumentData[],
  clients: FirebaseFirestore.DocumentData[]
): Promise<{
  invoiceRisks: Array<{
    workItemId: string; clientName: string; amount: number;
    risk: 'low' | 'medium' | 'high'; reason: string; predictedPayDate: string;
  }>;
  clientPatterns: Record<string, {
    avgDaysToPayment: number; onTimeRate: number;
    trend: 'improving' | 'worsening' | 'stable';
  }>;
}> {
  const invoicedItems = workItems.filter((w) => w.invoiceStatus);
  if (invoicedItems.length === 0) return { invoiceRisks: [], clientPatterns: {} };

  const clientMap: Record<string, string> = {};
  for (const c of clients) {
    clientMap[c.id] = c.name ?? c.company ?? 'Unknown';
  }

  const invoiceData = invoicedItems.map((w) => ({
    id: w.id,
    clientId: w.clientId,
    clientName: clientMap[w.clientId] ?? 'Unknown',
    totalCost: w.totalCost ?? 0,
    invoiceStatus: w.invoiceStatus,
    invoiceSentDate: w.invoiceSentDate?.toDate?.()?.toISOString?.() ?? null,
    invoicePaidDate: w.invoicePaidDate?.toDate?.()?.toISOString?.() ?? null,
    invoiceDueDate: w.invoiceDueDate?.toDate?.()?.toISOString?.() ?? null,
  }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a payment risk analyst for a solo contractor. Analyze invoice payment history and predict risks.

Return JSON:
{
  "invoiceRisks": [
    { "workItemId": string, "clientName": string, "amount": number, "risk": "low"|"medium"|"high", "reason": string, "predictedPayDate": "YYYY-MM-DD" }
  ],
  "clientPatterns": {
    "clientId": { "avgDaysToPayment": number, "onTimeRate": number (0-1), "trend": "improving"|"worsening"|"stable" }
  }
}

Only include invoiceRisks for unpaid invoices (invoiceStatus != "paid").
Base risk on: client payment history, invoice age, amount relative to client average.
Today's date: ${new Date().toISOString().split('T')[0]}

Invoice data:
${JSON.stringify(invoiceData)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
