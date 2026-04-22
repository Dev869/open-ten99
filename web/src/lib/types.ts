export interface LineItem {
  id: string;
  description: string;
  // Cached hours at save time. Live work-order UI always recomputes
  // from TimeEntry records via computeLineItemHours(); this field is
  // persisted so previously-sent PDFs/snapshots stay stable.
  hours: number;
  // Cached cost at save time (hours * rate at that moment). Always
  // derived — no UI-level override on work orders.
  cost: number;
  // Deprecated on work orders. Still written by the Quote editor,
  // which uses a flat-dollar line price unrelated to tracked time.
  // Work-order code ignores this field on read and strips it on save.
  costOverride?: number;
  // Previously a manual hours override for work-order line items.
  // Removed — line-item hours now come exclusively from TimeEntry
  // records. Kept on the type so reads of legacy docs don't fail;
  // work-order saves strip it.
  hoursOverride?: number;
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
  appId?: string;
  sourceEmail: string;
  sourceHtml?: string;
  senderEmail?: string;
  senderName?: string;
  completed?: boolean;
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
  assigneeId?: string;
  teamId?: string;
  clientNotes?: string;
  clientApproval?: 'pending' | 'approved' | 'rejected';
  clientApprovalDate?: Date;
  invoiceStatus?: 'draft' | 'sent' | 'paid' | 'overdue';
  invoiceSentDate?: Date;
  invoicePaidDate?: Date;
  invoiceDueDate?: Date;
  preDiscardStatus?: WorkItemStatus;
  discardedAt?: Date;
  isRetainerInvoice?: boolean;
  retainerPeriodStart?: Date;
  retainerPeriodEnd?: Date;
  retainerOverageHours?: number;
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
  retainerBillingMode?: 'flat' | 'usage';
  retainerFlatRate?: number;
  // Monthly maintenance allotment. Maintenance-type work items in the current
  // period count toward this; hours beyond it are billed at the overage rate
  // (falls back to AppSettings.hourlyRate when unset).
  maintenanceHoursAllotted?: number;
  maintenanceRenewalDay?: number;
  maintenancePaused?: boolean;
  maintenanceOverageRate?: number;
  teamId?: string;
  createdAt: Date;
}

export interface AppSettings {
  accentColor: string;
  hourlyRate: number;
  companyName: string;
  pdfLogoUrl?: string;
  // Invoice template
  invoicePrefix?: string;         // e.g. "INV-"
  invoiceNextNumber?: number;     // auto-incrementing number
  invoicePaymentTerms?: string;   // e.g. "Net 30", "Due on Receipt"
  invoiceNotes?: string;          // default footer notes (payment instructions, etc.)
  invoiceTaxRate?: number;        // optional tax percentage (e.g. 8.25)
  invoiceFromAddress?: string;    // sender address block
  invoiceTerms?: string;          // custom terms & conditions text
  teamId?: string;
  sidebarOrder?: string[];    // ordered array of nav item route keys
  sidebarHidden?: string[];   // array of hidden nav item route keys
  pushNotificationsEnabled?: boolean;
  pushNotifyWorkOrderDue?: boolean;
  pushNotifyNewInboundOrder?: boolean;
  fcmToken?: string;
  mileageRate?: number;
  roundTimeToQuarterHour?: boolean;
}

export const PAYMENT_TERMS_OPTIONS = [
  'Due on Receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
] as const;

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

/* ── Vault ─────────────────────────────────────────── */

export interface VaultMeta {
  salt: string;
  verificationCiphertext: string;
  verificationIv: string;
  createdAt: Date;
}

