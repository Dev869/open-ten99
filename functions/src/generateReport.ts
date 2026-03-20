import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType =
  | "pnl"
  | "incomeByClient"
  | "taxSummary"
  | "hoursBilling"
  | "aging"
  | "expenses";

interface ReportRequest {
  reportType?: ReportType;
  startDate?: string; // ISO date string e.g. "2025-01-01"
  endDate?: string;   // ISO date string e.g. "2025-12-31"
}

interface WorkItemDoc {
  clientId: string;
  subject: string;
  lineItems: Array<{ description: string; hours: number; cost: number }>;
  totalHours: number;
  totalCost: number;
  isBillable: boolean;
  status: string;
  type: string;
  invoiceStatus?: string;
  invoiceSentDate?: admin.firestore.Timestamp;
  invoiceDueDate?: admin.firestore.Timestamp;
  invoicePaidDate?: admin.firestore.Timestamp;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  ownerId?: string;
}

interface ClientDoc {
  name: string;
  company?: string;
}

// ─── Page Layout Constants ────────────────────────────────────────────────────

const PAGE_WIDTH = 612;  // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 16;
const ROW_HEIGHT = 20;
const FOOTER_RESERVE = 60; // space to reserve for footer at bottom

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLOR_DARK = rgb(0.15, 0.15, 0.15);
const COLOR_GRAY = rgb(0.4, 0.4, 0.4);
const COLOR_ACCENT = rgb(0.2, 0.4, 0.7);
const COLOR_LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const COLOR_WHITE = rgb(1, 1, 1);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncateText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string {
  let current = text;
  while (
    font.widthOfTextAtSize(current, fontSize) > maxWidth &&
    current.length > 0
  ) {
    current = current.slice(0, -1);
  }
  if (current.length < text.length && current.length > 3) {
    current = current.slice(0, -3) + "...";
  }
  return current;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Filter work items to those whose createdAt falls within [start, end]. */
function filterByDateRange(
  items: Array<WorkItemDoc & { id: string }>,
  start: Date,
  end: Date
): Array<WorkItemDoc & { id: string }> {
  return items.filter((item) => {
    if (!item.createdAt) return false;
    const d = item.createdAt.toDate();
    return d >= start && d <= end;
  });
}

// ─── Page / Drawing Helpers ───────────────────────────────────────────────────

interface DrawContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  pageNumber: number;
  generatedAt: Date;
}

/** Start a new page, draw a header band, and reset y. */
async function newPage(ctx: DrawContext, title: string): Promise<DrawContext> {
  const page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const y = PAGE_HEIGHT - MARGIN;
  const pageNumber = ctx.pageNumber + 1;
  const newCtx = { ...ctx, page, y, pageNumber };
  return drawPageHeader(newCtx, title);
}

/** Draw the "OpenChanges" banner and report title at the top of a page. */
async function drawPageHeader(
  ctx: DrawContext,
  title: string
): Promise<DrawContext> {
  let { page, y, bold } = ctx;

  page.drawText("OpenChanges", {
    x: MARGIN,
    y,
    size: 18,
    font: bold,
    color: COLOR_ACCENT,
  });
  y -= 22;

  page.drawText(title, {
    x: MARGIN,
    y,
    size: 13,
    font: bold,
    color: COLOR_DARK,
  });
  y -= 20;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.5,
    color: COLOR_ACCENT,
  });
  y -= 20;

  return { ...ctx, page, y };
}

/** Draw a table header row (blue background, white text). */
function drawTableHeader(
  ctx: DrawContext,
  columns: Array<{ label: string; x: number; width: number }>
): DrawContext {
  let { page, y, bold } = ctx;

  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: CONTENT_WIDTH,
    height: 18,
    color: COLOR_ACCENT,
  });

  for (const col of columns) {
    const label = truncateText(col.label, bold, 10, col.width - 4);
    page.drawText(label, {
      x: col.x + 4,
      y,
      size: 10,
      font: bold,
      color: COLOR_WHITE,
    });
  }

  y -= 22;
  return { ...ctx, page, y };
}

