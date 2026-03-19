import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import type { WorkItem, Client, AppSettings, LineItem, UserProfile, VaultMeta, VaultCredential } from '../lib/types';

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

// --- Realtime Listeners ---

export function subscribeWorkItems(
  callback: (items: WorkItem[]) => void,
  clientId?: string
) {
  const ref = collection(db, 'workItems');
  const q = clientId
    ? query(ref, where('clientId', '==', clientId), orderBy('updatedAt', 'desc'))
    : query(ref, orderBy('updatedAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => docToWorkItem(doc.id, doc.data()));
    callback(items);
  });
}

export function subscribeClients(callback: (clients: Client[]) => void) {
  const ref = collection(db, 'clients');
  const q = query(ref, orderBy('name', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map((doc) => docToClient(doc.id, doc.data()));
    callback(clients);
  });
}

export function subscribeSettings(
  userId: string,
  callback: (settings: AppSettings) => void
) {
  const ref = doc(db, 'settings', userId);

  return onSnapshot(ref, (snapshot) => {
    const data = snapshot.data();
    callback({
      accentColor: data?.accentColor ?? '#4BA8A8',
      hourlyRate: data?.hourlyRate ?? 150,
      companyName: data?.companyName ?? 'DW Tailored',
      pdfLogoUrl: data?.pdfLogoUrl ?? undefined,
    });
  });
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
    updatedAt: Timestamp.now(),
  });
}

export async function archiveWorkItem(id: string) {
  const ref = doc(db, 'workItems', id);
  await updateDoc(ref, {
    status: 'archived',
    updatedAt: Timestamp.now(),
  });
}

export async function bulkUpdateStatus(ids: string[], status: string) {
  const promises = ids.map((id) => {
    const ref = doc(db, 'workItems', id);
    return updateDoc(ref, { status, updatedAt: Timestamp.now() });
  });
  await Promise.all(promises);
}

// --- Clients CRUD ---

export async function createClient(client: Omit<Client, 'id' | 'createdAt'>) {
  const ref = collection(db, 'clients');
  const docRef = await addDoc(ref, {
    ...client,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateClient(client: Client) {
  if (!client.id) throw new Error('Client has no ID');
  const ref = doc(db, 'clients', client.id);
  await updateDoc(ref, {
    name: client.name,
    email: client.email,
    phone: client.phone ?? null,
    company: client.company ?? null,
    notes: client.notes ?? null,
    retainerHours: client.retainerHours ?? null,
    retainerRenewalDay: client.retainerRenewalDay ?? null,
    retainerPaused: client.retainerPaused ?? false,
  });
}

export async function deleteClient(id: string) {
  const ref = doc(db, 'clients', id);
  await deleteDoc(ref);
}

// --- Settings ---

export async function updateSettings(userId: string, settings: Partial<AppSettings>) {
  const ref = doc(db, 'settings', userId);
  const { setDoc } = await import('firebase/firestore');
  await setDoc(ref, settings, { merge: true });
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
  await setDoc(ref, { ...profile, updatedAt: Timestamp.now() }, { merge: true });
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
  await setDoc(ref, { ...meta, createdAt: Timestamp.now() });
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
  const docRef = await addDoc(ref, { ...credential, createdAt: now, updatedAt: now });
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

// --- Cloud Functions ---

export async function generatePDF(workItemId: string) {
  const fn = httpsCallable<{ workItemId: string }, { pdfUrl: string }>(functions, 'generatePDF');
  const result = await fn({ workItemId });
  return result.data.pdfUrl;
}

