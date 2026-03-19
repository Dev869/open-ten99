export const theme = {
  background: '#F4F1EC',
  sidebarBg: '#FFFDF9',
  accent: '#4BA8A8',
  accentDark: '#3A9090',
  accentLight: '#E8F5F5',
  cardBg: '#FFFDF9',
  textPrimary: '#2C2417',
  textSecondary: '#8C7E6A',
  border: '#DDD5C8',
  inputBg: '#EDE9E2',
  // Status colors stay vibrant for clarity
  statusDraft: '#D4873E',
  statusReview: '#4BA8A8',
  statusApproved: '#5A9A5A',
  statusCompleted: '#8C7E6A',
  typeChange: '#4BA8A8',
  typeFeature: '#5A9A5A',
  typeMaintenance: '#D4873E',
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