/** Draw a single table row, adding a new page if needed. */
async function drawTableRow(
  ctx: DrawContext,
  cells: Array<{ text: string; x: number; width: number }>,
  rowIndex: number,
  title: string
): Promise<DrawContext> {
  let { page, y, regular, pdfDoc, bold, pageNumber, generatedAt } = ctx;

  if (y < MARGIN + FOOTER_RESERVE) {
    // Draw footer before page break
    drawFooter({ ...ctx, page, y }, pageNumber, generatedAt);
    const nextCtx = await newPage(
      { pdfDoc, page, y, regular, bold, pageNumber, generatedAt },
      title
    );
    page = nextCtx.page;
    y = nextCtx.y;
    pageNumber = nextCtx.pageNumber;
  }

  if (rowIndex % 2 === 0) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: CONTENT_WIDTH,
      height: ROW_HEIGHT,
      color: COLOR_LIGHT_GRAY,
    });
  }

  for (const cell of cells) {
    const text = truncateText(cell.text, regular, 10, cell.width - 8);
    page.drawText(text, {
      x: cell.x + 4,
      y,
      size: 10,
      font: regular,
      color: COLOR_DARK,
    });
  }

  y -= ROW_HEIGHT;
  return { ...ctx, page, y, pageNumber };
}

/** Draw a summary key-value line. */
function drawSummaryLine(
  ctx: DrawContext,
  label: string,
  value: string,
  isBold = false
): DrawContext {
  const { page, y, regular, bold } = ctx;
  const font = isBold ? bold : regular;
  page.drawText(label, { x: MARGIN, y, size: 10, font: bold, color: COLOR_GRAY });
  page.drawText(value, {
    x: MARGIN + 180,
    y,
    size: 10,
    font,
    color: isBold ? COLOR_ACCENT : COLOR_DARK,
  });
  return { ...ctx, page, y: y - LINE_HEIGHT };
}

/** Draw page footer (page number + generation date). */
function drawFooter(
  ctx: DrawContext,
  pageNumber: number,
  generatedAt: Date
): void {
  const { page, regular } = ctx;
  const footerY = MARGIN - 16;

  page.drawLine({
    start: { x: MARGIN, y: footerY + 12 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 12 },
    thickness: 0.5,
    color: COLOR_LIGHT_GRAY,
  });

  page.drawText(`Page ${pageNumber}`, {
    x: MARGIN,
    y: footerY,
    size: 8,
    font: regular,
    color: COLOR_GRAY,
  });

  page.drawText(`Generated ${formatDate(generatedAt)} · OpenChanges`, {
    x: PAGE_WIDTH - MARGIN - 160,
    y: footerY,
    size: 8,
    font: regular,
    color: COLOR_GRAY,
  });
}

/** Draw a date-range subheading below the page header. */
function drawDateRange(
  ctx: DrawContext,
  startDate: Date,
  endDate: Date
): DrawContext {
  const { page, regular, y } = ctx;
  page.drawText(
    `Period: ${formatDate(startDate)} – ${formatDate(endDate)}`,
    { x: MARGIN, y, size: 9, font: regular, color: COLOR_GRAY }
  );
  return { ...ctx, y: y - 18 };
}

// ─── Report Builders ──────────────────────────────────────────────────────────

/** P&L: Revenue by month over the date range. */
async function buildPnlReport(
  ctx: DrawContext,
  items: Array<WorkItemDoc & { id: string }>,
  startDate: Date,
  endDate: Date
): Promise<DrawContext> {
  const title = "Profit & Loss Summary";
  ctx = await drawPageHeader(ctx, title);
  ctx = drawDateRange(ctx, startDate, endDate);

  // Group by month
  const monthMap = new Map<string, number>();
  let totalRevenue = 0;

  for (const item of items) {
    if (!item.createdAt) continue;
    const d = item.createdAt.toDate();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    const mapKey = `${key}|${label}`;
    monthMap.set(mapKey, (monthMap.get(mapKey) ?? 0) + item.totalCost);
    totalRevenue += item.totalCost;
  }

  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // Summary box
  ctx = drawSummaryLine(ctx, "Total Revenue:", formatCurrency(totalRevenue), true);
  ctx = drawSummaryLine(ctx, "Work Orders:", String(items.length));
  ctx = { ...ctx, y: ctx.y - 12 };

  // Monthly table
  const cols = [
    { label: "Month", x: MARGIN, width: 200 },
    { label: "Revenue", x: MARGIN + 200, width: 150 },
    { label: "% of Total", x: MARGIN + 350, width: 100 },
  ];

  ctx = drawTableHeader(ctx, cols);

  for (let i = 0; i < sortedMonths.length; i++) {
    const [mapKey, revenue] = sortedMonths[i];
    const label = mapKey.split("|")[1];
    const pct = totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(1) + "%" : "—";

    ctx = await drawTableRow(
      ctx,
      [
        { text: label, x: cols[0].x, width: cols[0].width },
        { text: formatCurrency(revenue), x: cols[1].x, width: cols[1].width },
        { text: pct, x: cols[2].x, width: cols[2].width },
      ],
      i,
      title
    );
  }

  return ctx;
}

