export async function forecastRevenue(
  _transactions: FirebaseFirestore.DocumentData[],
  _workItems: FirebaseFirestore.DocumentData[]
): Promise<{ revenue: unknown[]; expenses: unknown[]; confidence: number }> {
  return { revenue: [], expenses: [], confidence: 0 };
}