export interface VaultCredential {
  id?: string;
  clientId: string;
  service: string;
  label: string;
  encryptedData: string;
  iv: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecryptedCredentialData {
  username?: string;
  password?: string;
  apiKey?: string;
  notes?: string;
}

export const VAULT_SERVICES = [
  { id: 'firebase', label: 'Firebase', color: '#F5820D' },
  { id: 'gcloud', label: 'Google Cloud', color: '#4285F4' },
  { id: 'ai-studio', label: 'AI Studio', color: '#886FBF' },
  { id: 'aws', label: 'AWS', color: '#FF9900' },
  { id: 'github', label: 'GitHub', color: '#1A1A2E' },
  { id: 'vercel', label: 'Vercel', color: '#1A1A2E' },
  { id: 'stripe', label: 'Stripe', color: '#635BFF' },
  { id: 'netlify', label: 'Netlify', color: '#00C7B7' },
  { id: 'other', label: 'Other', color: '#86868B' },
] as const;

export type VaultServiceId = (typeof VAULT_SERVICES)[number]['id'] | string;

/* ── Apps ──────────────────────────────────────────── */

export type AppPlatform = 'web' | 'ios' | 'android' | 'desktop' | 'api' | 'other';
export type AppStatus = 'active' | 'maintenance' | 'retired' | 'development';
export type AppEnvironment = 'production' | 'staging' | 'development' | 'other';

export interface App {
  id?: string;
  clientId: string;
  projectId?: string;
  name: string;
  description?: string;
  platform: AppPlatform;
  status: AppStatus;
  url?: string;
  repoUrls: string[];
  techStack?: string[];
  hosting?: string;
  environment?: AppEnvironment;
  deploymentNotes?: string;
  vaultCredentialIds?: string[];
  githubRepo?: GitHubRepoInfo;
  githubAccountId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const APP_PLATFORM_LABELS: Record<AppPlatform, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
  desktop: 'Desktop',
  api: 'API',
  other: 'Other',
};

export const APP_STATUS_LABELS: Record<AppStatus, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  retired: 'Retired',
  development: 'Development',
};

export const APP_STATUS_COLORS: Record<AppStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  retired: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  development: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export const APP_ENVIRONMENT_LABELS: Record<AppEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
  development: 'Development',
  other: 'Other',
};

/* ── GitHub Integration ───────────────────────────── */

export interface GitHubOrgSummary {
  login: string;
  avatarUrl?: string;
}

export interface GitHubAccount {
  accountId: string;
  login: string;
  name?: string | null;
  avatarUrl?: string;
  profileUrl?: string;
  orgs: GitHubOrgSummary[];
  scope?: string;
  connectedAt: Date;
  lastSyncAt?: Date;
}

// Legacy single-account aggregate kept for compatibility. New UI should
// consume the accounts sub-collection via useGitHubAccounts().
export interface GitHubIntegration {
  connected: boolean;
  login: string;
  avatarUrl?: string;
  orgs: GitHubOrgSummary[];
  connectedAt: Date;
  lastSyncAt?: Date;
}

export interface PostmarkWebhook {
  token: string;
  updatedAt: Date;
}

export interface IntegrationData {
  github: GitHubIntegration | null;
  postmarkConfigured: boolean;
  postmarkToken?: string;
}

export interface GitHubRepoInfo {
  fullName: string;
  defaultBranch: string;
  language: string | null;
  topics: string[];
  stargazersCount: number;
  openPrCount: number;
  openIssuesCount: number;
  archived: boolean;
  pushedAt: Date;
}

export type GitHubActivityType = 'commit' | 'pull_request' | 'issue' | 'deployment';

export interface GitHubActivity {
  id?: string;
  type: GitHubActivityType;
  title: string;
  url: string;
  author: string;
  authorAvatarUrl?: string;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
  number?: number;
  sha?: string;
  branch?: string;
}