/** Income by Client: Total paid and work order count per client. */
async function buildIncomeByClientReport(
  ctx: DrawContext,
  items: Array<WorkItemDoc & { id: string }>,
  clients: Map<string, ClientDoc>,
  startDate: Date,
  endDate: Date
): Promise<DrawContext> {
  const title = "Income by Client";
  ctx = await drawPageHeader(ctx, title);
  ctx = drawDateRange(ctx, startDate, endDate);

  // Aggregate by clientId
  const clientMap = new Map<
    string,
    { name: string; total: number; count: number }
  >();

  for (const item of items) {
    const client = clients.get(item.clientId);
    const name = client
      ? client.company
        ? `${client.name} (${client.company})`
        : client.name
      : "Unknown Client";

    const existing = clientMap.get(item.clientId);
    if (existing) {
      existing.total += item.totalCost;
      existing.count += 1;
    } else {
      clientMap.set(item.clientId, { name, total: item.totalCost, count: 1 });
    }
  }

  const rows = Array.from(clientMap.values()).sort((a, b) => b.total - a.total);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  ctx = drawSummaryLine(ctx, "Grand Total:", formatCurrency(grandTotal), true);
  ctx = drawSummaryLine(ctx, "Total Clients:", String(rows.length));
  ctx = { ...ctx, y: ctx.y - 12 };

  const cols = [
    { label: "Client", x: MARGIN, width: 220 },
    { label: "Work Orders", x: MARGIN + 220, width: 100 },
    { label: "Total Billed", x: MARGIN + 320, width: 120 },
    { label: "% of Revenue", x: MARGIN + 440, width: 72 },
  ];

  ctx = drawTableHeader(ctx, cols);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const pct =
      grandTotal > 0
        ? ((row.total / grandTotal) * 100).toFixed(1) + "%"
        : "—";

    ctx = await drawTableRow(
      ctx,
      [
        { text: row.name, x: cols[0].x, width: cols[0].width },
        { text: String(row.count), x: cols[1].x, width: cols[1].width },
        { text: formatCurrency(row.total), x: cols[2].x, width: cols[2].width },
        { text: pct, x: cols[3].x, width: cols[3].width },
      ],
      i,
      title
    );
  }

  return ctx;
}

/** Tax Summary: Annual income by client for 1099 reporting. */
async function buildTaxSummaryReport(
  ctx: DrawContext,
  items: Array<WorkItemDoc & { id: string }>,
  clients: Map<string, ClientDoc>,
  startDate: Date,
  endDate: Date
): Promise<DrawContext> {
  const title = "Tax Summary (1099 Preparation)";
  ctx = await drawPageHeader(ctx, title);
  ctx = drawDateRange(ctx, startDate, endDate);

  const annualTotal = items.reduce((s, i) => s + i.totalCost, 0);
  const threshold1099 = 600;

  ctx = drawSummaryLine(ctx, "Gross Income:", formatCurrency(annualTotal), true);
  ctx = drawSummaryLine(
    ctx,
    "1099 Threshold:",
    `${formatCurrency(threshold1099)} (clients at or above this amount)`
  );
  ctx = { ...ctx, y: ctx.y - 12 };

  // Build per-client totals
  const clientMap = new Map<string, { name: string; total: number }>();
  for (const item of items) {
    const client = clients.get(item.clientId);
    const name = client ? client.name : "Unknown Client";
    const existing = clientMap.get(item.clientId);
    if (existing) {
      existing.total += item.totalCost;
    } else {
      clientMap.set(item.clientId, { name, total: item.totalCost });
    }
  }

  const rows = Array.from(clientMap.values())
    .sort((a, b) => b.total - a.total);

  const cols = [
    { label: "Client / Payer", x: MARGIN, width: 260 },
    { label: "Total Paid", x: MARGIN + 260, width: 140 },
    { label: "Requires 1099", x: MARGIN + 400, width: 112 },
  ];

  ctx = drawTableHeader(ctx, cols);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const requires1099 = row.total >= threshold1099 ? "Yes" : "No";

    ctx = await drawTableRow(
      ctx,
      [
        { text: row.name, x: cols[0].x, width: cols[0].width },
        { text: formatCurrency(row.total), x: cols[1].x, width: cols[1].width },
        { text: requires1099, x: cols[2].x, width: cols[2].width },
      ],
      i,
      title
    );
  }

  return ctx;
}

