export async function analyzeExpenses(
  _transactions: FirebaseFirestore.DocumentData[]
): Promise<{ anomalies: unknown[]; categoryTrends: unknown[] }> {
  return { anomalies: [], categoryTrends: [] };
}
