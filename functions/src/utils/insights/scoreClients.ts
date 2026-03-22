import { getGeminiClient } from '../geminiClient';

export async function scoreClients(
  clients: FirebaseFirestore.DocumentData[],
  workItems: FirebaseFirestore.DocumentData[],
  transactions: FirebaseFirestore.DocumentData[]
): Promise<{
  scores: Array<{
    clientId: string; clientName: string; lifetimeValue: number;
    churnRisk: 'low' | 'medium' | 'high'; revenueShare: number; reason: string;
  }>;
  concentrationRisk: {
    level: 'healthy' | 'moderate' | 'dangerous';
    topClientShare: number; recommendation: string;
  };
}> {
  if (clients.length === 0) {
    return { scores: [], concentrationRisk: { level: 'healthy', topClientShare: 0, recommendation: '' } };
  }

  const clientSummaries = clients.map((c) => {
    const clientWorkItems = workItems.filter((w) => w.clientId === c.id);
    const clientRevenue = clientWorkItems.reduce((sum, w) => sum + (w.totalCost ?? 0), 0);
    const lastActivity = clientWorkItems
      .map((w) => w.updatedAt?.toDate?.())
      .filter(Boolean)
      .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];

    return {
      clientId: c.id,
      clientName: c.name ?? c.company ?? 'Unknown',
      totalRevenue: clientRevenue,
      workItemCount: clientWorkItems.length,
      lastActivityDate: lastActivity?.toISOString?.() ?? null,
    };
  });

  const totalRevenue = clientSummaries.reduce((sum, c) => sum + c.totalRevenue, 0);

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a client relationship analyst for a solo contractor. Score each client and assess revenue concentration risk.

Return JSON:
{
  "scores": [
    { "clientId": string, "clientName": string, "lifetimeValue": number (total revenue in $), "churnRisk": "low"|"medium"|"high", "revenueShare": number (0-1 fraction of total revenue), "reason": string (why this churn risk level) }
  ],
  "concentrationRisk": {
    "level": "healthy"|"moderate"|"dangerous",
    "topClientShare": number (0-1),
    "recommendation": string
  }
}

Churn risk factors: time since last activity, frequency of work, revenue trend.
Concentration: dangerous if any client > 50%, moderate if > 40%.
Today's date: ${new Date().toISOString().split('T')[0]}
Total revenue across all clients: $${totalRevenue}

Client data:
${JSON.stringify(clientSummaries)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
