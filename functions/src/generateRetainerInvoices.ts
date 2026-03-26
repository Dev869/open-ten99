import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

function getRetainerPeriodStart(renewalDay: number, now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const clampedDay = Math.min(renewalDay, new Date(year, month + 1, 0).getDate());

  if (today >= clampedDay) {
    return new Date(year, month, clampedDay);
  }
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(renewalDay, prevMonthLastDay));
}

function getRetainerPeriodEnd(renewalDay: number, now: Date): Date {
  const start = getRetainerPeriodStart(renewalDay, now);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return end;
}

export const generateRetainerInvoices = onSchedule(
  { schedule: "every day 06:00", timeZone: "America/New_York" },
  async () => {
    const now = new Date();
    const today = now.getDate();

    logger.info("Running retainer invoice generation", { today });

    const clientsSnap = await db.collection("clients")
      .where("retainerPaused", "!=", true)
      .get();

    let generated = 0;

    for (const clientDoc of clientsSnap.docs) {
      const client = clientDoc.data();

      if (!client.retainerHours || client.retainerHours <= 0) continue;
      if (!client.retainerBillingMode) continue;

      const renewalDay = client.retainerRenewalDay ?? 1;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const effectiveRenewalDay = Math.min(renewalDay, daysInMonth);

      if (today !== effectiveRenewalDay) continue;

      const ownerId = client.ownerId;
      if (!ownerId) continue;

      const periodStart = getRetainerPeriodStart(renewalDay, now);
      const periodEnd = getRetainerPeriodEnd(renewalDay, now);

      // Prevent duplicates
      const existingSnap = await db.collection("workItems")
        .where("ownerId", "==", ownerId)
        .where("clientId", "==", clientDoc.id)
        .where("isRetainerInvoice", "==", true)
        .where("retainerPeriodStart", "==", admin.firestore.Timestamp.fromDate(periodStart))
        .get();

      if (!existingSnap.empty) {
        logger.info("Retainer invoice already exists", { clientId: clientDoc.id });
        continue;
      }

      const settingsDoc = await db.collection("settings").doc(ownerId).get();
      const hourlyRate = settingsDoc.exists ? (settingsDoc.data()?.hourlyRate ?? 25) : 25;

      const periodLabel = periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const lineItems: Array<{ id: string; description: string; hours: number; cost: number }> = [];
      let usedHours = 0;

      // Get retainer work items in period
      const workItemsSnap = await db.collection("workItems")
        .where("ownerId", "==", ownerId)
        .where("clientId", "==", clientDoc.id)
        .where("deductFromRetainer", "==", true)
        .get();

      for (const wiDoc of workItemsSnap.docs) {
        const wi = wiDoc.data();
        if (wi.status === "draft" || wi.isRetainerInvoice) continue;
        const updatedAt = wi.updatedAt?.toDate?.() ?? new Date(0);
        if (updatedAt < periodStart || updatedAt > periodEnd) continue;

        if (client.retainerBillingMode === "usage") {
          const wiLineItems = wi.lineItems ?? [];
          for (const li of wiLineItems) {
            lineItems.push({
              id: crypto.randomUUID(),
              description: li.description ?? "(no description)",
              hours: li.hours ?? 0,
              cost: li.cost ?? 0,
            });
          }
        }
        usedHours += wi.totalHours ?? 0;
      }

      if (client.retainerBillingMode === "flat") {
        lineItems.push({
          id: crypto.randomUUID(),
          description: `Monthly Retainer — ${periodLabel}`,
          hours: client.retainerHours,
          cost: client.retainerFlatRate ?? 0,
        });
      }

      // Overage
      const overageHours = Math.max(0, usedHours - client.retainerHours);
      if (overageHours > 0) {
        lineItems.push({
          id: crypto.randomUUID(),
          description: `Overage — ${overageHours.toFixed(1)} hrs beyond retainer @ $${hourlyRate}/hr`,
          hours: overageHours,
          cost: overageHours * hourlyRate,
        });
      }

      const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);
      const totalCost = lineItems.reduce((sum, li) => sum + li.cost, 0);

      const subject = client.retainerBillingMode === "flat"
        ? `Monthly Retainer — ${periodLabel}`
        : `Retainer Usage — ${periodLabel}`;

      const nowTimestamp = admin.firestore.Timestamp.now();

      await db.collection("workItems").add({
        type: "maintenance",
        status: "completed",
        clientId: clientDoc.id,
        ownerId,
        subject,
        sourceEmail: "",
        lineItems,
        totalHours,
        totalCost,
        isBillable: true,
        deductFromRetainer: true,
        invoiceStatus: "draft",
        isRetainerInvoice: true,
        retainerPeriodStart: admin.firestore.Timestamp.fromDate(periodStart),
        retainerPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        retainerOverageHours: overageHours > 0 ? overageHours : null,
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
      });

      generated++;
      logger.info("Generated retainer invoice draft", {
        clientId: clientDoc.id,
        clientName: client.name,
        mode: client.retainerBillingMode,
        totalCost,
        overageHours,
      });
    }

    logger.info("Retainer invoice generation complete", { generated });
  }
);

