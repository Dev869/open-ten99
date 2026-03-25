import { getGeminiClient } from '../geminiClient';

export async function analyzeProjects(
  workItems: FirebaseFirestore.DocumentData[]
): Promise<{
  completionEstimates: Array<{
    workItemId: string; title: string; estimatedDays: number; confidence: number;
  }>;
  scopeCreep: Array<{
    workItemId: string; title: string; reason: string; severity: 'warning' | 'info';
  }>;
  utilization: { currentRate: number; trend: 'up' | 'down' | 'stable'; recommendation: string };
}> {
  if (workItems.length === 0) {
    return {
      completionEstimates: [], scopeCreep: [],
      utilization: { currentRate: 0, trend: 'stable', recommendation: 'No work items to analyze.' },
    };
  }

  const activeItems = workItems
    .filter((w) => ['draft', 'inReview', 'approved'].includes(w.status))
    .map((w) => ({
      id: w.id,
      subject: w.subject,
      status: w.status,
      lineItemCount: w.lineItems?.length ?? 0,
      estimatedBusinessDays: w.estimatedBusinessDays ?? null,
      totalCost: w.totalCost ?? 0,
      createdAt: w.createdAt?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: w.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    }));

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const completedItems = workItems
    .filter((w) => {
      const completed = w.status === 'completed';
      const recent = w.updatedAt?.toDate?.() > sixMonthsAgo;
      return completed && recent;
    })
    .map((w) => ({
      lineItemCount: w.lineItems?.length ?? 0,
      estimatedBusinessDays: w.estimatedBusinessDays ?? null,
      totalCost: w.totalCost ?? 0,
      createdAt: w.createdAt?.toDate?.()?.toISOString?.() ?? null,
      completedAt: w.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a project management analyst for a solo contractor. Analyze work items.

Return JSON:
{
  "completionEstimates": [
    { "workItemId": string, "title": string, "estimatedDays": number, "confidence": number (0-1) }
  ],
  "scopeCreep": [
    { "workItemId": string, "title": string, "reason": string, "severity": "warning"|"info" }
  ],
  "utilization": {
    "currentRate": number (0-1),
    "trend": "up"|"down"|"stable",
    "recommendation": string
  }
}

completionEstimates: one per active work item. Use the "subject" field as the title.
scopeCreep: max 10. Flag items showing scope creep signals (high line item count relative to estimated days, long time in draft/review, growing cost).
utilization: based on active items vs capacity.
Today: ${new Date().toISOString().split('T')[0]}

Active work items:
${JSON.stringify(activeItems)}

Recently completed items (for velocity reference):
${JSON.stringify(completedItems)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
