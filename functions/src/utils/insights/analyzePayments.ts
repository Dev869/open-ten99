export async function analyzePayments(
  _workItems: FirebaseFirestore.DocumentData[],
  _clients: FirebaseFirestore.DocumentData[]
): Promise<{ invoiceRisks: unknown[]; clientPatterns: Record<string, unknown> }> {
  return { invoiceRisks: [], clientPatterns: {} };
}
