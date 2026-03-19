export interface LineItem {
  id: string;
  description: string;
  hours: number;
  cost: number;
}

export type WorkItemType = 'changeRequest' | 'featureRequest' | 'maintenance';
export type WorkItemStatus = 'draft' | 'inReview' | 'approved' | 'completed' | 'archived';

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  customDays?: number;
  endDate?: Date;
}

export interface WorkItem {
  id?: string;
  type: WorkItemType;
  status: WorkItemStatus;
  clientId: string;
  projectId?: string;
  sourceEmail: string;
  subject: string;
  lineItems: LineItem[];
  totalHours: number;
  totalCost: number;
  isBillable: boolean;
  pdfUrl?: string;
  pdfStoragePath?: string;
  deductFromRetainer?: boolean;
  estimatedBusinessDays?: number;
  recurrence?: Recurrence;
  scheduledDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  custom: 'Custom',
};

export interface Client {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  retainerHours?: number;
  retainerRenewalDay?: number;
  retainerPaused?: boolean;
  createdAt: Date;
}

export interface AppSettings {
  accentColor: string;
  hourlyRate: number;
  companyName: string;
  pdfLogoUrl?: string;
}

export interface MagicLink {
  clientId: string;
  email: string;
  workItemId: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface UserProfile {
  displayName: string;
  phone?: string;
  company?: string;
  bio?: string;
  website?: string;
  address?: string;
  photoURL?: string;
  updatedAt: Date;
}

export const WORK_ITEM_TYPE_LABELS: Record<WorkItemType, string> = {
  changeRequest: 'Change Request',
  featureRequest: 'Feature Request',
  maintenance: 'Maintenance',
};

export const WORK_ITEM_STATUS_LABELS: Record<WorkItemStatus, string> = {
  draft: 'Draft',
  inReview: 'In Review',
  approved: 'Approved',
  completed: 'Completed',
  archived: 'Archived',
};