/** Hours & Billing: Total hours, billable hours, effective rate, by type. */
async function buildHoursBillingReport(
  ctx: DrawContext,
  items: Array<WorkItemDoc & { id: string }>,
  startDate: Date,
  endDate: Date
): Promise<DrawContext> {
  const title = "Hours & Billing";
  ctx = await drawPageHeader(ctx, title);
  ctx = drawDateRange(ctx, startDate, endDate);

  const totalHours = items.reduce((s, i) => s + i.totalHours, 0);
  const billableItems = items.filter((i) => i.isBillable);
  const billableHours = billableItems.reduce((s, i) => s + i.totalHours, 0);
  const totalRevenue = items.reduce((s, i) => s + i.totalCost, 0);
  const effectiveRate =
    billableHours > 0 ? totalRevenue / billableHours : 0;

  ctx = drawSummaryLine(ctx, "Total Hours:", totalHours.toFixed(1));
  ctx = drawSummaryLine(ctx, "Billable Hours:", billableHours.toFixed(1));
  ctx = drawSummaryLine(ctx, "Non-Billable Hours:", (totalHours - billableHours).toFixed(1));
  ctx = drawSummaryLine(ctx, "Total Revenue:", formatCurrency(totalRevenue));
  ctx = drawSummaryLine(ctx, "Effective Rate:", `${formatCurrency(effectiveRate)}/hr`, true);
  ctx = { ...ctx, y: ctx.y - 12 };

  // Group by work item type
  const typeMap = new Map<string, { hours: number; revenue: number; count: number }>();
  for (const item of items) {
    const type = item.type ?? "Unknown";
    const existing = typeMap.get(type);
    if (existing) {
      existing.hours += item.totalHours;
      existing.revenue += item.totalCost;
      existing.count += 1;
    } else {
      typeMap.set(type, { hours: item.totalHours, revenue: item.totalCost, count: 1 });
    }
  }

  const typeLabels: Record<string, string> = {
    changeRequest: "Change Request",
    featureRequest: "Feature Request",
    maintenance: "Maintenance",
  };

  const rows = Array.from(typeMap.entries()).sort((a, b) =>
    b[1].hours - a[1].hours
  );

  const cols = [
    { label: "Type", x: MARGIN, width: 180 },
    { label: "Work Orders", x: MARGIN + 180, width: 100 },
    { label: "Hours", x: MARGIN + 280, width: 80 },
    { label: "Revenue", x: MARGIN + 360, width: 110 },
    { label: "Avg Rate", x: MARGIN + 470, width: 42 },
  ];

  ctx = drawTableHeader(ctx, cols);

  for (let i = 0; i < rows.length; i++) {
    const [type, data] = rows[i];
    const label = typeLabels[type] ?? type;
    const avgRate = data.hours > 0 ? data.revenue / data.hours : 0;

    ctx = await drawTableRow(
      ctx,
      [
        { text: label, x: cols[0].x, width: cols[0].width },
        { text: String(data.count), x: cols[1].x, width: cols[1].width },
        { text: data.hours.toFixed(1), x: cols[2].x, width: cols[2].width },
        { text: formatCurrency(data.revenue), x: cols[3].x, width: cols[3].width },
        { text: `$${avgRate.toFixed(0)}/h`, x: cols[4].x, width: cols[4].width },
      ],
      i,
      title
    );
  }

  return ctx;
}

