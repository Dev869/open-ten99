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
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth, storage } from '../lib/firebase';
import type { WorkItem, Client, AppSettings, LineItem, UserProfile, VaultMeta, VaultCredential, Team, TeamMember, TeamInvite, TeamRole, App, GitHubIntegration, GitHubActivity, ConnectedAccount, AccountProvider, AccountStatus, Transaction, TransactionProvider, TransactionType, MatchStatus, Receipt } from '../lib/types';

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
    subject: data.subject ?? '',
    lineItems: (data.lineItems ?? []).map((li: DocumentData) => ({
      id: li.id ?? crypto.randomUUID(),
      description: li.description ?? '',
      hours: li.hours ?? 0,
      cost: li.cost ?? 0,
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
      console.warn(`Firestore listener error (attempt ${attempt + 1}/${maxRetries + 1}):`, err);
      if (!cancelled && attempt < maxRetries) {
        attempt++;
        unsub?.();
        unsub = null;
        setTimeout(() => { if (!cancelled) subscribe(); }, 1000 * attempt);
      } else if (!cancelled) {
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
  const ref = collection(db, 'workItems');
  const q = clientId
    ? query(ref, where('clientId', '==', clientId), orderBy('updatedAt', 'desc'))
    : query(ref, orderBy('updatedAt', 'desc'));

  return snapshotWithRetry(q, (snapshot: { docs: DocumentSnapshot[] }) => {
    const items = snapshot.docs.map((d: DocumentSnapshot) => docToWorkItem(d.id, d.data()!));
    callback(items);
  }, { onExhausted: onError });
}

export function subscribeClients(callback: (clients: Client[]) => void, onError?: () => void) {
  const ref = collection(db, 'clients');
  const q = query(ref, orderBy('name', 'asc'));

  return snapshotWithRetry(q, (snapshot: { docs: DocumentSnapshot[] }) => {
    const clients = snapshot.docs.map((d: DocumentSnapshot) => docToClient(d.id, d.data()!));
    callback(clients);
  }, { onExhausted: onError });
}

export function subscribeApps(callback: (apps: App[]) => void, onError?: () => void) {
  const ref = collection(db, 'apps');
  const q = query(ref, orderBy('createdAt', 'desc'));
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
      companyName: data?.companyName ?? 'DW Tailored',
      pdfLogoUrl: data?.pdfLogoUrl ?? undefined,
      invoicePrefix: data?.invoicePrefix ?? undefined,
      invoiceNextNumber: data?.invoiceNextNumber ?? undefined,
      invoicePaymentTerms: data?.invoicePaymentTerms ?? undefined,
      invoiceNotes: data?.invoiceNotes ?? undefined,
      invoiceTaxRate: data?.invoiceTaxRate ?? undefined,
      invoiceFromAddress: data?.invoiceFromAddress ?? undefined,
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
  };
}

export async function createWorkItem(item: Omit<WorkItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = Timestamp.now();
  const ref = collection(db, 'workItems');
  const docRef = await addDoc(ref, {
    ...item,
    lineItems: item.lineItems.map(lineItemToData),
    scheduledDate: item.scheduledDate ? Timestamp.fromDate(item.scheduledDate) : null,
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
    clientId: item.clientId,
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
  callback: (integration: GitHubIntegration | null) => void
) {
  const ref = doc(db, 'integrations', userId);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const data = snapshot.data();
    callback({
      connected: data.connected ?? false,
      login: data.login ?? '',
      avatarUrl: data.avatarUrl ?? undefined,
      orgs: data.orgs ?? [],
      connectedAt: toDate(data.connectedAt),
      lastSyncAt: data.lastSyncAt ? toDate(data.lastSyncAt) : undefined,
    });
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
    taxDeductible: data.taxDeductible as boolean | undefined,
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

