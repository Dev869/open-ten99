import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

const SCHEDULE_TZ = "America/New_York";

/**
 * "Now" as a calendar date in the scheduler's timezone. The scheduler fires at
 * 06:00 America/New_York but `new Date()` on GCP is UTC, so a naive
 * `now.getDate()` can be a day off near midnight, firing invoices early/late.
 */
function nowInScheduleTz(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // Noon avoids any DST/boundary ambiguity for date-only math.
  return new Date(get("year"), get("month") - 1, get("day"), 12, 0, 0);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(renewalDay: number, year: number, month: number): number {
  return Math.min(renewalDay, lastDayOfMonth(year, month));
}

function getRetainerPeriodStart(renewalDay: number, now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  if (today >= clampDay(renewalDay, year, month)) {
    return new Date(year, month, clampDay(renewalDay, year, month));
  }
  const prev = new Date(year, month - 1, 1);
  return new Date(
    prev.getFullYear(),
    prev.getMonth(),
    clampDay(renewalDay, prev.getFullYear(), prev.getMonth()),
  );
}

function getRetainerPeriodEnd(renewalDay: number, now: Date): Date {
  const start = getRetainerPeriodStart(renewalDay, now);
  // Day before the next period's clamped start — no JS month overflow.
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const nextStart = new Date(
    next.getFullYear(),
    next.getMonth(),
    clampDay(renewalDay, next.getFullYear(), next.getMonth()),
  );
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return end;
}

/** Deterministic doc ID so concurrent/retried runs can't double-create. */
function retainerInvoiceId(ownerId: string, clientId: string, periodStart: Date): string {
  return `retainer_${ownerId}_${clientId}_${periodStart.toISOString().slice(0, 10)}`;
}

export const generateRetainerInvoices = onSchedule(
  { schedule: "every day 06:00", timeZone: SCHEDULE_TZ },
  async () => {
    const now = nowInScheduleTz();
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
        // When the work was done: scheduledDate if set, else createdAt.
        // updatedAt would wrongly include/exclude items edited after the period.
        const when = wi.scheduledDate?.toDate?.() ?? wi.createdAt?.toDate?.() ?? new Date(0);
        if (when < periodStart || when > periodEnd) continue;

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

      // Deterministic ID + create() makes concurrent/retried scheduler runs
      // idempotent (the prior read-then-add could double-create on retry).
      const invoiceId = retainerInvoiceId(ownerId, clientDoc.id, periodStart);
      try {
        await db.collection("workItems").doc(invoiceId).create({
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
      } catch (e: unknown) {
        // 6 = ALREADY_EXISTS — another run won the race; safe to skip.
        if ((e as { code?: number }).code === 6) {
          logger.info("Retainer invoice already exists (race-safe skip)", { clientId: clientDoc.id });
          continue;
        }
        throw e;
      }

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

  const now = nowInScheduleTz();
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
    // When the work was done: scheduledDate if set, else createdAt.
    const when = wi.scheduledDate?.toDate?.() ?? wi.createdAt?.toDate?.() ?? new Date(0);
    if (when < periodStart || when > periodEnd) continue;

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

  const invoiceId = retainerInvoiceId(ownerId, clientDocId, periodStart);
  try {
    await db.collection("workItems").doc(invoiceId).create({
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
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 6) {
      throw new HttpsError("already-exists", "Retainer invoice already exists for this period");
    }
    throw e;
  }

  logger.info("Manually generated retainer invoice", { clientId: clientDocId, docId: invoiceId });
  return invoiceId;
}

export const generateRetainerInvoiceManual = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
  const { clientId } = request.data as { clientId: string };
  if (!clientId) throw new HttpsError("invalid-argument", "Missing clientId");
  const docId = await generateForClient(clientId, request.auth.uid);
  return { success: true, workItemId: docId };
});