/** Aging: Outstanding invoices, days past due. */
async function buildAgingReport(
  ctx: DrawContext,
  items: Array<WorkItemDoc & { id: string }>,
  clients: Map<string, ClientDoc>,
  startDate: Date,
  endDate: Date
): Promise<DrawContext> {
  const title = "Invoice Aging";
  ctx = await drawPageHeader(ctx, title);
  ctx = drawDateRange(ctx, startDate, endDate);

  const today = new Date();

  // Only items that have been sent but not paid
  const agingItems = items.filter(
    (i) => i.invoiceStatus === "sent" || i.invoiceStatus === "overdue"
  );

  const totalOutstanding = agingItems.reduce((s, i) => s + i.totalCost, 0);
  const overdueItems = agingItems.filter((i) => i.invoiceStatus === "overdue");

  ctx = drawSummaryLine(ctx, "Total Outstanding:", formatCurrency(totalOutstanding), true);
  ctx = drawSummaryLine(ctx, "Overdue Invoices:", String(overdueItems.length));
  ctx = drawSummaryLine(ctx, "Open Invoices:", String(agingItems.length));
  ctx = { ...ctx, y: ctx.y - 12 };

  // Column layout to fit in CONTENT_WIDTH (512px):
  // Subject=150, Client=120, Amount=80, Sent=80, Due=80, Days=52 → total 562; fits with margin
  const adjustedCols = [
    { label: "Subject", x: MARGIN, width: 150 },
    { label: "Client", x: MARGIN + 150, width: 120 },
    { label: "Amount", x: MARGIN + 270, width: 80 },
    { label: "Sent", x: MARGIN + 350, width: 80 },
    { label: "Due", x: MARGIN + 430, width: 80 },
    { label: "Days", x: MARGIN + 510, width: 52 },
  ];

  ctx = drawTableHeader(ctx, adjustedCols);

  const sorted = agingItems.sort((a, b) => {
    const aDue = a.invoiceDueDate?.toDate() ?? new Date(0);
    const bDue = b.invoiceDueDate?.toDate() ?? new Date(0);
    return aDue.getTime() - bDue.getTime();
  });

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const client = clients.get(item.clientId);
    const clientName = client ? client.name : "Unknown";
    const sentDate = item.invoiceSentDate?.toDate();
    const dueDate = item.invoiceDueDate?.toDate();
    const daysPast = dueDate
      ? Math.max(0, daysBetween(dueDate, today))
      : 0;

    ctx = await drawTableRow(
      ctx,
      [
        { text: item.subject, x: adjustedCols[0].x, width: adjustedCols[0].width },
        { text: clientName, x: adjustedCols[1].x, width: adjustedCols[1].width },
        { text: formatCurrency(item.totalCost), x: adjustedCols[2].x, width: adjustedCols[2].width },
        { text: sentDate ? formatDate(sentDate) : "—", x: adjustedCols[3].x, width: adjustedCols[3].width },
        { text: dueDate ? formatDate(dueDate) : "—", x: adjustedCols[4].x, width: adjustedCols[4].width },
        { text: daysPast > 0 ? String(daysPast) : "0", x: adjustedCols[5].x, width: adjustedCols[5].width },
      ],
      i,
      title
    );
  }

  if (agingItems.length === 0) {
    ctx.page.drawText("No outstanding invoices in this period.", {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.regular,
      color: COLOR_GRAY,
    });
    ctx = { ...ctx, y: ctx.y - LINE_HEIGHT };
  }

  return ctx;
}

/** Expenses: Placeholder for Phase 3. */
async function buildExpensesReport(
  ctx: DrawContext,
  startDate: Date,
  endDate: Date
): Promise<DrawContext> {
  const title = "Expenses";
  ctx = await drawPageHeader(ctx, title);
  ctx = drawDateRange(ctx, startDate, endDate);

  ctx.page.drawText("Coming in Phase 3", {
    x: MARGIN,
    y: ctx.y,
    size: 14,
    font: ctx.bold,
    color: COLOR_GRAY,
  });
  ctx = { ...ctx, y: ctx.y - 24 };

  ctx.page.drawText(
    "Expense tracking and categorized reporting will be available in the next release.",
    { x: MARGIN, y: ctx.y, size: 10, font: ctx.regular, color: COLOR_GRAY }
  );
  ctx = { ...ctx, y: ctx.y - LINE_HEIGHT };

  return ctx;
}

// ─── Main Cloud Function ──────────────────────────────────────────────────────

/**
 * Callable Cloud Function that generates a financial report PDF,
 * uploads it to Firebase Storage, and returns a 7-day signed URL.
 */
