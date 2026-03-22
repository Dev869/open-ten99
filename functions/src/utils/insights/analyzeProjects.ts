export async function analyzeProjects(
  _workItems: FirebaseFirestore.DocumentData[]
): Promise<{ completionEstimates: unknown[]; scopeCreep: unknown[]; utilization: { currentRate: number; trend: string; recommendation: string } }> {
  return { completionEstimates: [], scopeCreep: [], utilization: { currentRate: 0, trend: 'stable', recommendation: '' } };
}
