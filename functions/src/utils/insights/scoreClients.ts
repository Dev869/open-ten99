export async function scoreClients(
  _clients: FirebaseFirestore.DocumentData[],
  _workItems: FirebaseFirestore.DocumentData[],
  _transactions: FirebaseFirestore.DocumentData[]
): Promise<{ scores: unknown[]; concentrationRisk: { level: string; topClientShare: number; recommendation: string } }> {
  return { scores: [], concentrationRisk: { level: 'healthy', topClientShare: 0, recommendation: '' } };
}