/* ── Manual trigger (callable from the app) ─────────────── */

async function generateForClient(clientDocId: string, ownerId: string): Promise<string> {
  const clientDoc = await db.collection("clients").doc(clientDocId).get();
  if (!clientDoc.exists) throw new HttpsError("not-found", "Client not found");

  const client = clientDoc.data()!;
  if (client.ownerId !== ownerId) throw new HttpsError("permission-denied", "Not your client");
  if (!client.retainerHours || client.retainerHours <= 0) throw new HttpsError("failed-precondition", "Client has no retainer hours");
  if (!client.retainerBillingMode) throw new HttpsError("failed-precondition", "Client has no billing mode configured");
  if (client.retainerPaused) throw new HttpsError("failed-precondition", "Client retainer is paused");

  const now = new Date();
  const renewalDay = client.retainerRenewalDay ?? 1;
  const periodStart = getRetainerPeriodStart(renewalDay, now);
  const periodEnd = getRetainerPeriodEnd(renewalDay, now);

  // Duplicate check
  const existingSnap = await db.collection("workItems")
    .where("ownerId", "==", ownerId)
    .where("clientId", "==", clientDocId)
    .where("isRetainerInvoice", "==", true)
    .where("retainerPeriodStart", "==", admin.firestore.Timestamp.fromDate(periodStart))
    .get();

  if (!existingSnap.empty) throw new HttpsError("already-exists", "Retainer invoice already exists for this period");

  const settingsDoc = await db.collection("settings").doc(ownerId).get();
  const hourlyRate = settingsDoc.exists ? (settingsDoc.data()?.hourlyRate ?? 25) : 25;
  const periodLabel = periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const lineItems: Array<{ id: string; description: string; hours: number; cost: number }> = [];
  let usedHours = 0;

  const workItemsSnap = await db.collection("workItems")
    .where("ownerId", "==", ownerId)
    .where("clientId", "==", clientDocId)
    .where("deductFromRetainer", "==", true)
    .get();

  for (const wiDoc of workItemsSnap.docs) {
    const wi = wiDoc.data();
    if (wi.status === "draft" || wi.isRetainerInvoice) continue;
    const updatedAt = wi.updatedAt?.toDate?.() ?? new Date(0);
    if (updatedAt < periodStart || updatedAt > periodEnd) continue;

    if (client.retainerBillingMode === "usage") {
      for (const li of (wi.lineItems ?? [])) {
        lineItems.push({
          id: crypto.randomUUID(),
          description: li.description ?? "(no description)",
          hours: li.hours ?? 0,
          cost: li.cost ?? 0,
        });
      }
    }
    usedHours += wi.totalHours ?? 0;
  }

  if (client.retainerBillingMode === "flat") {
    lineItems.push({
      id: crypto.randomUUID(),
      description: `Monthly Retainer — ${periodLabel}`,
      hours: client.retainerHours,
      cost: client.retainerFlatRate ?? 0,
    });
  }

  const overageHours = Math.max(0, usedHours - client.retainerHours);
  if (overageHours > 0) {
    lineItems.push({
      id: crypto.randomUUID(),
      description: `Overage — ${overageHours.toFixed(1)} hrs beyond retainer @ $${hourlyRate}/hr`,
      hours: overageHours,
      cost: overageHours * hourlyRate,
    });
  }

  const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);
  const totalCost = lineItems.reduce((sum, li) => sum + li.cost, 0);
  const subject = client.retainerBillingMode === "flat"
    ? `Monthly Retainer — ${periodLabel}`
    : `Retainer Usage — ${periodLabel}`;

  const nowTimestamp = admin.firestore.Timestamp.now();

  const docRef = await db.collection("workItems").add({
    type: "maintenance",
    status: "completed",
    clientId: clientDocId,
    ownerId,
    subject,
    sourceEmail: "",
    lineItems,
    totalHours,
    totalCost,
    isBillable: true,
    deductFromRetainer: true,
    invoiceStatus: "draft",
    isRetainerInvoice: true,
    retainerPeriodStart: admin.firestore.Timestamp.fromDate(periodStart),
    retainerPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
    retainerOverageHours: overageHours > 0 ? overageHours : null,
    createdAt: nowTimestamp,
    updatedAt: nowTimestamp,
  });

  logger.info("Manually generated retainer invoice", { clientId: clientDocId, docId: docRef.id });
  return docRef.id;
}

export const generateRetainerInvoiceManual = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
  const { clientId } = request.data as { clientId: string };
  if (!clientId) throw new HttpsError("invalid-argument", "Missing clientId");
  const docId = await generateForClient(clientId, request.auth.uid);
  return { success: true, workItemId: docId };
});