/* ── Teams ─────────────────────────────────────────── */

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export interface Team {
  id?: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface TeamMember {
  id?: string;         // document ID = userId
  email: string;
  displayName: string;
  role: TeamRole;
  photoURL?: string;
  joinedAt: Date;
}

export interface TeamInvite {
  id?: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
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

/* ── Quotes ─────────────────────────────────────────── */

// A Quote is a pre-work pricing estimate sent to a client. When accepted it
// can be converted to a WorkItem (preserving line items, hours, and cost).
//
// Lifecycle:
//   draft → sent → accepted → converted (to a WorkItem)
//                ↘ declined
//                ↘ expired (auto/manual when validUntil passes)
export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'converted';

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  converted: 'Converted',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  declined: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

export interface Quote {
  id?: string;
  // Ownership / scope
  clientId: string;
  projectId?: string;
  appId?: string;

  // Identity
  quoteNumber?: string;        // Optional human-friendly identifier (e.g. "Q-2026-001")
  title: string;
  description?: string;        // Free-form scope summary shown to the client

  // Status / lifecycle
  status: QuoteStatus;
  validUntil?: Date;           // Expiration date for the offer
  sentAt?: Date;
  respondedAt?: Date;          // accepted or declined timestamp
  clientNotes?: string;        // Notes from the client on accept/decline
  convertedWorkItemId?: string;

  // Pricing
  lineItems: LineItem[];
  totalHours: number;
  totalCost: number;
  taxRate?: number;            // Optional override; falls back to settings.invoiceTaxRate
  discount?: number;           // Flat-amount discount applied before tax
  terms?: string;              // Optional override; falls back to settings.invoiceTerms

  // Generated artifacts
  pdfUrl?: string;
  pdfStoragePath?: string;

  createdAt: Date;
  updatedAt: Date;
}

/* ── Finance ────────────────────────────────────────── */

// Invoice status
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

// Expense categories (Schedule C aligned)
export const EXPENSE_CATEGORIES = [
  'Software & Subscriptions',
  'Equipment & Tools',
  'Office Supplies',
  'Travel',
  'Meals & Entertainment',
  'Vehicle & Fuel',
  'Insurance',
  'Professional Services',
  'Advertising & Marketing',
  'Utilities & Telecom',
  'Subcontractors',
  'Materials & Supplies',
  'Education & Training',
  'Uncategorized',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// === Phase 2: Bank & Payment Integration ===

export type AccountProvider = 'plaid' | 'stripe';
export type AccountStatus = 'active' | 'error' | 'disconnected';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'uncategorized';
export type TransactionProvider = 'plaid' | 'stripe' | 'manual';
export type MatchStatus = 'unmatched' | 'suggested' | 'confirmed' | 'rejected';

export type ReceiptStatus = 'processing' | 'unmatched' | 'matched' | 'confirmed';

export interface Receipt {
  id: string;
  ownerId: string;
  status: ReceiptStatus;
  imageUrl: string;
  fileName: string;
  uploadedAt: Date;
  vendor?: string;
  amount?: number;
  date?: Date;
  category?: string;
  lineItems?: Array<{ description: string; amount: number }>;
  rawText?: string;
  transactionId?: string;
  matchConfidence?: number;
  matchMethod?: 'auto' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

/* ── Time Tracking ─────────────────────────────────── */

export interface TimeEntry {
  id: string;
  ownerId: string;
  clientId: string;
  appId?: string;
  description: string;
  durationSeconds: number;
  isBillable: boolean;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
  updatedAt?: Date;
  workItemId?: string;
  lineItemId?: string;
}

/* ── Mileage Tracking ─────────────────────────────── */

export type MileagePurpose = 'business' | 'personal';

export interface MileageTrip {
  id: string;
  ownerId: string;
  date: Date;
  description: string;
  miles: number;          // Always one-way input value
  purpose: MileagePurpose;
  clientId?: string;
  roundTrip: boolean;
  rate: number;           // IRS rate at time of entry (e.g. 0.70)
  deduction: number;      // effectiveMiles × rate (0 if personal)
  transactionId?: string; // Linked auto-created expense (business only)
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectedAccount {
  id: string;
  ownerId: string;
  provider: AccountProvider;
  accountName: string;
  institutionName: string;
  accountMask: string;
  status: AccountStatus;
  errorMessage?: string;
  lastSyncedAt?: Date;  // Optional — null until first sync completes
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  ownerId: string;
  accountId?: string;
  provider: TransactionProvider;
  externalId?: string;
  date: Date;
  amount: number;
  description: string;
  category: string;
  type: TransactionType;
  matchedWorkItemId?: string;
  matchConfidence?: number;
  matchStatus: MatchStatus;
  isManual: boolean;
  receiptUrl?: string;    // Legacy — migrate to receiptIds
  receiptIds?: string[];  // Linked Receipt document IDs
  taxDeductible?: boolean;
  isRecurring?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/* ── Email Templates ──────────────────────────────── */

export interface EmailTemplate {
  id?: string;
  ownerId: string;
  name: string;
  subject: string;
  html: string;
  greeting?: string;
  message?: string;
  closing?: string;
  signoff?: string;
  fromEmail?: string;
  fromName?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- AI Insights ---

export type InsightStatus = 'generating' | 'ready' | 'error';
export type RiskLevel = 'low' | 'medium' | 'high';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface ExpenseAnomaly {
  transactionId: string;
  description: string;
  amount: number;
  category: string;
  reason: string;
  severity: 'info' | 'warning';
}

export interface CategoryTrend {
  category: string;
  currentMonth: number;
  previousMonth: number;
  trend: TrendDirection;
  percentChange: number;
}

export interface MissedDeduction {
  transactionId: string;
  description: string;
  amount: number;
  suggestedCategory: string;
  reason: string;
}

export interface InvoiceRisk {
  workItemId: string;
  clientName: string;
  amount: number;
  risk: RiskLevel;
  reason: string;
  predictedPayDate: string;
}

export interface ClientPaymentPattern {
  avgDaysToPayment: number;
  onTimeRate: number;
  trend: 'improving' | 'worsening' | 'stable';
}

export interface ClientScore {
  clientId: string;
  clientName: string;
  lifetimeValue: number;
  churnRisk: RiskLevel;
  revenueShare: number;
  reason: string;
}

export interface ConcentrationRisk {
  level: 'healthy' | 'moderate' | 'dangerous';
  topClientShare: number;
  recommendation: string;
}

export interface CashFlowProjection {
  month: string;
  inflow: number;
  outflow: number;
  netCash: number;
}

export interface RunwayEstimate {
  months: number;
  status: 'comfortable' | 'caution' | 'critical';
}

export interface CompletionEstimate {
  workItemId: string;
  title: string;
  estimatedDays: number;
  confidence: number;
}

export interface ScopeCreepAlert {
  workItemId: string;
  title: string;
  reason: string;
  severity: 'warning' | 'info';
}

export interface Utilization {
  currentRate: number;
  trend: TrendDirection;
  recommendation: string;
}

export interface Insights {
  generatedAt: Date;
  status: InsightStatus;
  errors?: string[];

  expenses: {
    anomalies: ExpenseAnomaly[];
    categoryTrends: CategoryTrend[];
  };

  tax: {
    estimatedSavings: number;
    effectiveRate: number;
    missedDeductions: MissedDeduction[];
    deductionsByCategory: Record<string, number>;
    totalDeductible: number;
  };

  forecast: {
    revenue: Array<{ month: string; amount: number }>;
    expenses: Array<{ month: string; amount: number }>;
    confidence: number;
  };

  payments: {
    invoiceRisks: InvoiceRisk[];
    clientPatterns: Record<string, ClientPaymentPattern>;
  };

  clients: {
    scores: ClientScore[];
    concentrationRisk: ConcentrationRisk;
  };

  cashFlow: {
    projections: CashFlowProjection[];
    runway: RunwayEstimate;
  };

  projects: {
    completionEstimates: CompletionEstimate[];
    scopeCreep: ScopeCreepAlert[];
    utilization: Utilization;
  };
}