export const onGenerateReport = onCall(
  { maxInstances: 10, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to generate reports."
      );
    }

    const {
      reportType,
      startDate: startDateStr,
      endDate: endDateStr,
    } = (request.data ?? {}) as ReportRequest;

    const validTypes: ReportType[] = [
      "pnl",
      "incomeByClient",
      "taxSummary",
      "hoursBilling",
      "aging",
      "expenses",
    ];

    if (!reportType || !validTypes.includes(reportType)) {
      throw new HttpsError(
        "invalid-argument",
        `reportType must be one of: ${validTypes.join(", ")}.`
      );
    }

    const startDate = startDateStr ? new Date(startDateStr) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new HttpsError(
        "invalid-argument",
        "startDate and endDate must be valid ISO date strings."
      );
    }

    const uid = request.auth.uid;
    const db = admin.firestore();

    try {
      // ── Fetch work items ──────────────────────────────────────────────────
      const workItemsSnap = await db
        .collection("workItems")
        .where("ownerId", "==", uid)
        .get();

      const allItems: Array<WorkItemDoc & { id: string }> = workItemsSnap.docs.map(
        (doc) => ({ id: doc.id, ...(doc.data() as WorkItemDoc) })
      );

      const filteredItems = filterByDateRange(allItems, startDate, endDate);

      // ── Fetch clients ─────────────────────────────────────────────────────
      const clientsSnap = await db
        .collection("clients")
        .where("ownerId", "==", uid)
        .get();

      const clientsMap = new Map<string, ClientDoc>();
      for (const doc of clientsSnap.docs) {
        clientsMap.set(doc.id, doc.data() as ClientDoc);
      }

      // ── Build PDF ─────────────────────────────────────────────────────────
      const pdfDoc = await PDFDocument.create();
      const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const generatedAt = new Date();

      // First page
      const firstPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let ctx: DrawContext = {
        pdfDoc,
        page: firstPage,
        y: PAGE_HEIGHT - MARGIN,
        regular,
        bold,
        pageNumber: 1,
        generatedAt,
      };

      const reportTitles: Record<ReportType, string> = {
        pnl: "Profit & Loss Summary",
        incomeByClient: "Income by Client",
        taxSummary: "Tax Summary (1099 Preparation)",
        hoursBilling: "Hours & Billing",
        aging: "Invoice Aging",
        expenses: "Expenses",
      };

      const title = reportTitles[reportType];

      switch (reportType) {
        case "pnl":
          ctx = await buildPnlReport(ctx, filteredItems, startDate, endDate);
          break;
        case "incomeByClient":
          ctx = await buildIncomeByClientReport(ctx, filteredItems, clientsMap, startDate, endDate);
          break;
        case "taxSummary":
          ctx = await buildTaxSummaryReport(ctx, filteredItems, clientsMap, startDate, endDate);
          break;
        case "hoursBilling":
          ctx = await buildHoursBillingReport(ctx, filteredItems, startDate, endDate);
          break;
        case "aging":
          ctx = await buildAgingReport(ctx, allItems, clientsMap, startDate, endDate);
          break;
        case "expenses":
          ctx = await buildExpensesReport(ctx, startDate, endDate);
          break;
      }

      // Draw footer on last page
      drawFooter(ctx, ctx.pageNumber, generatedAt);

      const pdfBytes = await pdfDoc.save();

      // ── Upload to Storage ─────────────────────────────────────────────────
      const bucket = admin.storage().bucket();
      const safeStart = startDateStr ?? startDate.toISOString().slice(0, 10);
      const safeEnd = endDateStr ?? endDate.toISOString().slice(0, 10);
      const filePath = `reports/${uid}/${reportType}-${safeStart}-${safeEnd}.pdf`;
      const file = bucket.file(filePath);

      await file.save(Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        metadata: {
          metadata: {
            reportType,
            startDate: safeStart,
            endDate: safeEnd,
            generatedBy: uid,
          },
        },
      });

      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      logger.info("Report generated and uploaded", { uid, reportType, filePath });

      return {
        success: true,
        pdfUrl: signedUrl,
        storagePath: filePath,
        reportType,
        title,
        itemCount: filteredItems.length,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Report generation failed", { error, reportType, uid });
      throw new HttpsError(
        "internal",
        "Failed to generate report. Please try again."
      );
    }
  }
);
