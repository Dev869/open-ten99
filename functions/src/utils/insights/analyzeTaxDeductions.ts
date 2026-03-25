import { getGeminiClient } from '../geminiClient';

export async function analyzeTaxDeductions(
  transactions: FirebaseFirestore.DocumentData[]
): Promise<{
  estimatedSavings: number; effectiveRate: number;
  missedDeductions: Array<{
    transactionId: string; description: string; amount: number;
    suggestedCategory: string; reason: string;
  }>;
  deductionsByCategory: Record<string, number>; totalDeductible: number;
}> {
  const currentYear = new Date().getFullYear();
  const yearTransactions = transactions.filter((t) => {
    const d = t.date?.toDate?.();
    return d && d.getFullYear() === currentYear && t.type === 'expense';
  });

  if (yearTransactions.length === 0) {
    return { estimatedSavings: 0, effectiveRate: 0.153, missedDeductions: [], deductionsByCategory: {}, totalDeductible: 0 };
  }

  const summaryData = yearTransactions.map((t) => ({
    id: t.id, description: t.description, amount: t.amount,
    category: t.category, date: t.date?.toDate?.()?.toISOString?.() ?? '',
  }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a tax advisor for a US self-employed contractor (Schedule C filer). Analyze these expense transactions and return JSON:

1. "missedDeductions" (max 30): Transactions categorized as "Uncategorized" or in a wrong category that are likely tax-deductible. Each: { "transactionId": string, "description": string, "amount": number, "suggestedCategory": string (one of the Schedule C categories), "reason": string }

2. "deductionsByCategory": Object mapping each Schedule C category to the total deductible amount in dollars.

3. "totalDeductible": Sum of all deductible expenses in dollars.

4. "effectiveRate": The self-employment tax rate (use 0.153 for SE tax).

5. "estimatedSavings": totalDeductible * effectiveRate (approximate tax savings).

Schedule C categories: Software & Subscriptions, Equipment & Tools, Office Supplies, Travel, Meals & Entertainment, Vehicle & Fuel, Insurance, Professional Services, Advertising & Marketing, Utilities & Telecom, Subcontractors, Materials & Supplies, Education & Training.

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
