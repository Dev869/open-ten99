import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth, storage } from '../lib/firebase';
import type { WorkItem, Client, AppSettings, LineItem, UserProfile, VaultMeta, VaultCredential, Team, TeamMember, TeamInvite, TeamRole, App, GitHubIntegration, GitHubActivity, ConnectedAccount, AccountProvider, AccountStatus, Transaction, TransactionProvider, TransactionType, MatchStatus, EmailTemplate, Receipt, TimeEntry, MileageTrip, MileagePurpose, Insights, IntegrationData, Quote, QuoteStatus } from '../lib/types';

// --- Converters ---

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date();
}

function docToWorkItem(id: string, data: DocumentData): WorkItem {
  return {
    id,
    type: data.type,
    status: data.status,
    clientId: data.clientId,
    projectId: data.projectId ?? undefined,
    appId: data.appId ?? undefined,
    sourceEmail: data.sourceEmail ?? '',
    sourceHtml: data.sourceHtml ?? undefined,
    senderEmail: data.senderEmail ?? undefined,
    senderName: data.senderName ?? undefined,
    completed: data.completed ?? false,
    subject: data.subject ?? '',
    lineItems: (data.lineItems ?? []).map((li: DocumentData) => ({
      id: li.id ?? crypto.randomUUID(),
      description: li.description ?? '',
      hours: li.hours ?? 0,
      cost: li.cost ?? 0,
      costOverride: li.costOverride ?? undefined,
    })),
    totalHours: data.totalHours ?? 0,
    totalCost: data.totalCost ?? 0,
    isBillable: data.isBillable ?? true,
    pdfUrl: data.pdfUrl ?? undefined,
    pdfStoragePath: data.pdfStoragePath ?? undefined,
    deductFromRetainer: data.deductFromRetainer ?? false,
    estimatedBusinessDays: data.estimatedBusinessDays ?? undefined,
    recurrence: data.recurrence
      ? {
          frequency: data.recurrence.frequency,
          customDays: data.recurrence.customDays ?? undefined,
          endDate: data.recurrence.endDate ? toDate(data.recurrence.endDate) : undefined,
        }
      : undefined,
    scheduledDate: data.scheduledDate ? toDate(data.scheduledDate) : undefined,
    clientNotes: data.clientNotes ?? undefined,
    clientApproval: data.clientApproval ?? undefined,
    clientApprovalDate: data.clientApprovalDate ? toDate(data.clientApprovalDate) : undefined,
    invoiceStatus: data.invoiceStatus ?? undefined,
    invoiceSentDate: data.invoiceSentDate ? toDate(data.invoiceSentDate) : undefined,
    invoicePaidDate: data.invoicePaidDate ? toDate(data.invoicePaidDate) : undefined,
    invoiceDueDate: data.invoiceDueDate ? toDate(data.invoiceDueDate) : undefined,
    preDiscardStatus: data.preDiscardStatus ?? undefined,
    discardedAt: data.discardedAt ? toDate(data.discardedAt) : undefined,
    isRetainerInvoice: data.isRetainerInvoice ?? false,
    retainerPeriodStart: data.retainerPeriodStart ? toDate(data.retainerPeriodStart) : undefined,
    retainerPeriodEnd: data.retainerPeriodEnd ? toDate(data.retainerPeriodEnd) : undefined,
    retainerOverageHours: data.retainerOverageHours ?? undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function docToClient(id: string, data: DocumentData): Client {
  return {
    id,
    name: data.name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? undefined,
    company: data.company ?? undefined,
    notes: data.notes ?? undefined,
    retainerHours: data.retainerHours ?? undefined,
    retainerRenewalDay: data.retainerRenewalDay ?? undefined,
    retainerPaused: data.retainerPaused ?? false,
    retainerBillingMode: data.retainerBillingMode ?? undefined,
    retainerFlatRate: data.retainerFlatRate ?? undefined,
    maintenanceHoursAllotted: data.maintenanceHoursAllotted ?? undefined,
    maintenanceRenewalDay: data.maintenanceRenewalDay ?? undefined,
    maintenancePaused: data.maintenancePaused ?? false,
    maintenanceOverageRate: data.maintenanceOverageRate ?? undefined,
    createdAt: toDate(data.createdAt),
  };
}

function docToApp(id: string, data: DocumentData): App {
  return {
    id,
    clientId: data.clientId,
    projectId: data.projectId ?? undefined,
    name: data.name ?? '',
    description: data.description ?? undefined,
    platform: data.platform ?? 'other',
    status: data.status ?? 'active',
    url: data.url ?? undefined,
    repoUrls: data.repoUrls ?? [],
    techStack: data.techStack ?? undefined,
    hosting: data.hosting ?? undefined,
    environment: data.environment ?? undefined,
    deploymentNotes: data.deploymentNotes ?? undefined,
    vaultCredentialIds: data.vaultCredentialIds ?? undefined,
    githubRepo: data.githubRepo
      ? {
          fullName: data.githubRepo.fullName ?? '',
          defaultBranch: data.githubRepo.defaultBranch ?? 'main',
          language: data.githubRepo.language ?? null,
          topics: data.githubRepo.topics ?? [],
          stargazersCount: data.githubRepo.stargazersCount ?? 0,
          openPrCount: data.githubRepo.openPrCount ?? 0,
          openIssuesCount: data.githubRepo.openIssuesCount ?? 0,
          archived: data.githubRepo.archived ?? false,
          pushedAt: toDate(data.githubRepo.pushedAt),
        }
      : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

// --- Realtime Listeners ---

/**
 * onSnapshot with auto-retry — if Firestore rejects the listener (e.g. auth
 * token not yet propagated after a fresh sign-in), wait and re-subscribe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snapshotWithRetry(
  target: any,
  onNext: (snap: any) => void,
  options?: { maxRetries?: number; onExhausted?: () => void },
): () => void {
  const maxRetries = options?.maxRetries ?? 3;
  let attempt = 0;
  let unsub: (() => void) | null = null;
  let cancelled = false;

  function subscribe() {
    unsub = onSnapshot(target, onNext, (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Firestore listener error (attempt ${attempt + 1}/${maxRetries + 1}):`, err);

      // Don't retry on index-building or permission errors — retrying won't help
      // and can corrupt the Firestore SDK's internal watch stream state.
      const nonRetryable = msg.includes('requires an index') || msg.includes('PERMISSION_DENIED');
      if (nonRetryable || cancelled) {
        if (!cancelled) options?.onExhausted?.();
        return;
      }

      if (attempt < maxRetries) {
        attempt++;
        unsub?.();
        unsub = null;
        setTimeout(() => { if (!cancelled) subscribe(); }, 1000 * attempt);
      } else {
        options?.onExhausted?.();
      }
    });
  }

  subscribe();
  return () => { cancelled = true; unsub?.(); };
}

export function subscribeWorkItems(
  callback: (items: WorkItem[]) => void,
  clientId?: string,
  onError?: () => void,
) {
  const user = auth.currentUser;
  if (!user) { callback([]); return () => {}; }

  const ref = collection(db, 'workItems');
  const constraints: QueryConstraint[] = [
    where('ownerId', '==', user.uid),
    orderBy('updatedAt', 'desc'),
  ];
  if (clientId) {
    constraints.splice(1, 0, where('clientId', '==', clientId));
  }
  const q = query(ref, ...constraints);

  return snapshotWithRetry(q, (snapshot: { docs: DocumentSnapshot[] }) => {
    const items = snapshot.docs.map((d: DocumentSnapshot) => docToWorkItem(d.id, d.data()!));
    callback(items);
  }, { onExhausted: onError });
}

export function subscribeClients(callback: (clients: Client[]) => void, onError?: () => void) {
  const user = auth.currentUser;
  if (!user) { callback([]); return () => {}; }

  const ref = collection(db, 'clients');
  const q = query(ref, where('ownerId', '==', user.uid), orderBy('name', 'asc'));

  return snapshotWithRetry(q, (snapshot: { docs: DocumentSnapshot[] }) => {
    const clients = snapshot.docs.map((d: DocumentSnapshot) => docToClient(d.id, d.data()!));
    callback(clients);
  }, { onExhausted: onError });
}

export function subscribeApps(callback: (apps: App[]) => void, onError?: () => void) {
  const user = auth.currentUser;
  if (!user) { callback([]); return () => {}; }

  const ref = collection(db, 'apps');
  const q = query(ref, where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
  return snapshotWithRetry(q, (snapshot: { docs: DocumentSnapshot[] }) => {
    const apps = snapshot.docs.map((d: DocumentSnapshot) => docToApp(d.id, d.data()!));
    callback(apps);
  }, { onExhausted: onError });
}

export function subscribeSettings(
  userId: string,
  callback: (settings: AppSettings) => void,
  onError?: () => void,
) {
  const ref = doc(db, 'settings', userId);

  return snapshotWithRetry(ref, (snapshot: DocumentSnapshot) => {
    const data = snapshot.data();
    callback({
      accentColor: data?.accentColor ?? '#4BA8A8',
      hourlyRate: data?.hourlyRate ?? 150,
      companyName: data?.companyName ?? 'Your Company',
      pdfLogoUrl: data?.pdfLogoUrl ?? undefined,
      invoicePrefix: data?.invoicePrefix ?? undefined,
      invoiceNextNumber: data?.invoiceNextNumber ?? undefined,
      invoicePaymentTerms: data?.invoicePaymentTerms ?? undefined,
      invoiceNotes: data?.invoiceNotes ?? undefined,
      invoiceTaxRate: data?.invoiceTaxRate ?? undefined,
      invoiceFromAddress: data?.invoiceFromAddress ?? undefined,
      invoiceTerms: data?.invoiceTerms ?? undefined,
      teamId: data?.teamId ?? undefined,
      sidebarOrder: data?.sidebarOrder ?? undefined,
      sidebarHidden: data?.sidebarHidden ?? undefined,
    });
  }, { onExhausted: onError });
}

// --- Work Items CRUD ---

function lineItemToData(li: LineItem) {
  return {
    id: li.id,
    description: li.description,
    hours: li.hours,
    cost: li.cost,
    ...(li.costOverride !== undefined && { costOverride: li.costOverride }),
  };
}

export async function createWorkItem(item: Omit<WorkItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = Timestamp.now();
  const ref = collection(db, 'workItems');
  // Strip undefined values — Firestore rejects them in addDoc()
  const clean = Object.fromEntries(
    Object.entries(item).filter(([, v]) => v !== undefined)
  );
  const docRef = await addDoc(ref, {
    ...clean,
    lineItems: item.lineItems.map(lineItemToData),
    scheduledDate: item.scheduledDate ? Timestamp.fromDate(item.scheduledDate) : null,
    retainerPeriodStart: item.retainerPeriodStart ? Timestamp.fromDate(item.retainerPeriodStart) : null,
    retainerPeriodEnd: item.retainerPeriodEnd ? Timestamp.fromDate(item.retainerPeriodEnd) : null,
    ownerId: auth.currentUser?.uid ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateWorkItem(item: WorkItem) {
  if (!item.id) throw new Error('Work item has no ID');
  const ref = doc(db, 'workItems', item.id);
  await updateDoc(ref, {
    type: item.type,
    status: item.status,
    clientId: item.clientId ?? null,
    projectId: item.projectId ?? null,
    appId: item.appId ?? null,
    assigneeId: item.assigneeId ?? null,
    teamId: item.teamId ?? null,
    clientNotes: item.clientNotes ?? null,
    clientApproval: item.clientApproval ?? null,
    clientApprovalDate: item.clientApprovalDate ? Timestamp.fromDate(item.clientApprovalDate) : null,
    invoiceStatus: item.invoiceStatus ?? null,
    invoiceSentDate: item.invoiceSentDate ? Timestamp.fromDate(item.invoiceSentDate) : null,
    invoicePaidDate: item.invoicePaidDate ? Timestamp.fromDate(item.invoicePaidDate) : null,
    invoiceDueDate: item.invoiceDueDate ? Timestamp.fromDate(item.invoiceDueDate) : null,
    sourceEmail: item.sourceEmail,
    subject: item.subject,
    lineItems: item.lineItems.map(lineItemToData),
    totalHours: item.totalHours,
    totalCost: item.totalCost,
    isBillable: item.isBillable,
    deductFromRetainer: item.deductFromRetainer ?? false,
    estimatedBusinessDays: item.estimatedBusinessDays ?? null,
    recurrence: item.recurrence
      ? {
          frequency: item.recurrence.frequency,
          customDays: item.recurrence.customDays ?? null,
          endDate: item.recurrence.endDate ? Timestamp.fromDate(item.recurrence.endDate) : null,
        }
      : null,
    pdfUrl: item.pdfUrl ?? null,
    scheduledDate: item.scheduledDate ? Timestamp.fromDate(item.scheduledDate) : null,
    completed: item.completed ?? false,
    ownerId: auth.currentUser?.uid ?? null,
    updatedAt: Timestamp.now(),
  });
}

export async function discardWorkItem(id: string, currentStatus?: string) {
  const ref = doc(db, 'workItems', id);
  await updateDoc(ref, {
    preDiscardStatus: currentStatus ?? 'completed',
    status: 'archived',
    discardedAt: Timestamp.now(),
    ownerId: auth.currentUser?.uid ?? null,
    updatedAt: Timestamp.now(),
  });
}

export async function restoreWorkItem(id: string) {
  const { runTransaction } = await import('firebase/firestore');
  const ref = doc(db, 'workItems', id);
  await runTransaction(db, async (txn) => {
    const snap = await txn.get(ref);
    const restoredStatus = snap.data()?.preDiscardStatus || 'completed';
    txn.update(ref, {
      status: restoredStatus,
      preDiscardStatus: deleteField(),
      discardedAt: deleteField(),
      ownerId: auth.currentUser?.uid ?? null,
      updatedAt: Timestamp.now(),
    });
  });
}

export async function permanentlyDeleteWorkItem(id: string) {
  const ref = doc(db, 'workItems', id);
  await deleteDoc(ref);
}

export async function bulkUpdateStatus(ids: string[], status: string) {
  const uid = auth.currentUser?.uid ?? null;
  const promises = ids.map((id) => {
    const ref = doc(db, 'workItems', id);
    return updateDoc(ref, { status, ownerId: uid, updatedAt: Timestamp.now() });
  });
  await Promise.all(promises);
}

// --- Invoice Tracking ---

export async function updateInvoiceStatus(
  workItemId: string,
  data: { invoiceStatus: string; invoiceSentDate?: Date; invoicePaidDate?: Date; invoiceDueDate?: Date },
) {
  const ref = doc(db, 'workItems', workItemId);
  const clean: Record<string, unknown> = { ownerId: auth.currentUser?.uid ?? null, updatedAt: Timestamp.now() };
  clean.invoiceStatus = data.invoiceStatus;
  if (data.invoiceSentDate) clean.invoiceSentDate = Timestamp.fromDate(data.invoiceSentDate);
  if (data.invoicePaidDate) clean.invoicePaidDate = Timestamp.fromDate(data.invoicePaidDate);
  if (data.invoiceDueDate) clean.invoiceDueDate = Timestamp.fromDate(data.invoiceDueDate);
  await updateDoc(ref, clean);
}

// --- Portal Client Response ---

export async function updateWorkItemClientResponse(
  workItemId: string,
  data: { clientNotes?: string; clientApproval?: string; clientApprovalDate?: Date },
) {
  const ref = doc(db, 'workItems', workItemId);
  const clean: Record<string, unknown> = { updatedAt: Timestamp.now() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      clean[k] = v instanceof Date ? Timestamp.fromDate(v) : v;
    }
  }
  await updateDoc(ref, clean);
}


// --- Clients CRUD ---

export async function createClient(client: Omit<Client, 'id' | 'createdAt'>) {
  const ref = collection(db, 'clients');
  // Firestore rejects undefined values — strip them before writing
  const clean: Record<string, unknown> = { createdAt: Timestamp.now() };
  for (const [k, v] of Object.entries(client)) {
    if (v !== undefined) clean[k] = v;
  }
  // Normalize email for consistent lookup (e.g. parseEmail.ts matches lowercase)
  if (typeof clean.email === 'string') clean.email = (clean.email as string).toLowerCase().trim();
  if (auth.currentUser) clean.ownerId = auth.currentUser.uid;
  const docRef = await addDoc(ref, clean);
  return docRef.id;
}

export async function updateClient(client: Client) {
  if (!client.id) throw new Error('Client has no ID');
  const ref = doc(db, 'clients', client.id);
  await updateDoc(ref, {
    name: client.name,
    email: client.email.toLowerCase().trim(),
    phone: client.phone ?? null,
    company: client.company ?? null,
    notes: client.notes ?? null,
    retainerHours: client.retainerHours ?? null,
    retainerRenewalDay: client.retainerRenewalDay ?? null,
    retainerPaused: client.retainerPaused ?? false,
    retainerBillingMode: client.retainerBillingMode ?? null,
    retainerFlatRate: client.retainerFlatRate ?? null,
    maintenanceHoursAllotted: client.maintenanceHoursAllotted ?? null,
    maintenanceRenewalDay: client.maintenanceRenewalDay ?? null,
    maintenancePaused: client.maintenancePaused ?? false,
    maintenanceOverageRate: client.maintenanceOverageRate ?? null,
    ownerId: auth.currentUser?.uid ?? null,
  });
}

export async function deleteClient(id: string) {
  // Clear clientId on all work orders referencing this client
  const wiRef = collection(db, 'workItems');
  const q = query(wiRef, where('clientId', '==', id));
  const snapshot = await getDocs(q);

  const BATCH_LIMIT = 499;
  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      batch.update(d.ref, { clientId: '', updatedAt: Timestamp.now() });
    });
    await batch.commit();
  }

  const ref = doc(db, 'clients', id);
  await deleteDoc(ref);
}

// --- Apps CRUD ---

export async function createApp(app: Omit<App, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = collection(db, 'apps');
  const now = Timestamp.now();
  const clean: Record<string, unknown> = {
    createdAt: now,
    updatedAt: now,
  };
  for (const [k, v] of Object.entries(app)) {
    if (v !== undefined) clean[k] = v;
  }
  if (auth.currentUser) clean.ownerId = auth.currentUser.uid;
  const docRef = await addDoc(ref, clean);
  return docRef.id;
}

export async function updateApp(app: App) {
  if (!app.id) throw new Error('App has no ID');
  const ref = doc(db, 'apps', app.id);
  await updateDoc(ref, {
    clientId: app.clientId,
    projectId: app.projectId ?? null,
    name: app.name,
    description: app.description ?? null,
    platform: app.platform,
    status: app.status,
    url: app.url ?? null,
    repoUrls: app.repoUrls,
    techStack: app.techStack ?? null,
    hosting: app.hosting ?? null,
    environment: app.environment ?? null,
    deploymentNotes: app.deploymentNotes ?? null,
    vaultCredentialIds: app.vaultCredentialIds ?? null,
    githubRepo: app.githubRepo ?? null,
    ownerId: auth.currentUser?.uid ?? null,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteApp(id: string) {
  // Clear appId on all work orders referencing this app
  const wiRef = collection(db, 'workItems');
  const q = query(wiRef, where('appId', '==', id));
  const snapshot = await getDocs(q);

  // Chunk into batches of 499 (leave room for the app delete)
  const BATCH_LIMIT = 499;
  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      batch.update(d.ref, { appId: null, updatedAt: Timestamp.now() });
    });
    await batch.commit();
  }

  // Delete the app
  const ref = doc(db, 'apps', id);
  await deleteDoc(ref);
}

// --- Settings ---

export async function updateSettings(userId: string, settings: Partial<AppSettings>) {
  const ref = doc(db, 'settings', userId);
  const { setDoc } = await import('firebase/firestore');
  // Firestore rejects undefined values — strip them before writing
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (v !== undefined) clean[k] = v;
  }
  await setDoc(ref, clean, { merge: true });
}

export async function getAndIncrementInvoiceNumber(userId: string): Promise<number> {
  const { runTransaction } = await import('firebase/firestore');
  const ref = doc(db, 'settings', userId);
  return runTransaction(db, async (txn) => {
    const snap = await txn.get(ref);
    const current = snap.data()?.invoiceNextNumber ?? 1;
    txn.update(ref, { invoiceNextNumber: current + 1 });
    return current;
  });
}

// --- Profile ---

export function subscribeProfile(
  userId: string,
  callback: (profile: UserProfile | null) => void
) {
  const ref = doc(db, 'profiles', userId);

  return onSnapshot(ref, (snapshot) => {
    const data = snapshot.data();
    if (!data) {
      callback(null);
      return;
    }
    callback({
      displayName: data.displayName ?? '',
      phone: data.phone ?? undefined,
      company: data.company ?? undefined,
      bio: data.bio ?? undefined,
      website: data.website ?? undefined,
      address: data.address ?? undefined,
      photoURL: data.photoURL ?? undefined,
      updatedAt: toDate(data.updatedAt),
    });
  });
}

export async function updateProfile(userId: string, profile: Partial<UserProfile>) {
  const ref = doc(db, 'profiles', userId);
  const { setDoc } = await import('firebase/firestore');
  const clean: Record<string, unknown> = { updatedAt: Timestamp.now() };
  for (const [k, v] of Object.entries(profile)) {
    if (v !== undefined) clean[k] = v;
  }
  await setDoc(ref, clean, { merge: true });
}

// --- Vault ---

export function subscribeVaultMeta(
  userId: string,
  callback: (meta: VaultMeta | null) => void,
) {
  const ref = doc(db, 'vaults', userId);
  return onSnapshot(ref, (snapshot) => {
    const data = snapshot.data();
    if (!data) { callback(null); return; }
    callback({
      salt: data.salt,
      verificationCiphertext: data.verificationCiphertext,
      verificationIv: data.verificationIv,
      createdAt: toDate(data.createdAt),
    });
  });
}

export async function createVaultMeta(
  userId: string,
  meta: Omit<VaultMeta, 'createdAt'>,
) {
  const ref = doc(db, 'vaults', userId);
  const { setDoc } = await import('firebase/firestore');
  await setDoc(ref, { ...meta, ownerId: auth.currentUser?.uid ?? null, createdAt: Timestamp.now() });
}

export function subscribeVaultCredentials(
  userId: string,
  callback: (credentials: VaultCredential[]) => void,
) {
  const ref = collection(db, 'vaults', userId, 'credentials');
  const q = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        clientId: d.data().clientId,
        service: d.data().service,
        label: d.data().label,
        encryptedData: d.data().encryptedData,
        iv: d.data().iv,
        createdAt: toDate(d.data().createdAt),
        updatedAt: toDate(d.data().updatedAt),
      })),
    );
  });
}

export async function createVaultCredential(
  userId: string,
  credential: Omit<VaultCredential, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const ref = collection(db, 'vaults', userId, 'credentials');
  const now = Timestamp.now();
  const docRef = await addDoc(ref, { ...credential, ownerId: auth.currentUser?.uid ?? null, createdAt: now, updatedAt: now });
  return docRef.id;
}

export async function updateVaultCredential(
  userId: string,
  credentialId: string,
  data: Partial<VaultCredential>,
) {
  const ref = doc(db, 'vaults', userId, 'credentials', credentialId);
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteVaultCredential(userId: string, credentialId: string) {
  const ref = doc(db, 'vaults', userId, 'credentials', credentialId);
  await deleteDoc(ref);
}

// --- Teams ---

export function subscribeTeam(
  teamId: string,
  callback: (team: Team | null) => void,
) {
  const ref = doc(db, 'teams', teamId);
  return onSnapshot(ref, (snapshot) => {
    const data = snapshot.data();
    if (!data) { callback(null); return; }
    callback({
      id: snapshot.id,
      name: data.name,
      ownerId: data.ownerId,
      createdAt: toDate(data.createdAt),
    });
  });
}

export async function createTeam(team: Omit<Team, 'id' | 'createdAt'>) {
  const ref = collection(db, 'teams');
  const clean: Record<string, unknown> = { createdAt: Timestamp.now() };
  for (const [k, v] of Object.entries(team)) {
    if (v !== undefined) clean[k] = v;
  }
  if (auth.currentUser) clean.ownerId = auth.currentUser.uid;
  const docRef = await addDoc(ref, clean);
  return docRef.id;
}

export async function updateTeam(teamId: string, data: Partial<Team>) {
  const ref = doc(db, 'teams', teamId);
  await updateDoc(ref, { ...data });
}

export function subscribeTeamMembers(
  teamId: string,
  callback: (members: TeamMember[]) => void,
) {
  const ref = collection(db, 'teams', teamId, 'members');
  const q = query(ref, orderBy('joinedAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        email: d.data().email,
        displayName: d.data().displayName,
        role: d.data().role,
        photoURL: d.data().photoURL ?? undefined,
        joinedAt: toDate(d.data().joinedAt),
      })),
    );
  });
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  member: Omit<TeamMember, 'id' | 'joinedAt'>,
) {
  const ref = doc(db, 'teams', teamId, 'members', userId);
  const { setDoc } = await import('firebase/firestore');
  await setDoc(ref, { ...member, joinedAt: Timestamp.now() });
}

export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: TeamRole,
) {
  const ref = doc(db, 'teams', teamId, 'members', userId);
  await updateDoc(ref, { role });
}

export async function removeTeamMember(teamId: string, userId: string) {
  const ref = doc(db, 'teams', teamId, 'members', userId);
  await deleteDoc(ref);
}

export function subscribeTeamInvites(
  teamId: string,
  callback: (invites: TeamInvite[]) => void,
) {
  const ref = collection(db, 'teams', teamId, 'invites');
  const q = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        email: d.data().email,
        role: d.data().role,
        invitedBy: d.data().invitedBy,
        status: d.data().status,
        createdAt: toDate(d.data().createdAt),
      })),
    );
  });
}

export async function createTeamInvite(
  teamId: string,
  invite: Omit<TeamInvite, 'id' | 'createdAt' | 'status'>,
) {
  const ref = collection(db, 'teams', teamId, 'invites');
  const docRef = await addDoc(ref, {
    ...invite,
    ownerId: auth.currentUser?.uid ?? null,
    status: 'pending',
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateInviteStatus(
  teamId: string,
  inviteId: string,
  status: 'accepted' | 'declined',
) {
  const ref = doc(db, 'teams', teamId, 'invites', inviteId);
  await updateDoc(ref, { status });
}

export async function deleteTeamInvite(teamId: string, inviteId: string) {
  const ref = doc(db, 'teams', teamId, 'invites', inviteId);
  await deleteDoc(ref);
}

// --- GitHub Integration ---

export function subscribeIntegration(
  userId: string,
  callback: (integration: IntegrationData) => void
) {
  const ref = doc(db, 'integrations', userId);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback({ github: null, postmarkConfigured: false });
      return;
    }
    const data = snapshot.data();
    const github: GitHubIntegration | null = data.connected
      ? {
          connected: data.connected ?? false,
          login: data.login ?? '',
          avatarUrl: data.avatarUrl ?? undefined,
          orgs: data.orgs ?? [],
          connectedAt: toDate(data.connectedAt),
          lastSyncAt: data.lastSyncAt ? toDate(data.lastSyncAt) : undefined,
        }
      : null;
    const postmarkConfigured = !!data.postmarkWebhook?.token;
    const postmarkToken = data.postmarkWebhook?.token as string | undefined;
    callback({ github, postmarkConfigured, postmarkToken });
  });
}

export function subscribeGitHubActivity(
  appId: string,
  callback: (activities: GitHubActivity[]) => void
) {
  const ref = collection(db, 'apps', appId, 'github');
  const q = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        title: data.title ?? '',
        url: data.url ?? '',
        author: data.author ?? '',
        authorAvatarUrl: data.authorAvatarUrl ?? undefined,
        status: data.status ?? undefined,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        number: data.number ?? undefined,
        sha: data.sha ?? undefined,
        branch: data.branch ?? undefined,
      } as GitHubActivity;
    });
    callback(activities);
  });
}

// --- Cloud Functions ---

export async function generatePDF(workItemId: string) {
  const fn = httpsCallable<{ workItemId: string }, { pdfUrl: string }>(functions, 'generatePDF');
  const result = await fn({ workItemId });
  return result.data.pdfUrl;
}

// --- Bank & Payment Integration ---

function docToConnectedAccount(id: string, data: Record<string, unknown>): ConnectedAccount {
  return {
    id,
    ownerId: data.ownerId as string,
    provider: data.provider as AccountProvider,
    accountName: data.accountName as string ?? '',
    institutionName: data.institutionName as string ?? '',
    accountMask: data.accountMask as string ?? '',
    status: data.status as AccountStatus ?? 'active',
    errorMessage: data.errorMessage as string | undefined,
    lastSyncedAt: data.lastSyncedAt ? toDate(data.lastSyncedAt) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function docToTransaction(id: string, data: Record<string, unknown>): Transaction {
  return {
    id,
    ownerId: data.ownerId as string,
    accountId: data.accountId as string | undefined,
    provider: data.provider as TransactionProvider ?? 'manual',
    externalId: data.externalId as string | undefined,
    date: toDate(data.date),
    amount: data.amount as number ?? 0,
    description: data.description as string ?? '',
    category: data.category as string ?? 'Uncategorized',
    type: data.type as TransactionType ?? 'uncategorized',
    matchedWorkItemId: data.matchedWorkItemId as string | undefined,
    matchConfidence: data.matchConfidence as number | undefined,
    matchStatus: data.matchStatus as MatchStatus ?? 'unmatched',
    isManual: data.isManual as boolean ?? false,
    receiptUrl: data.receiptUrl as string | undefined,
    receiptIds: data.receiptIds as string[] | undefined,
    taxDeductible: data.taxDeductible as boolean | undefined,
    isRecurring: data.isRecurring as boolean | undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeConnectedAccounts(
  callback: (accounts: ConnectedAccount[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  // Simple query without orderBy — avoids needing a composite index.
  // Sort client-side instead.
  const q = query(
    collection(db, 'connectedAccounts'),
    where('ownerId', '==', user.uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const accounts = snapshot.docs
        .map((doc) => docToConnectedAccount(doc.id, doc.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(accounts);
    },
    (error) => {
      console.error('connectedAccounts subscription error:', error);
      callback([]);
    }
  );
}

export async function deleteConnectedAccount(accountId: string): Promise<void> {
  // Delete the display document. _secrets cleanup via Cloud Function.
  await deleteDoc(doc(db, 'connectedAccounts', accountId));
}

// === Receipt Service Functions ===

function docToReceipt(id: string, data: DocumentData): Receipt {
  return {
    id,
    ownerId: data.ownerId ?? '',
    status: data.status ?? 'processing',
    imageUrl: data.imageUrl ?? '',
    fileName: data.fileName ?? '',
    uploadedAt: data.uploadedAt?.toDate?.() ?? new Date(),
    vendor: data.vendor ?? undefined,
    amount: data.amount ?? undefined,
    date: data.date?.toDate?.() ?? undefined,
    category: data.category ?? undefined,
    lineItems: data.lineItems ?? undefined,
    rawText: data.rawText ?? undefined,
    transactionId: data.transactionId ?? undefined,
    matchConfidence: data.matchConfidence ?? undefined,
    matchMethod: data.matchMethod ?? undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  };
}

function docToMileageTrip(id: string, data: DocumentData): MileageTrip {
  return {
    id,
    ownerId: data.ownerId ?? '',
    date: data.date?.toDate?.() ?? new Date(),
    description: data.description ?? '',
    miles: data.miles ?? 0,
    purpose: data.purpose ?? 'business',
    clientId: data.clientId ?? undefined,
    roundTrip: data.roundTrip ?? false,
    rate: data.rate ?? 0.70,
    deduction: data.deduction ?? 0,
    transactionId: data.transactionId ?? undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  };
}

function docToInsights(data: DocumentData): Insights {
  return {
    generatedAt: data.generatedAt?.toDate?.() ?? new Date(),
    status: data.status ?? 'generating',
    errors: data.errors ?? undefined,
    expenses: {
      anomalies: data.expenses?.anomalies ?? [],
      categoryTrends: data.expenses?.categoryTrends ?? [],
    },
    tax: {
      estimatedSavings: data.tax?.estimatedSavings ?? 0,
      effectiveRate: data.tax?.effectiveRate ?? 0,
      missedDeductions: data.tax?.missedDeductions ?? [],
      deductionsByCategory: data.tax?.deductionsByCategory ?? {},
      totalDeductible: data.tax?.totalDeductible ?? 0,
    },
    forecast: {
      revenue: data.forecast?.revenue ?? [],
      expenses: data.forecast?.expenses ?? [],
      confidence: data.forecast?.confidence ?? 0,
    },
    payments: {
      invoiceRisks: data.payments?.invoiceRisks ?? [],
      clientPatterns: data.payments?.clientPatterns ?? {},
    },
    clients: {
      scores: data.clients?.scores ?? [],
      concentrationRisk: data.clients?.concentrationRisk ?? {
        level: 'healthy',
        topClientShare: 0,
        recommendation: '',
      },
    },
    cashFlow: {
      projections: data.cashFlow?.projections ?? [],
      runway: data.cashFlow?.runway ?? { months: 0, status: 'comfortable' },
    },
    projects: {
      completionEstimates: data.projects?.completionEstimates ?? [],
      scopeCreep: data.projects?.scopeCreep ?? [],
      utilization: data.projects?.utilization ?? {
        currentRate: 0,
        trend: 'stable',
        recommendation: '',
      },
    },
  };
}

export function subscribeReceipts(
  callback: (receipts: Receipt[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, 'receipts'),
    where('ownerId', '==', user.uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const receipts = snapshot.docs
        .map((doc) => docToReceipt(doc.id, doc.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(receipts);
    },
    (error) => {
      console.error('receipts subscription error:', error);
      callback([]);
    }
  );
}

export async function uploadReceiptFile(file: File): Promise<{ imageUrl: string; receiptId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const timestamp = Date.now();
  const storageRef = ref(storage, `receipts/${user.uid}/${timestamp}-${file.name}`);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, 'receipts'), {
    ownerId: user.uid,
    status: 'processing',
    imageUrl,
    fileName: file.name,
    uploadedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { imageUrl, receiptId: docRef.id };
}

export async function confirmReceiptMatch(receiptId: string): Promise<void> {
  await updateDoc(doc(db, 'receipts', receiptId), {
    status: 'confirmed',
    updatedAt: Timestamp.now(),
  });
}

export async function reassignReceipt(
  receiptId: string,
  oldTransactionId: string | undefined,
  newTransactionId: string
): Promise<void> {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  batch.update(doc(db, 'receipts', receiptId), {
    transactionId: newTransactionId,
    matchMethod: 'manual',
    matchConfidence: 1.0,
    status: 'confirmed',
    updatedAt: now,
  });

  if (oldTransactionId) {
    const oldTxRef = doc(db, 'transactions', oldTransactionId);
    const oldTxSnap = await getDoc(oldTxRef);
    if (oldTxSnap.exists()) {
      const oldIds: string[] = oldTxSnap.data().receiptIds ?? [];
      batch.update(oldTxRef, {
        receiptIds: oldIds.filter((id) => id !== receiptId),
        updatedAt: now,
      });
    }
  }

  const newTxRef = doc(db, 'transactions', newTransactionId);
  const newTxSnap = await getDoc(newTxRef);
  if (newTxSnap.exists()) {
    const newIds: string[] = newTxSnap.data().receiptIds ?? [];
    batch.update(newTxRef, {
      receiptIds: [...newIds, receiptId],
      updatedAt: now,
    });
  }

  await batch.commit();
}

export async function createExpenseFromReceipt(receiptId: string, receipt: Receipt): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const now = Timestamp.now();

  const txRef = await addDoc(collection(db, 'transactions'), {
    ownerId: user.uid,
    provider: 'manual',
    externalId: null,
    date: receipt.date ? Timestamp.fromDate(receipt.date) : now,
    amount: -(receipt.amount ?? 0),
    description: receipt.vendor ?? 'Receipt expense',
    category: receipt.category ?? 'Uncategorized',
    type: 'expense',
    matchStatus: 'unmatched',
    isManual: true,
    taxDeductible: false,
    receiptIds: [receiptId],
    createdAt: now,
    updatedAt: now,
  });

  await updateDoc(doc(db, 'receipts', receiptId), {
    transactionId: txRef.id,
    matchMethod: 'manual',
    matchConfidence: 1.0,
    status: 'confirmed',
    updatedAt: now,
  });

  return txRef.id;
}

export async function deleteReceipt(receiptId: string, imageUrl: string): Promise<void> {
  const storageRef = ref(storage, imageUrl);
  try {
    await deleteObject(storageRef);
  } catch {
    // Storage file may already be deleted
  }
  await deleteDoc(doc(db, 'receipts', receiptId));
}

export async function updateTransactionCategory(
  transactionId: string,
  category: string
): Promise<void> {
  await updateDoc(doc(db, 'transactions', transactionId), {
    category,
    updatedAt: Timestamp.now(),
  });
}

export async function updateTransaction(
  transactionId: string,
  fields: Partial<Pick<Transaction, 'description' | 'category' | 'taxDeductible' | 'type' | 'isRecurring'>>
): Promise<void> {
  await updateDoc(doc(db, 'transactions', transactionId), {
    ...fields,
    updatedAt: Timestamp.now(),
  });
}

export async function fetchTransaction(transactionId: string): Promise<Transaction | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const snap = await getDoc(doc(db, 'transactions', transactionId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.ownerId !== user.uid) return null;
    return docToTransaction(snap.id, data);
  } catch (error) {
    console.error('Failed to fetch transaction:', error);
    return null;
  }
}

export async function fetchTransactions(options: {
  pageSize?: number;
  afterDoc?: DocumentSnapshot;
  accountId?: string;
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<{
  transactions: Transaction[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  const user = auth.currentUser;
  if (!user) return { transactions: [], lastDoc: null, hasMore: false };

  const pageSize = options.pageSize ?? 50;

  // Use a simple ownerId-only query to avoid needing composite indexes.
  // Filter and sort client-side. When transaction volume grows, deploy
  // composite indexes and switch back to server-side ordering.
  const constraints: QueryConstraint[] = [
    where('ownerId', '==', user.uid),
  ];

  try {
    const q = query(collection(db, 'transactions'), ...constraints);
    const snapshot = await getDocs(q);

    let results = snapshot.docs.map((d) => docToTransaction(d.id, d.data()));

    // Client-side filtering
    if (options.accountId) {
      results = results.filter((t) => t.accountId === options.accountId);
    }
    if (options.type) {
      results = results.filter((t) => t.type === options.type);
    }
    if (options.dateFrom) {
      results = results.filter((t) => t.date >= options.dateFrom!);
    }
    if (options.dateTo) {
      results = results.filter((t) => t.date <= options.dateTo!);
    }

    // Client-side sort by date descending
    results.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Client-side pagination
    const startIdx = options.afterDoc
      ? results.findIndex((t) => t.id === options.afterDoc!.id) + 1
      : 0;
    const paged = results.slice(startIdx, startIdx + pageSize);
    const hasMore = startIdx + pageSize < results.length;

    return {
      transactions: paged,
      lastDoc: paged.length > 0 ? snapshot.docs.find((d) => d.id === paged[paged.length - 1].id) ?? null : null,
      hasMore,
    };
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return { transactions: [], lastDoc: null, hasMore: false };
  }
}

export async function createManualExpense(data: {
  description: string;
  amount: number;
  category: string;
  date: Date;
  taxDeductible: boolean;
  receiptUrl?: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const docRef = await addDoc(collection(db, 'transactions'), {
    ownerId: user.uid,
    provider: 'manual',
    externalId: null,
    date: Timestamp.fromDate(data.date),
    amount: -Math.abs(data.amount), // Expenses are negative
    description: data.description,
    category: data.category,
    type: 'expense',
    matchStatus: 'unmatched',
    isManual: true,
    taxDeductible: data.taxDeductible,
    receiptUrl: data.receiptUrl ?? null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function confirmMatch(transactionId: string, workItemId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const batch = writeBatch(db);
  batch.update(doc(db, 'transactions', transactionId), {
    matchStatus: 'confirmed',
    matchedWorkItemId: workItemId,
    updatedAt: Timestamp.now(),
  });
  batch.update(doc(db, 'workItems', workItemId), {
    invoiceStatus: 'paid',
    invoicePaidDate: Timestamp.fromDate(new Date()),
    ownerId: user.uid,
    updatedAt: Timestamp.now(),
  });
  await batch.commit();
}

export async function rejectMatch(transactionId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  await updateDoc(doc(db, 'transactions', transactionId), {
    matchStatus: 'rejected',
    matchedWorkItemId: null,
    matchConfidence: null,
    updatedAt: Timestamp.now(),
  });
}

// --- Email Templates ---

function docToEmailTemplate(id: string, data: DocumentData): EmailTemplate {
  return {
    id,
    ownerId: data.ownerId,
    name: data.name ?? '',
    subject: data.subject ?? '',
    html: data.html ?? '',
    greeting: data.greeting ?? undefined,
    message: data.message ?? undefined,
    closing: data.closing ?? undefined,
    signoff: data.signoff ?? undefined,
    fromEmail: data.fromEmail ?? undefined,
    fromName: data.fromName ?? undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeEmailTemplates(
  callback: (templates: EmailTemplate[]) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, 'emailTemplates'),
    where('ownerId', '==', user.uid),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToEmailTemplate(d.id, d.data())));
  });
}

export async function saveEmailTemplate(
  template: Omit<EmailTemplate, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const now = Timestamp.now();

  if (template.id) {
    const ref = doc(db, 'emailTemplates', template.id);
    await updateDoc(ref, {
      name: template.name,
      subject: template.subject,
      html: template.html,
      greeting: template.greeting ?? null,
      message: template.message ?? null,
      closing: template.closing ?? null,
      signoff: template.signoff ?? null,
      fromEmail: template.fromEmail ?? null,
      fromName: template.fromName ?? null,
      updatedAt: now,
    });
    return template.id;
  }

  const ref = await addDoc(collection(db, 'emailTemplates'), {
    ownerId: user.uid,
    name: template.name,
    subject: template.subject,
    html: template.html,
    greeting: template.greeting ?? null,
    message: template.message ?? null,
    closing: template.closing ?? null,
    signoff: template.signoff ?? null,
    fromEmail: template.fromEmail ?? null,
    fromName: template.fromName ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function deleteEmailTemplate(templateId: string): Promise<void> {
  await deleteDoc(doc(db, 'emailTemplates', templateId));
}

// --- Time Entries ---

function docToTimeEntry(id: string, data: DocumentData): TimeEntry {
  return {
    id,
    ownerId: data.ownerId ?? '',
    clientId: data.clientId ?? '',
    appId: data.appId ?? undefined,
    description: data.description ?? '',
    durationSeconds: data.durationSeconds ?? 0,
    isBillable: data.isBillable ?? true,
    startedAt: toDate(data.startedAt),
    endedAt: toDate(data.endedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt?.toDate() ?? undefined,
    workItemId: data.workItemId ?? undefined,
    lineItemId: data.lineItemId ?? undefined,
  };
}

export function subscribeTimeEntries(
  callback: (entries: TimeEntry[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, 'timeEntries'),
    where('ownerId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map((d) => docToTimeEntry(d.id, d.data()));
      callback(entries);
    },
    (error) => {
      console.error('timeEntries subscription error:', error);
      callback([]);
    }
  );
}

export async function createTimeEntry(
  entry: Omit<TimeEntry, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const docRef = await addDoc(collection(db, 'timeEntries'), {
    ownerId: user.uid,
    clientId: entry.clientId,
    ...(entry.appId ? { appId: entry.appId } : {}),
    description: entry.description,
    durationSeconds: entry.durationSeconds,
    isBillable: entry.isBillable,
    startedAt: Timestamp.fromDate(entry.startedAt),
    endedAt: Timestamp.fromDate(entry.endedAt),
    createdAt: Timestamp.now(),
    ...(entry.workItemId && { workItemId: entry.workItemId }),
    ...(entry.lineItemId && { lineItemId: entry.lineItemId }),
  });

  return docRef.id;
}

export async function updateTimeEntry(
  id: string,
  updates: Partial<Pick<TimeEntry, 'workItemId' | 'lineItemId' | 'description' | 'durationSeconds' | 'isBillable' | 'appId'>> & {
    endedAt?: Date;
  }
): Promise<void> {
  const ref = doc(db, 'timeEntries', id);
  const { endedAt, ...rest } = updates;
  await updateDoc(ref, {
    ...rest,
    ...(endedAt ? { endedAt: Timestamp.fromDate(endedAt) } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function unlinkTimeEntriesForLineItem(
  timeEntries: TimeEntry[],
  lineItemId: string
): Promise<void> {
  const batch = writeBatch(db);
  const matching = timeEntries.filter((te) => te.lineItemId === lineItemId);
  for (const te of matching) {
    const ref = doc(db, 'timeEntries', te.id);
    batch.update(ref, {
      workItemId: deleteField(),
      lineItemId: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// === Mileage Trip Service Functions ===

export function subscribeMileageTrips(
  callback: (trips: MileageTrip[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};
  const q = query(
    collection(db, 'mileageTrips'),
    where('ownerId', '==', user.uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const trips = snapshot.docs
        .map((d) => docToMileageTrip(d.id, d.data()))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
      callback(trips);
    },
    (error) => {
      console.error('mileageTrips subscription error:', error);
      callback([]);
    }
  );
}

export async function createMileageTrip(data: {
  date: Date;
  description: string;
  miles: number;
  purpose: MileagePurpose;
  clientId?: string;
  roundTrip: boolean;
  rate: number;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const effectiveMiles = data.roundTrip ? data.miles * 2 : data.miles;
  const deduction = data.purpose === 'business' ? effectiveMiles * data.rate : 0;
  const tripRef = doc(collection(db, 'mileageTrips'));
  const now = Timestamp.now();

  if (data.purpose === 'business') {
    const txnRef = doc(collection(db, 'transactions'));
    const batch = writeBatch(db);
    batch.set(tripRef, {
      ownerId: user.uid, date: Timestamp.fromDate(data.date), description: data.description,
      miles: data.miles, purpose: data.purpose, clientId: data.clientId ?? null,
      roundTrip: data.roundTrip, rate: data.rate, deduction, transactionId: txnRef.id,
      createdAt: now, updatedAt: now,
    });
    batch.set(txnRef, {
      ownerId: user.uid, provider: 'manual', externalId: null,
      date: Timestamp.fromDate(data.date), amount: -Math.abs(deduction),
      description: data.description, category: 'Vehicle & Fuel', type: 'expense',
      matchStatus: 'unmatched', isManual: true, taxDeductible: true, receiptUrl: null,
      createdAt: now, updatedAt: now,
    });
    await batch.commit();
  } else {
    const batch = writeBatch(db);
    batch.set(tripRef, {
      ownerId: user.uid, date: Timestamp.fromDate(data.date), description: data.description,
      miles: data.miles, purpose: data.purpose, clientId: data.clientId ?? null,
      roundTrip: data.roundTrip, rate: data.rate, deduction: 0, transactionId: null,
      createdAt: now, updatedAt: now,
    });
    await batch.commit();
  }
  return tripRef.id;
}

export async function deleteMileageTrip(tripId: string, transactionId?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'mileageTrips', tripId));
  if (transactionId) {
    batch.delete(doc(db, 'transactions', transactionId));
  }
  await batch.commit();
}

export async function updateMileageTrip(
  tripId: string,
  current: { purpose: MileagePurpose; transactionId?: string },
  data: {
    date: Date; description: string; miles: number; purpose: MileagePurpose;
    clientId?: string; roundTrip: boolean; rate: number;
  }
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const effectiveMiles = data.roundTrip ? data.miles * 2 : data.miles;
  const deduction = data.purpose === 'business' ? effectiveMiles * data.rate : 0;
  const now = Timestamp.now();
  const batch = writeBatch(db);

  const tripUpdate: Record<string, unknown> = {
    date: Timestamp.fromDate(data.date), description: data.description, miles: data.miles,
    purpose: data.purpose, clientId: data.clientId ?? null, roundTrip: data.roundTrip,
    rate: data.rate, deduction, updatedAt: now,
  };

  if (current.purpose === 'business' && data.purpose === 'personal') {
    if (current.transactionId) batch.delete(doc(db, 'transactions', current.transactionId));
    tripUpdate.transactionId = null;
  } else if (current.purpose === 'personal' && data.purpose === 'business') {
    const txnRef = doc(collection(db, 'transactions'));
    batch.set(txnRef, {
      ownerId: user.uid, provider: 'manual', externalId: null,
      date: Timestamp.fromDate(data.date), amount: -Math.abs(deduction),
      description: data.description, category: 'Vehicle & Fuel', type: 'expense',
      matchStatus: 'unmatched', isManual: true, taxDeductible: true, receiptUrl: null,
      createdAt: now, updatedAt: now,
    });
    tripUpdate.transactionId = txnRef.id;
  } else if (data.purpose === 'business' && current.transactionId) {
    batch.update(doc(db, 'transactions', current.transactionId), {
      date: Timestamp.fromDate(data.date), amount: -Math.abs(deduction),
      description: data.description, updatedAt: now,
    });
  }

  batch.update(doc(db, 'mileageTrips', tripId), tripUpdate);
  await batch.commit();
}

// === Insights Service Functions ===

export function subscribeInsights(
  callback: (insights: Insights | null) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const docRef = doc(db, 'insights', user.uid);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(docToInsights(snapshot.data()));
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('insights subscription error:', error);
      callback(null);
    }
  );
}

export async function callGenerateInsights(force = false): Promise<void> {
  const fn = httpsCallable(functions, 'onGenerateInsights');
  await fn({ force });
}

// === Quotes ================================================================

function docToQuote(id: string, data: DocumentData): Quote {
  return {
    id,
    clientId: data.clientId ?? '',
    projectId: data.projectId ?? undefined,
    appId: data.appId ?? undefined,
    quoteNumber: data.quoteNumber ?? undefined,
    title: data.title ?? '',
    description: data.description ?? undefined,
    status: (data.status as QuoteStatus) ?? 'draft',
    validUntil: data.validUntil ? toDate(data.validUntil) : undefined,
    sentAt: data.sentAt ? toDate(data.sentAt) : undefined,
    respondedAt: data.respondedAt ? toDate(data.respondedAt) : undefined,
    clientNotes: data.clientNotes ?? undefined,
    convertedWorkItemId: data.convertedWorkItemId ?? undefined,
    lineItems: (data.lineItems ?? []).map((li: DocumentData) => ({
      id: li.id ?? crypto.randomUUID(),
      description: li.description ?? '',
      hours: li.hours ?? 0,
      cost: li.cost ?? 0,
      costOverride: li.costOverride ?? undefined,
    })),
    totalHours: data.totalHours ?? 0,
    totalCost: data.totalCost ?? 0,
    taxRate: data.taxRate ?? undefined,
    discount: data.discount ?? undefined,
    terms: data.terms ?? undefined,
    pdfUrl: data.pdfUrl ?? undefined,
    pdfStoragePath: data.pdfStoragePath ?? undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeQuotes(
  callback: (quotes: Quote[]) => void,
  clientId?: string,
  onError?: () => void,
) {
  const user = auth.currentUser;
  if (!user) { callback([]); return () => {}; }

  const ref = collection(db, 'quotes');
  const constraints: QueryConstraint[] = [
    where('ownerId', '==', user.uid),
    orderBy('updatedAt', 'desc'),
  ];
  if (clientId) {
    constraints.splice(1, 0, where('clientId', '==', clientId));
  }
  const q = query(ref, ...constraints);

  return snapshotWithRetry(q, (snapshot: { docs: DocumentSnapshot[] }) => {
    const quotes = snapshot.docs.map((d) => docToQuote(d.id, d.data()!));
    callback(quotes);
  }, { onExhausted: onError });
}

function quoteToData(quote: Partial<Quote>) {
  // Strip undefineds and convert Dates → Timestamps. Firestore rejects undefined.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(quote)) {
    if (v === undefined) continue;
    if (k === 'lineItems' && Array.isArray(v)) {
      out.lineItems = (v as LineItem[]).map(lineItemToData);
      continue;
    }
    if (v instanceof Date) {
      out[k] = Timestamp.fromDate(v);
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function createQuote(quote: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const now = Timestamp.now();
  const ref = collection(db, 'quotes');
  const docRef = await addDoc(ref, {
    ...quoteToData(quote),
    ownerId: user.uid,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateQuote(quote: Quote) {
  if (!quote.id) throw new Error('Quote has no ID');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const ref = doc(db, 'quotes', quote.id);
  // Use setDoc-like merge by updating an explicit field set; null out optional
  // fields the caller intentionally cleared.
  await updateDoc(ref, {
    clientId: quote.clientId,
    projectId: quote.projectId ?? null,
    appId: quote.appId ?? null,
    quoteNumber: quote.quoteNumber ?? null,
    title: quote.title,
    description: quote.description ?? null,
    status: quote.status,
    validUntil: quote.validUntil ? Timestamp.fromDate(quote.validUntil) : null,
    sentAt: quote.sentAt ? Timestamp.fromDate(quote.sentAt) : null,
    respondedAt: quote.respondedAt ? Timestamp.fromDate(quote.respondedAt) : null,
    clientNotes: quote.clientNotes ?? null,
    convertedWorkItemId: quote.convertedWorkItemId ?? null,
    lineItems: quote.lineItems.map(lineItemToData),
    totalHours: quote.totalHours,
    totalCost: quote.totalCost,
    taxRate: quote.taxRate ?? null,
    discount: quote.discount ?? null,
    terms: quote.terms ?? null,
    pdfUrl: quote.pdfUrl ?? null,
    pdfStoragePath: quote.pdfStoragePath ?? null,
    ownerId: user.uid,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteQuote(id: string) {
  await deleteDoc(doc(db, 'quotes', id));
}

export async function markQuoteSent(id: string) {
  const ref = doc(db, 'quotes', id);
  await updateDoc(ref, {
    status: 'sent',
    sentAt: Timestamp.now(),
    ownerId: auth.currentUser?.uid ?? null,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Portal-side response. Updates the client-visible fields only — Firestore
 * rules enforce that portal users cannot touch other fields.
 */
export async function recordQuoteResponse(
  quoteId: string,
  response: 'accepted' | 'declined',
  clientNotes?: string,
) {
  const ref = doc(db, 'quotes', quoteId);
  const data: Record<string, unknown> = {
    status: response,
    respondedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  if (clientNotes !== undefined) data.clientNotes = clientNotes;
  await updateDoc(ref, data);
}

/**
 * Convert an accepted quote into a draft work item. Returns the new work item ID.
 * The original quote is marked converted and linked to the new work item.
 */
export async function convertQuoteToWorkItem(quote: Quote): Promise<string> {
  if (!quote.id) throw new Error('Quote has no ID');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const newWorkItemId = await createWorkItem({
    type: 'featureRequest',
    status: 'approved',
    clientId: quote.clientId,
    projectId: quote.projectId,
    appId: quote.appId,
    sourceEmail: '',
    subject: quote.title,
    lineItems: quote.lineItems,
    totalHours: quote.totalHours,
    totalCost: quote.totalCost,
    isBillable: true,
  });

  await updateDoc(doc(db, 'quotes', quote.id), {
    status: 'converted',
    convertedWorkItemId: newWorkItemId,
    ownerId: user.uid,
    updatedAt: Timestamp.now(),
  });

  return newWorkItemId;
}

export async function generateQuotePDF(quoteId: string) {
  const fn = httpsCallable<{ quoteId: string }, { pdfUrl: string }>(functions, 'generateQuotePDF');
  const result = await fn({ quoteId });
  return result.data.pdfUrl;
}

/**
 * One-shot fetch by ID. Used by the portal quote view, where the user
 * arrives via a magic link with a known quote ID. Firestore rules govern
 * whether the caller can actually see the document.
 */
export async function fetchQuote(quoteId: string): Promise<Quote | null> {
  try {
    const snap = await getDoc(doc(db, 'quotes', quoteId));
    if (!snap.exists()) return null;
    return docToQuote(snap.id, snap.data());
  } catch (err) {
    console.error('Failed to fetch quote:', err);
    return null;
  }
}
