export const theme = {
  background: '#F5F5F7',
  sidebarBg: '#FFFFFF',
  accent: '#4BA8A8',
  accentDark: '#3A9090',
  accentLight: '#E8F5F5',
  cardBg: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textSecondary: '#86868B',
  border: '#E5E5EA',
  inputBg: '#F2F2F7',
  statusDraft: '#E67E22',
  statusReview: '#4BA8A8',
  statusApproved: '#27AE60',
  statusCompleted: '#86868B',
  typeChange: '#4BA8A8',
  typeFeature: '#27AE60',
  typeMaintenance: '#E67E22',
} as const;

export function statusColor(status: string): string {
  switch (status) {
    case 'draft': return theme.statusDraft;
    case 'inReview': return theme.statusReview;
    case 'approved': return theme.statusApproved;
    case 'completed': return theme.statusCompleted;
    default: return theme.textSecondary;
  }
}

export function typeColor(type: string): string {
  switch (type) {
    case 'changeRequest': return theme.typeChange;
    case 'featureRequest': return theme.typeFeature;
    case 'maintenance': return theme.typeMaintenance;
    default: return theme.textSecondary;
  }
}
