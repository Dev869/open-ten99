export async function projectCashFlow(
  _transactions: FirebaseFirestore.DocumentData[],
  _workItems: FirebaseFirestore.DocumentData[]
): Promise<{ projections: unknown[]; runway: { months: number; status: string } }> {
  return { projections: [], runway: { months: 0, status: 'comfortable' } };
}
