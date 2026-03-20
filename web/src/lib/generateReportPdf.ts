import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { WorkItem, Client } from './types';
import {
  getMonthlyRevenue,
  getRevenueByClient,
  getRevenueByType,
  getAgingBuckets,
  getInvoicesByStatus,
} from './finance';
import type { DateRange } from './finance';
import { formatCurrency } from './utils';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 18;

interface PdfContext {
  doc: PDFDocument;
  page: ReturnType<PDFDocument['addPage']>;
  font: Awaited<ReturnType<PDFDocument['embedFont']>>;
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>;
  y: number;
}

function newPage(ctx: PdfContext): void {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function checkSpace(ctx: PdfContext, needed: number): void {
  if (ctx.y - needed < MARGIN + 30) {
    newPage(ctx);
  }
}

function drawHeader(ctx: PdfContext, title: string, dateLabel: string): void {
  // Report title — large, formal
  ctx.page.drawText(title.toUpperCase(), { x: MARGIN, y: ctx.y, font: ctx.bold, size: 14, color: rgb(0.15, 0.15, 0.15) });
  ctx.y -= 20;
  // Date range
  ctx.page.drawText(dateLabel, { x: MARGIN, y: ctx.y, font: ctx.font, size: 9, color: rgb(0.45, 0.45, 0.45) });
  // Prepared date on the right
  const preparedText = `Prepared ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  const preparedWidth = ctx.font.widthOfTextAtSize(preparedText, 8);
  ctx.page.drawText(preparedText, { x: PAGE_WIDTH - MARGIN - preparedWidth, y: ctx.y, font: ctx.font, size: 8, color: rgb(0.55, 0.55, 0.55) });
  ctx.y -= 12;
  // Double rule
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  ctx.y -= 3;
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y }, thickness: 0.3, color: rgb(0.2, 0.2, 0.2) });
  ctx.y -= 18;
}

function drawRow(ctx: PdfContext, cols: { text: string; x: number; width: number; align?: 'left' | 'right'; bold?: boolean }[]): void {
  checkSpace(ctx, LINE_HEIGHT);
  for (const col of cols) {
    const f = col.bold ? ctx.bold : ctx.font;
    const textWidth = f.widthOfTextAtSize(col.text, 9);
    const x = col.align === 'right' ? col.x + col.width - textWidth : col.x;
    ctx.page.drawText(col.text, { x, y: ctx.y, font: f, size: 9 });
  }
  ctx.y -= LINE_HEIGHT;
}

function drawSeparator(ctx: PdfContext, heavy = false): void {
  const y = ctx.y + LINE_HEIGHT - 4;
  ctx.page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: heavy ? 0.75 : 0.5,
    color: heavy ? rgb(0.3, 0.3, 0.3) : rgb(0.65, 0.65, 0.65),
  });
}

function drawFooter(ctx: PdfContext): void {
  // Bottom rule
  ctx.page.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: PAGE_WIDTH - MARGIN, y: 42 }, thickness: 0.3, color: rgb(0.75, 0.75, 0.75) });
  // ten99 credit — right-aligned, subtle
  const credit = 'ten99';
  const creditWidth = ctx.font.widthOfTextAtSize(credit, 7);
  ctx.page.drawText(credit, { x: PAGE_WIDTH - MARGIN - creditWidth, y: 30, font: ctx.font, size: 7, color: rgb(0.7, 0.7, 0.7) });
  // Page confidentiality note — left-aligned
  ctx.page.drawText('Confidential', { x: MARGIN, y: 30, font: ctx.font, size: 7, color: rgb(0.7, 0.7, 0.7) });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Report Builders ----

const COL_RIGHT = PAGE_WIDTH - MARGIN; // 562
const COL_AMT_W = 100; // width for amount columns
const COL_AMT_X = COL_RIGHT - COL_AMT_W; // 462

function buildProfitLoss(ctx: PdfContext, workItems: WorkItem[], range: DateRange): void {
  drawHeader(ctx, 'Profit & Loss', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  const monthly = getMonthlyRevenue(workItems, 12, range.end);
  drawRow(ctx, [
    { text: 'Month', x: MARGIN, width: 300, bold: true },
    { text: 'Revenue', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawSeparator(ctx);

  let total = 0;
  for (const m of monthly) {
    drawRow(ctx, [
      { text: m.month, x: MARGIN, width: 300 },
      { text: formatCurrency(m.revenue), x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
    ]);
    total += m.revenue;
  }
  drawSeparator(ctx, true);
  drawRow(ctx, [
    { text: 'Total', x: MARGIN, width: 300, bold: true },
    { text: formatCurrency(total), x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawFooter(ctx);
}

function buildIncomeByClient(ctx: PdfContext, workItems: WorkItem[], clients: Client[], range: DateRange): void {
  drawHeader(ctx, 'Income by Client', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  const byClient = getRevenueByClient(workItems, clients, range);
  const COL_ORD_X = 360;
  const COL_ORD_W = 60;
  drawRow(ctx, [
    { text: 'Client', x: MARGIN, width: 300, bold: true },
    { text: 'Orders', x: COL_ORD_X, width: COL_ORD_W, align: 'right', bold: true },
    { text: 'Revenue', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawSeparator(ctx);

  let total = 0;
  for (const c of byClient) {
    drawRow(ctx, [
      { text: c.clientName, x: MARGIN, width: 300 },
      { text: String(c.count), x: COL_ORD_X, width: COL_ORD_W, align: 'right' },
      { text: formatCurrency(c.revenue), x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
    ]);
    total += c.revenue;
  }
  drawSeparator(ctx, true);
  drawRow(ctx, [
    { text: 'Total', x: MARGIN, width: 300, bold: true },
    { text: '', x: COL_ORD_X, width: COL_ORD_W },
    { text: formatCurrency(total), x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawFooter(ctx);
}

function buildTaxSummary(ctx: PdfContext, workItems: WorkItem[], clients: Client[], range: DateRange): void {
  drawHeader(ctx, 'Tax Summary — 1099 Report', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  const byClient = getRevenueByClient(workItems, clients, range);
  const total = byClient.reduce((s, c) => s + c.revenue, 0);

  const COL_1099_X = 380;
  const COL_1099_W = 80;
  drawRow(ctx, [
    { text: 'Client', x: MARGIN, width: 250, bold: true },
    { text: 'Revenue', x: COL_1099_X, width: COL_1099_W, align: 'right', bold: true },
    { text: '1099?', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawSeparator(ctx);

  for (const c of byClient) {
    drawRow(ctx, [
      { text: c.clientName, x: MARGIN, width: 250 },
      { text: formatCurrency(c.revenue), x: COL_1099_X, width: COL_1099_W, align: 'right' },
      { text: c.revenue >= 600 ? 'Yes' : 'No', x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
    ]);
  }
  drawSeparator(ctx, true);
  drawRow(ctx, [
    { text: 'Total Income', x: MARGIN, width: 250, bold: true },
    { text: formatCurrency(total), x: COL_1099_X, width: COL_1099_W, align: 'right', bold: true },
    { text: '', x: COL_AMT_X, width: COL_AMT_W },
  ]);

  ctx.y -= 20;
  checkSpace(ctx, 40);
  ctx.page.drawText('Note: Clients with $600+ in payments require a 1099-NEC form.', {
    x: MARGIN, y: ctx.y, font: ctx.font, size: 8, color: rgb(0.5, 0.5, 0.5),
  });
  drawFooter(ctx);
}

function buildHoursBilling(ctx: PdfContext, workItems: WorkItem[], range: DateRange): void {
  drawHeader(ctx, 'Hours & Billing', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  const byType = getRevenueByType(workItems, range);
  const totalHours = byType.reduce((s, t) => s + t.hours, 0);
  const totalRevenue = byType.reduce((s, t) => s + t.revenue, 0);
  const effectiveRate = totalHours > 0 ? totalRevenue / totalHours : 0;

  // Summary
  drawRow(ctx, [{ text: `Total Hours: ${totalHours.toFixed(1)}`, x: MARGIN, width: 200, bold: true }]);
  drawRow(ctx, [{ text: `Total Revenue: ${formatCurrency(totalRevenue)}`, x: MARGIN, width: 200, bold: true }]);
  drawRow(ctx, [{ text: `Effective Rate: ${formatCurrency(effectiveRate)}/hr`, x: MARGIN, width: 200, bold: true }]);
  ctx.y -= 10;

  drawRow(ctx, [
    { text: 'Type', x: MARGIN, width: 200, bold: true },
    { text: 'Orders', x: 280, width: 60, align: 'right', bold: true },
    { text: 'Hours', x: 370, width: 60, align: 'right', bold: true },
    { text: 'Revenue', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawSeparator(ctx);

  const typeLabels: Record<string, string> = {
    changeRequest: 'Change Request',
    featureRequest: 'Feature Request',
    maintenance: 'Maintenance',
  };

  for (const t of byType) {
    drawRow(ctx, [
      { text: typeLabels[t.type] ?? t.type, x: MARGIN, width: 200 },
      { text: String(t.count), x: 280, width: 60, align: 'right' },
      { text: t.hours.toFixed(1), x: 370, width: 60, align: 'right' },
      { text: formatCurrency(t.revenue), x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
    ]);
  }
  drawFooter(ctx);
}

function buildAging(ctx: PdfContext, workItems: WorkItem[]): void {
  drawHeader(ctx, 'Aging Report', `As of ${formatDateShort(new Date())}`);

  const buckets = getAgingBuckets(workItems);

  // Summary buckets
  drawRow(ctx, [
    { text: 'Bucket', x: MARGIN, width: 300, bold: true },
    { text: 'Amount', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawSeparator(ctx);

  const bucketRows = [
    ['Current (not yet due)', buckets.current],
    ['1-30 days past due', buckets.days1to30],
    ['31-60 days past due', buckets.days31to60],
    ['60+ days past due', buckets.days60plus],
  ] as const;

  for (const [label, amount] of bucketRows) {
    drawRow(ctx, [
      { text: label, x: MARGIN, width: 300 },
      { text: formatCurrency(amount), x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
    ]);
  }

  const total = buckets.current + buckets.days1to30 + buckets.days31to60 + buckets.days60plus;
  drawSeparator(ctx, true);
  drawRow(ctx, [
    { text: 'Total Outstanding', x: MARGIN, width: 300, bold: true },
    { text: formatCurrency(total), x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);

  // Detail: individual invoices
  ctx.y -= 20;
  checkSpace(ctx, 40);
  ctx.page.drawText('Outstanding Invoices', { x: MARGIN, y: ctx.y, font: ctx.bold, size: 11 });
  ctx.y -= 20;

  const unpaid = [...getInvoicesByStatus(workItems, 'sent'), ...getInvoicesByStatus(workItems, 'overdue')];

  if (unpaid.length === 0) {
    drawRow(ctx, [{ text: 'No outstanding invoices.', x: MARGIN, width: 400 }]);
  } else {
    drawRow(ctx, [
      { text: 'Subject', x: MARGIN, width: 250, bold: true },
      { text: 'Status', x: 330, width: 80, bold: true },
      { text: 'Amount', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
    ]);
    drawSeparator(ctx);

    for (const item of unpaid) {
      const subject = (item.subject ?? '').slice(0, 45);
      const status = (item.invoiceStatus ?? 'draft');
      drawRow(ctx, [
        { text: subject, x: MARGIN, width: 250 },
        { text: status.charAt(0).toUpperCase() + status.slice(1), x: 330, width: 80 },
        { text: formatCurrency(item.totalCost), x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
      ]);
    }
  }

  drawFooter(ctx);
}

// ---- Public API ----

export type ReportType = 'profit_loss' | 'income_by_client' | 'tax_summary' | 'hours_billing' | 'aging' | 'expense';

export async function generateReportPdf(
  reportType: ReportType,
  workItems: WorkItem[],
  clients: Client[],
  range: DateRange
): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const ctx: PdfContext = { doc, page, font, bold, y: PAGE_HEIGHT - MARGIN };

  switch (reportType) {
    case 'profit_loss':
      buildProfitLoss(ctx, workItems, range);
      break;
    case 'income_by_client':
      buildIncomeByClient(ctx, workItems, clients, range);
      break;
    case 'tax_summary':
      buildTaxSummary(ctx, workItems, clients, range);
      break;
    case 'hours_billing':
      buildHoursBilling(ctx, workItems, range);
      break;
    case 'aging':
      buildAging(ctx, workItems);
      break;
    case 'expense':
      drawHeader(ctx, 'Expense Report', 'Coming in Phase 3');
      drawRow(ctx, [{ text: 'Expense tracking will be available after bank account integration.', x: MARGIN, width: 400 }]);
      drawFooter(ctx);
      break;
  }

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/** Generate a single PDF with all reports combined, each on its own page. */
export async function generateCombinedReportPdf(
  workItems: WorkItem[],
  clients: Client[],
  range: DateRange
): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const ctx: PdfContext = { doc, page, font, bold, y: PAGE_HEIGHT - MARGIN };

  // 1. Profit & Loss
  buildProfitLoss(ctx, workItems, range);

  // 2. Income by Client — new page
  newPage(ctx);
  buildIncomeByClient(ctx, workItems, clients, range);

  // 3. Tax Summary — new page
  newPage(ctx);
  buildTaxSummary(ctx, workItems, clients, range);

  // 4. Hours & Billing — new page
  newPage(ctx);
  buildHoursBilling(ctx, workItems, range);

  // 5. Aging Report — new page
  newPage(ctx);
  buildAging(ctx, workItems);

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
