/**
 * Seed script — populates sample data for the current authenticated user.
 * Run from browser console: import('/src/lib/seedData.ts').then(m => m.seed())
 * Or call seedSampleData() from a component.
 */

import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  createClient,
  createWorkItem,
  createTimeEntry,
  createManualExpense,
  createApp,
  createMileageTrip,
} from '../services/firestore';

/* ── Clear all data for the current user ────────────── */

const OWNED_COLLECTIONS = [
  'workItems',
  'clients',
  'apps',
  'timeEntries',
  'transactions',
  'receipts',
  'mileageTrips',
];

export async function clearAllData() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  console.log('🗑️  Clearing all data...');

  for (const col of OWNED_COLLECTIONS) {
    const q = query(collection(db, col), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);

    if (snap.empty) continue;

    // Firestore batches are limited to 500 operations
    let batch = writeBatch(db);
    let count = 0;

    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 450 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }

    if (count % 450 !== 0) {
      await batch.commit();
    }

    console.log(`  ✓ Deleted ${count} docs from ${col}`);
  }

  console.log('\n✅ All data cleared. Refresh the page.');
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function hoursAfter(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3600_000);
}

function futureDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function seedSampleData() {
  console.log('🌱 Seeding sample data...');

  // ── Clients ──────────────────────────────────
  const clientIds: Record<string, string> = {};

  const clientDefs = [
    { name: 'Meridian Labs', email: 'ops@meridianlabs.io', company: 'Meridian Labs Inc.', phone: '(415) 555-0142' },
    { name: 'Oakwood Properties', email: 'dev@oakwoodprops.com', company: 'Oakwood Properties LLC', phone: '(512) 555-0198' },
    { name: 'Priya Sharma', email: 'priya@sparkline.co', company: 'Sparkline Analytics' },
    { name: 'River City Brewing', email: 'hello@rivercitybrew.com', company: 'River City Brewing Co.', phone: '(503) 555-0177' },
    { name: 'Atlas Digital', email: 'team@atlasdigital.dev', company: 'Atlas Digital Agency' },
  ];

  for (const c of clientDefs) {
    const id = await createClient(c);
    clientIds[c.name] = id;
    console.log(`  ✓ Client: ${c.name}`);
  }

  // ── Apps ──────────────────────────────────────
  const appIds: Record<string, string> = {};

  const appDefs = [
    { clientId: clientIds['Meridian Labs'], name: 'Patient Portal', platform: 'web' as const, status: 'active' as const, description: 'React + Firebase patient dashboard', techStack: ['React', 'TypeScript', 'Firebase'], repoUrls: [] },
    { clientId: clientIds['Meridian Labs'], name: 'Lab API', platform: 'api' as const, status: 'active' as const, description: 'REST API for lab results', techStack: ['Node.js', 'Express', 'PostgreSQL'], repoUrls: [] },
    { clientId: clientIds['Oakwood Properties'], name: 'Tenant Portal', platform: 'web' as const, status: 'active' as const, description: 'Property management tenant-facing app', techStack: ['Next.js', 'Prisma'], repoUrls: [] },
    { clientId: clientIds['Priya Sharma'], name: 'Sparkline Dashboard', platform: 'web' as const, status: 'development' as const, description: 'Analytics dashboard MVP', techStack: ['React', 'D3.js', 'Supabase'], repoUrls: [] },
    { clientId: clientIds['River City Brewing'], name: 'Taproom POS', platform: 'ios' as const, status: 'active' as const, description: 'iPad point-of-sale for taproom', techStack: ['SwiftUI', 'CloudKit'], repoUrls: [] },
    { clientId: clientIds['Atlas Digital'], name: 'Agency Site', platform: 'web' as const, status: 'active' as const, description: 'Marketing site with CMS', techStack: ['Astro', 'Tailwind', 'Sanity'], repoUrls: [] },
  ];

  for (const a of appDefs) {
    const id = await createApp(a);
    appIds[a.name] = id;
    console.log(`  ✓ App: ${a.name}`);
  }

  // ── Work Items ───────────────────────────────
  const workItemDefs = [
    // Meridian Labs — active project
    { type: 'featureRequest' as const, status: 'completed' as const, clientId: clientIds['Meridian Labs'], appId: appIds['Patient Portal'], subject: 'Add appointment scheduling module', lineItems: [{ id: '1', description: 'Calendar UI component', hours: 8, cost: 1200 }, { id: '2', description: 'Booking API integration', hours: 6, cost: 900 }], totalHours: 14, totalCost: 2100, isBillable: true, sourceEmail: '', invoiceStatus: 'paid' as const, invoicePaidDate: daysAgo(5), invoiceSentDate: daysAgo(12), invoiceDueDate: daysAgo(2) },
    { type: 'changeRequest' as const, status: 'approved' as const, clientId: clientIds['Meridian Labs'], appId: appIds['Patient Portal'], subject: 'Redesign patient intake form', lineItems: [{ id: '1', description: 'Form redesign + validation', hours: 5, cost: 750 }], totalHours: 5, totalCost: 750, isBillable: true, sourceEmail: '', invoiceStatus: 'sent' as const, invoiceSentDate: daysAgo(3), invoiceDueDate: futureDate(27) },
    { type: 'maintenance' as const, status: 'draft' as const, clientId: clientIds['Meridian Labs'], appId: appIds['Lab API'], subject: 'Quarterly security patches', lineItems: [{ id: '1', description: 'Dependency updates + audit', hours: 3, cost: 450 }], totalHours: 3, totalCost: 450, isBillable: true, sourceEmail: 'Routine quarterly maintenance', recurrence: { frequency: 'quarterly' as const } },
    { type: 'changeRequest' as const, status: 'inReview' as const, clientId: clientIds['Meridian Labs'], appId: appIds['Lab API'], subject: 'Add PDF export for lab results', lineItems: [{ id: '1', description: 'PDF generation service', hours: 4, cost: 600 }], totalHours: 4, totalCost: 600, isBillable: true, sourceEmail: '' },

    // Oakwood Properties
    { type: 'featureRequest' as const, status: 'completed' as const, clientId: clientIds['Oakwood Properties'], appId: appIds['Tenant Portal'], subject: 'Online rent payment integration', lineItems: [{ id: '1', description: 'Stripe Connect setup', hours: 10, cost: 1500 }, { id: '2', description: 'Payment UI + receipts', hours: 8, cost: 1200 }], totalHours: 18, totalCost: 2700, isBillable: true, sourceEmail: '', invoiceStatus: 'paid' as const, invoicePaidDate: daysAgo(20), invoiceSentDate: daysAgo(30), invoiceDueDate: daysAgo(15) },
    { type: 'changeRequest' as const, status: 'completed' as const, clientId: clientIds['Oakwood Properties'], appId: appIds['Tenant Portal'], subject: 'Maintenance request portal', lineItems: [{ id: '1', description: 'Request form + photo upload', hours: 6, cost: 900 }, { id: '2', description: 'Admin dashboard view', hours: 4, cost: 600 }], totalHours: 10, totalCost: 1500, isBillable: true, sourceEmail: '', invoiceStatus: 'sent' as const, invoiceSentDate: daysAgo(2), invoiceDueDate: futureDate(28) },
    { type: 'maintenance' as const, status: 'draft' as const, clientId: clientIds['Oakwood Properties'], appId: appIds['Tenant Portal'], subject: 'Monthly hosting review', lineItems: [{ id: '1', description: 'Infrastructure check + optimization', hours: 2, cost: 300 }], totalHours: 2, totalCost: 300, isBillable: true, sourceEmail: '', recurrence: { frequency: 'monthly' as const } },

    // Priya Sharma / Sparkline
    { type: 'featureRequest' as const, status: 'approved' as const, clientId: clientIds['Priya Sharma'], appId: appIds['Sparkline Dashboard'], subject: 'Build MVP analytics dashboard', lineItems: [{ id: '1', description: 'Data pipeline setup', hours: 12, cost: 1800 }, { id: '2', description: 'Chart components', hours: 8, cost: 1200 }, { id: '3', description: 'Auth + user management', hours: 6, cost: 900 }], totalHours: 26, totalCost: 3900, isBillable: true, sourceEmail: 'Phase 1 of the Sparkline platform build', scheduledDate: futureDate(3) },
    { type: 'changeRequest' as const, status: 'draft' as const, clientId: clientIds['Priya Sharma'], appId: appIds['Sparkline Dashboard'], subject: 'Add data export (CSV/PDF)', lineItems: [{ id: '1', description: 'Export service', hours: 4, cost: 600 }], totalHours: 4, totalCost: 600, isBillable: true, sourceEmail: '' },

    // River City Brewing
    { type: 'featureRequest' as const, status: 'completed' as const, clientId: clientIds['River City Brewing'], appId: appIds['Taproom POS'], subject: 'Loyalty program integration', lineItems: [{ id: '1', description: 'Loyalty card scanner', hours: 6, cost: 900 }, { id: '2', description: 'Points tracking + rewards', hours: 8, cost: 1200 }], totalHours: 14, totalCost: 2100, isBillable: true, sourceEmail: '', invoiceStatus: 'paid' as const, invoicePaidDate: daysAgo(10), invoiceSentDate: daysAgo(18), invoiceDueDate: daysAgo(3) },
    { type: 'maintenance' as const, status: 'inReview' as const, clientId: clientIds['River City Brewing'], appId: appIds['Taproom POS'], subject: 'iOS 18 compatibility update', lineItems: [{ id: '1', description: 'SwiftUI migration + testing', hours: 5, cost: 750 }], totalHours: 5, totalCost: 750, isBillable: true, sourceEmail: 'Need this before the fall rollout' },

    // Atlas Digital
    { type: 'changeRequest' as const, status: 'completed' as const, clientId: clientIds['Atlas Digital'], appId: appIds['Agency Site'], subject: 'Case studies section redesign', lineItems: [{ id: '1', description: 'Design + implementation', hours: 8, cost: 1200 }], totalHours: 8, totalCost: 1200, isBillable: true, sourceEmail: '', invoiceStatus: 'draft' as const },
    { type: 'featureRequest' as const, status: 'draft' as const, clientId: clientIds['Atlas Digital'], appId: appIds['Agency Site'], subject: 'Blog CMS integration', lineItems: [{ id: '1', description: 'Sanity schema + components', hours: 10, cost: 1500 }], totalHours: 10, totalCost: 1500, isBillable: true, sourceEmail: '' },

    // Non-billable internal
    { type: 'maintenance' as const, status: 'completed' as const, clientId: clientIds['Meridian Labs'], subject: 'Internal tooling improvements', lineItems: [{ id: '1', description: 'CI/CD pipeline updates', hours: 3, cost: 0 }], totalHours: 3, totalCost: 0, isBillable: false, sourceEmail: '' },
  ];

  for (const wi of workItemDefs) {
    await createWorkItem(wi);
    console.log(`  ✓ Work Item: ${wi.subject}`);
  }

  // ── Time Entries ─────────────────────────────
  const timeEntryDefs = [
    { clientId: clientIds['Meridian Labs'], appId: appIds['Patient Portal'], description: 'Appointment calendar UI', durationSeconds: 3 * 3600 + 1200, isBillable: true, startedAt: daysAgo(1), endedAt: hoursAfter(daysAgo(1), 3.33) },
    { clientId: clientIds['Meridian Labs'], appId: appIds['Patient Portal'], description: 'Booking API hookup', durationSeconds: 2 * 3600 + 2700, isBillable: true, startedAt: daysAgo(1), endedAt: hoursAfter(daysAgo(1), 2.75) },
    { clientId: clientIds['Meridian Labs'], appId: appIds['Lab API'], description: 'PDF export spike', durationSeconds: 1 * 3600 + 1800, isBillable: true, startedAt: daysAgo(2), endedAt: hoursAfter(daysAgo(2), 1.5) },
    { clientId: clientIds['Oakwood Properties'], appId: appIds['Tenant Portal'], description: 'Stripe webhook debugging', durationSeconds: 2 * 3600, isBillable: true, startedAt: daysAgo(2), endedAt: hoursAfter(daysAgo(2), 2) },
    { clientId: clientIds['Oakwood Properties'], appId: appIds['Tenant Portal'], description: 'Maintenance request form', durationSeconds: 4 * 3600 + 900, isBillable: true, startedAt: daysAgo(3), endedAt: hoursAfter(daysAgo(3), 4.25) },
    { clientId: clientIds['Priya Sharma'], appId: appIds['Sparkline Dashboard'], description: 'Data pipeline architecture', durationSeconds: 3 * 3600, isBillable: true, startedAt: daysAgo(3), endedAt: hoursAfter(daysAgo(3), 3) },
    { clientId: clientIds['Priya Sharma'], appId: appIds['Sparkline Dashboard'], description: 'Chart component prototyping', durationSeconds: 5 * 3600 + 1800, isBillable: true, startedAt: daysAgo(4), endedAt: hoursAfter(daysAgo(4), 5.5) },
    { clientId: clientIds['River City Brewing'], appId: appIds['Taproom POS'], description: 'Loyalty scanner integration', durationSeconds: 3 * 3600 + 2400, isBillable: true, startedAt: daysAgo(4), endedAt: hoursAfter(daysAgo(4), 3.67) },
    { clientId: clientIds['River City Brewing'], appId: appIds['Taproom POS'], description: 'Points system backend', durationSeconds: 2 * 3600 + 3600, isBillable: true, startedAt: daysAgo(5), endedAt: hoursAfter(daysAgo(5), 3) },
    { clientId: clientIds['Atlas Digital'], appId: appIds['Agency Site'], description: 'Case studies layout', durationSeconds: 4 * 3600, isBillable: true, startedAt: daysAgo(5), endedAt: hoursAfter(daysAgo(5), 4) },
    { clientId: clientIds['Atlas Digital'], appId: appIds['Agency Site'], description: 'CMS schema design', durationSeconds: 2 * 3600, isBillable: true, startedAt: daysAgo(6), endedAt: hoursAfter(daysAgo(6), 2) },
    { clientId: clientIds['Meridian Labs'], description: 'Internal CI/CD cleanup', durationSeconds: 1 * 3600 + 2700, isBillable: false, startedAt: daysAgo(6), endedAt: hoursAfter(daysAgo(6), 1.75) },
    { clientId: clientIds['Meridian Labs'], appId: appIds['Patient Portal'], description: 'Code review + PR feedback', durationSeconds: 1 * 3600, isBillable: true, startedAt: daysAgo(0), endedAt: hoursAfter(daysAgo(0), 1) },
    { clientId: clientIds['Priya Sharma'], appId: appIds['Sparkline Dashboard'], description: 'Auth flow implementation', durationSeconds: 2 * 3600 + 1800, isBillable: true, startedAt: daysAgo(0), endedAt: hoursAfter(daysAgo(0), 2.5) },
  ];

  for (const te of timeEntryDefs) {
    await createTimeEntry(te);
    console.log(`  ✓ Time Entry: ${te.description}`);
  }

  // ── Expenses ─────────────────────────────────
  const expenseDefs = [
    { description: 'Vercel Pro — March', amount: 20, category: 'Software & Subscriptions', date: daysAgo(5), taxDeductible: true },
    { description: 'GitHub Team', amount: 44, category: 'Software & Subscriptions', date: daysAgo(8), taxDeductible: true },
    { description: 'Figma Professional', amount: 15, category: 'Software & Subscriptions', date: daysAgo(12), taxDeductible: true },
    { description: 'Adobe Creative Cloud', amount: 59.99, category: 'Software & Subscriptions', date: daysAgo(15), taxDeductible: true },
    { description: 'Coworking day pass — WeWork', amount: 35, category: 'Office Supplies', date: daysAgo(3), taxDeductible: true },
    { description: 'USB-C hub + cables', amount: 78.50, category: 'Equipment & Tools', date: daysAgo(18), taxDeductible: true },
    { description: 'Client lunch — Priya (Sparkline kickoff)', amount: 62.40, category: 'Meals & Entertainment', date: daysAgo(10), taxDeductible: true },
    { description: 'AWS hosting — Lab API', amount: 47.23, category: 'Software & Subscriptions', date: daysAgo(2), taxDeductible: true },
    { description: 'Udemy — Advanced TypeScript', amount: 13.99, category: 'Education & Training', date: daysAgo(22), taxDeductible: true },
    { description: 'Postmark email service', amount: 15, category: 'Software & Subscriptions', date: daysAgo(7), taxDeductible: true },
  ];

  for (const exp of expenseDefs) {
    await createManualExpense(exp);
    console.log(`  ✓ Expense: ${exp.description}`);
  }

  // ── Mileage Trips ────────────────────────────
  const mileageDefs = [
    { date: daysAgo(1), description: 'Client meeting — Meridian Labs office', miles: 12.4, purpose: 'business' as const, clientId: clientIds['Meridian Labs'], roundTrip: true, rate: 0.70 },
    { date: daysAgo(3), description: 'Taproom walkthrough — River City', miles: 8.2, purpose: 'business' as const, clientId: clientIds['River City Brewing'], roundTrip: true, rate: 0.70 },
    { date: daysAgo(5), description: 'Coworking — WeWork', miles: 5.1, purpose: 'business' as const, roundTrip: true, rate: 0.70 },
    { date: daysAgo(8), description: 'Equipment pickup — Best Buy', miles: 6.8, purpose: 'business' as const, roundTrip: false, rate: 0.70 },
    { date: daysAgo(12), description: 'Sparkline kickoff lunch', miles: 9.3, purpose: 'business' as const, clientId: clientIds['Priya Sharma'], roundTrip: true, rate: 0.70 },
    { date: daysAgo(14), description: 'Oakwood property site visit', miles: 18.5, purpose: 'business' as const, clientId: clientIds['Oakwood Properties'], roundTrip: true, rate: 0.70 },
  ];

  for (const trip of mileageDefs) {
    await createMileageTrip(trip);
    console.log(`  ✓ Mileage: ${trip.description}`);
  }

  console.log('\n✅ Seed complete! Refresh the page to see your data.');
}
