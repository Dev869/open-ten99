import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { WorkItem, Client, Transaction } from './types';
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

// ---- Color Palette ----

const TEAL = rgb(0.29, 0.66, 0.66);       // #4BA8A8 — revenue/accent
const CORAL = rgb(0.91, 0.30, 0.24);      // #E84D3D — expenses
const CHARCOAL = rgb(0.15, 0.15, 0.15);   // text
const GRAY = rgb(0.45, 0.45, 0.45);       // labels
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85); // gridlines

// ---- Chart Helpers ----

function drawHorizontalBarChart(
  ctx: PdfContext,
  title: string,
  data: Array<{ label: string; value: number }>,
  barColor: ReturnType<typeof rgb>,
  maxBars = 8,
): void {
  const items = data.slice(0, maxBars);
  if (items.length === 0) return;

  const chartHeight = items.length * 22 + 40;
  checkSpace(ctx, chartHeight);

  ctx.y -= 10;
  ctx.page.drawText(title, { x: MARGIN, y: ctx.y, font: ctx.bold, size: 10, color: CHARCOAL });
  ctx.y -= 20;

  const maxVal = Math.max(...items.map((d) => d.value), 1);
  const barAreaX = MARGIN + 140;
  const barAreaW = PAGE_WIDTH - MARGIN - barAreaX - 10;

  for (const item of items) {
    const barW = (item.value / maxVal) * barAreaW;
    const labelText = item.label.length > 22 ? item.label.slice(0, 20) + '...' : item.label;

    ctx.page.drawText(labelText, { x: MARGIN, y: ctx.y, font: ctx.font, size: 8, color: GRAY });

    if (barW > 0) {
      ctx.page.drawRectangle({
        x: barAreaX, y: ctx.y - 2, width: Math.max(barW, 2), height: 12,
        color: barColor,
      });
    }

    const valText = formatCurrency(item.value);
    ctx.page.drawText(valText, {
      x: barAreaX + barW + 4, y: ctx.y, font: ctx.font, size: 7, color: CHARCOAL,
    });

    ctx.y -= 22;
  }
}

function drawVerticalBarChart(
  ctx: PdfContext,
  title: string,
  data: Array<{ label: string; value1: number; value2?: number }>,
  color1: ReturnType<typeof rgb>,
  color2?: ReturnType<typeof rgb>,
  legend?: [string, string],
): void {
  if (data.length === 0) return;

  const chartH = 140;
  const chartW = PAGE_WIDTH - MARGIN * 2;
  checkSpace(ctx, chartH + 60);

  ctx.y -= 10;
  ctx.page.drawText(title, { x: MARGIN, y: ctx.y, font: ctx.bold, size: 10, color: CHARCOAL });
  ctx.y -= 20;

  const chartBottom = ctx.y - chartH;
  const maxVal = Math.max(...data.flatMap((d) => [d.value1, d.value2 ?? 0]), 1);

  // Y-axis gridlines (4 lines)
  for (let i = 0; i <= 4; i++) {
    const lineY = chartBottom + (chartH * i) / 4;
    ctx.page.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: MARGIN + chartW, y: lineY },
      thickness: 0.3, color: LIGHT_GRAY,
    });
    const labelVal = (maxVal * i) / 4;
    const label = labelVal >= 1000 ? `$${(labelVal / 1000).toFixed(0)}k` : `$${labelVal.toFixed(0)}`;
    ctx.page.drawText(label, { x: MARGIN - 2, y: lineY + 2, font: ctx.font, size: 6, color: GRAY });
  }

  const barGroupW = chartW / data.length;
  const hasTwo = color2 !== undefined;
  const barW = hasTwo ? barGroupW * 0.35 : barGroupW * 0.6;
  const gap = hasTwo ? barGroupW * 0.05 : 0;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const groupX = MARGIN + i * barGroupW;

    // Bar 1
    const h1 = (d.value1 / maxVal) * chartH;
    const x1 = groupX + (barGroupW - (hasTwo ? barW * 2 + gap : barW)) / 2;
    if (h1 > 0) {
      ctx.page.drawRectangle({ x: x1, y: chartBottom, width: barW, height: h1, color: color1 });
    }

    // Bar 2
    if (hasTwo && d.value2 !== undefined) {
      const h2 = (d.value2 / maxVal) * chartH;
      if (h2 > 0) {
        ctx.page.drawRectangle({ x: x1 + barW + gap, y: chartBottom, width: barW, height: h2, color: color2! });
      }
    }

    // X-axis label
    const label = d.label.length > 6 ? d.label.slice(0, 3) : d.label;
    const labelW = ctx.font.widthOfTextAtSize(label, 7);
    ctx.page.drawText(label, {
      x: groupX + barGroupW / 2 - labelW / 2,
      y: chartBottom - 12,
      font: ctx.font, size: 7, color: GRAY,
    });
  }

  ctx.y = chartBottom - 20;

  // Legend
  if (legend && hasTwo) {
    const legendY = ctx.y;
    ctx.page.drawRectangle({ x: MARGIN, y: legendY, width: 8, height: 8, color: color1 });
    ctx.page.drawText(legend[0], { x: MARGIN + 12, y: legendY + 1, font: ctx.font, size: 7, color: GRAY });
    ctx.page.drawRectangle({ x: MARGIN + 80, y: legendY, width: 8, height: 8, color: color2! });
    ctx.page.drawText(legend[1], { x: MARGIN + 92, y: legendY + 1, font: ctx.font, size: 7, color: GRAY });
    ctx.y -= 14;
  }
}

// ---- Report Builders ----

const COL_RIGHT = PAGE_WIDTH - MARGIN; // 562
const COL_AMT_W = 100; // width for amount columns
const COL_AMT_X = COL_RIGHT - COL_AMT_W; // 462

function buildProfitLoss(ctx: PdfContext, workItems: WorkItem[], range: DateRange, transactions?: Transaction[]): void {
  drawHeader(ctx, 'Profit & Loss', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  const monthly = getMonthlyRevenue(workItems, 12, range.end);

  if (transactions !== undefined) {
    // 4-column layout: Month | Revenue | Expenses | Net
    const COL_REV_X = MARGIN + 160;
    const COL_REV_W = 110;
    const COL_EXP_X = COL_REV_X + COL_REV_W;
    const COL_EXP_W = 110;
    const COL_NET_X = COL_EXP_X + COL_EXP_W;
    const COL_NET_W = COL_RIGHT - COL_NET_X;

    drawRow(ctx, [
      { text: 'Month', x: MARGIN, width: 160, bold: true },
      { text: 'Revenue', x: COL_REV_X, width: COL_REV_W, align: 'right', bold: true },
      { text: 'Expenses', x: COL_EXP_X, width: COL_EXP_W, align: 'right', bold: true },
      { text: 'Net', x: COL_NET_X, width: COL_NET_W, align: 'right', bold: true },
    ]);
    drawSeparator(ctx);

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const m of monthly) {
      // Parse the month label (e.g. "Jan 2025") to determine start/end of month
      const monthDate = new Date(m.month + ' 01');
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthExpenses = transactions
        .filter((t) => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const net = m.revenue - monthExpenses;
      totalRevenue += m.revenue;
      totalExpenses += monthExpenses;

      drawRow(ctx, [
        { text: m.month, x: MARGIN, width: 160 },
        { text: formatCurrency(m.revenue), x: COL_REV_X, width: COL_REV_W, align: 'right' },
        { text: formatCurrency(monthExpenses), x: COL_EXP_X, width: COL_EXP_W, align: 'right' },
        { text: formatCurrency(net), x: COL_NET_X, width: COL_NET_W, align: 'right' },
      ]);
    }

    drawSeparator(ctx, true);
    drawRow(ctx, [
      { text: 'Total', x: MARGIN, width: 160, bold: true },
      { text: formatCurrency(totalRevenue), x: COL_REV_X, width: COL_REV_W, align: 'right', bold: true },
      { text: formatCurrency(totalExpenses), x: COL_EXP_X, width: COL_EXP_W, align: 'right', bold: true },
      { text: formatCurrency(totalRevenue - totalExpenses), x: COL_NET_X, width: COL_NET_W, align: 'right', bold: true },
    ]);
  } else {
    // Revenue-only (graceful degradation)
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
  }

  ctx.y -= 20;
  const chartData = monthly.map((m) => {
    const monthDate = new Date(m.month + ' 01');
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthExp = transactions
      ? transactions.filter((t) => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd).reduce((sum, t) => sum + Math.abs(t.amount), 0)
      : 0;
    return { label: m.month, value1: m.revenue, value2: monthExp };
  });
  drawVerticalBarChart(ctx, 'Revenue vs Expenses Trend', chartData, TEAL, CORAL, ['Revenue', 'Expenses']);

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

  ctx.y -= 20;
  drawHorizontalBarChart(ctx, 'Revenue Distribution', byClient.map((c) => ({ label: c.clientName, value: c.revenue })), TEAL);

  drawFooter(ctx);
}

function buildTaxSummary(ctx: PdfContext, workItems: WorkItem[], clients: Client[], range: DateRange, transactions?: Transaction[]): void {
  drawHeader(ctx, 'Tax Summary — 1099 Report', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  const byClient = getRevenueByClient(workItems, clients, range);
  const totalIncome = byClient.reduce((s, c) => s + c.revenue, 0);

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
    { text: formatCurrency(totalIncome), x: COL_1099_X, width: COL_1099_W, align: 'right', bold: true },
    { text: '', x: COL_AMT_X, width: COL_AMT_W },
  ]);

  ctx.y -= 20;
  checkSpace(ctx, 40);
  ctx.page.drawText('Note: Clients with $600+ in payments require a 1099-NEC form.', {
    x: MARGIN, y: ctx.y, font: ctx.font, size: 8, color: rgb(0.5, 0.5, 0.5),
  });

  if (transactions !== undefined) {
    ctx.y -= 30;
    checkSpace(ctx, 60);
    ctx.page.drawText('DEDUCTIBLE EXPENSES BY CATEGORY', { x: MARGIN, y: ctx.y, font: ctx.bold, size: 11 });
    ctx.y -= 20;

    // Group expense transactions by category
    const expenseMap = new Map<string, number>();
    for (const t of transactions) {
      if (t.type === 'expense') {
        const cat = t.category || 'Uncategorized';
        expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + Math.abs(t.amount));
      }
    }

    const categories = Array.from(expenseMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    if (categories.length === 0) {
      drawRow(ctx, [{ text: 'No expenses recorded.', x: MARGIN, width: 400 }]);
    } else {
      drawRow(ctx, [
        { text: 'Category', x: MARGIN, width: 300, bold: true },
        { text: 'Total', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
      ]);
      drawSeparator(ctx);

      let totalExpenses = 0;
      for (const [cat, amount] of categories) {
        drawRow(ctx, [
          { text: cat, x: MARGIN, width: 300 },
          { text: formatCurrency(amount), x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
        ]);
        totalExpenses += amount;
      }

      drawSeparator(ctx, true);
      drawRow(ctx, [
        { text: 'Total Expenses', x: MARGIN, width: 300, bold: true },
        { text: formatCurrency(totalExpenses), x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
      ]);
      drawRow(ctx, [
        { text: 'Net Income (Revenue - Expenses)', x: MARGIN, width: 300, bold: true },
        { text: formatCurrency(totalIncome - totalExpenses), x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
      ]);

      if (categories.length > 0) {
        ctx.y -= 20;
        drawHorizontalBarChart(ctx, 'Expense Categories', categories.map(([cat, amount]) => ({ label: cat, value: amount })), CORAL);
      }
    }
  }

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

  ctx.y -= 20;
  drawHorizontalBarChart(ctx, 'Revenue by Type', byType.map((t) => ({ label: typeLabels[t.type] ?? t.type, value: t.revenue })), TEAL);

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

  ctx.y -= 10;
  const agingData = bucketRows.filter(([, amount]) => amount > 0).map(([label, amount]) => ({ label: label as string, value: amount as number }));
  if (agingData.length > 0) {
    drawHorizontalBarChart(ctx, 'Aging Distribution', agingData, CORAL);
  }

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

function buildExpenseReport(ctx: PdfContext, range: DateRange, transactions?: Transaction[]): void {
  drawHeader(ctx, 'Expense Report', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  const expenses = transactions
    ? transactions.filter((t) => t.type === 'expense').sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  if (expenses.length === 0) {
    drawRow(ctx, [{ text: 'No expenses recorded.', x: MARGIN, width: 400 }]);
    drawFooter(ctx);
    return;
  }

  // Column layout: Date | Description | Category | Amount
  const COL_DATE_W = 80;
  const COL_DESC_X = MARGIN + COL_DATE_W + 10;
  const COL_DESC_W = 200;
  const COL_CAT_X = COL_DESC_X + COL_DESC_W + 10;
  const COL_CAT_W = 110;
  const COL_EXP_AMT_X = COL_CAT_X + COL_CAT_W + 10;
  const COL_EXP_AMT_W = COL_RIGHT - COL_EXP_AMT_X;

  drawRow(ctx, [
    { text: 'Date', x: MARGIN, width: COL_DATE_W, bold: true },
    { text: 'Description', x: COL_DESC_X, width: COL_DESC_W, bold: true },
    { text: 'Category', x: COL_CAT_X, width: COL_CAT_W, bold: true },
    { text: 'Amount', x: COL_EXP_AMT_X, width: COL_EXP_AMT_W, align: 'right', bold: true },
  ]);
  drawSeparator(ctx);

  let grandTotal = 0;
  for (const t of expenses) {
    const desc = (t.description ?? '').slice(0, 35);
    const cat = (t.category ?? 'Uncategorized').slice(0, 20);
    drawRow(ctx, [
      { text: formatDateShort(t.date), x: MARGIN, width: COL_DATE_W },
      { text: desc, x: COL_DESC_X, width: COL_DESC_W },
      { text: cat, x: COL_CAT_X, width: COL_CAT_W },
      { text: formatCurrency(Math.abs(t.amount)), x: COL_EXP_AMT_X, width: COL_EXP_AMT_W, align: 'right' },
    ]);
    grandTotal += Math.abs(t.amount);
  }

  // Category subtotals
  ctx.y -= 20;
  checkSpace(ctx, 60);
  ctx.page.drawText('Subtotals by Category', { x: MARGIN, y: ctx.y, font: ctx.bold, size: 11 });
  ctx.y -= 20;

  const categoryMap = new Map<string, number>();
  for (const t of expenses) {
    const cat = t.category || 'Uncategorized';
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Math.abs(t.amount));
  }

  const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  drawRow(ctx, [
    { text: 'Category', x: MARGIN, width: 300, bold: true },
    { text: 'Total', x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);
  drawSeparator(ctx);

  for (const [cat, amount] of sortedCategories) {
    drawRow(ctx, [
      { text: cat, x: MARGIN, width: 300 },
      { text: formatCurrency(amount), x: COL_AMT_X, width: COL_AMT_W, align: 'right' },
    ]);
  }

  drawSeparator(ctx, true);
  drawRow(ctx, [
    { text: 'Grand Total', x: MARGIN, width: 300, bold: true },
    { text: formatCurrency(grandTotal), x: COL_AMT_X, width: COL_AMT_W, align: 'right', bold: true },
  ]);

  ctx.y -= 10;
  drawHorizontalBarChart(ctx, 'Spending by Category', sortedCategories.map(([cat, amount]) => ({ label: cat, value: amount })), CORAL);

  drawFooter(ctx);
}

function buildChartsSummary(
  ctx: PdfContext,
  workItems: WorkItem[],
  clients: Client[],
  range: DateRange,
  transactions?: Transaction[]
): void {
  drawHeader(ctx, 'Financial Summary', `${formatDateShort(range.start)} — ${formatDateShort(range.end)}`);

  // ── 1. Compute Data ──────────────────────────────────────────────────────

  const monthly = getMonthlyRevenue(workItems, 12, range.end);

  // Monthly expenses aligned to the monthly revenue months
  const monthlyExpenses: number[] = monthly.map((m) => {
    if (!transactions) return 0;
    const monthDate = new Date(m.month + ' 01');
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return transactions
      .filter((t) => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  });

  const byClient = getRevenueByClient(workItems, clients, range);

  // Expense categories
  const expenseCategoryMap = new Map<string, number>();
  if (transactions) {
    for (const t of transactions) {
      if (t.type === 'expense') {
        const cat = t.category || 'Uncategorized';
        expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) ?? 0) + Math.abs(t.amount));
      }
    }
  }
  const expenseCategories = Array.from(expenseCategoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // KPI totals
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = monthlyExpenses.reduce((s, e) => s + e, 0);
  const netIncome = totalRevenue - totalExpenses;
  const workOrderCount = workItems.filter((w) => {
    const d = w.invoicePaidDate ?? w.updatedAt ?? w.createdAt;
    return d && d >= range.start && d <= range.end;
  }).length;
  const avgValue = workOrderCount > 0 ? totalRevenue / workOrderCount : 0;

  // ── 2. KPI Row ────────────────────────────────────────────────────────────

  const KPI_BOX_W = (PAGE_WIDTH - MARGIN * 2) / 5;
  const KPI_BOX_H = 48;
  const KPI_Y = ctx.y - KPI_BOX_H;

  const kpis = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses) },
    { label: 'Net Income', value: formatCurrency(netIncome) },
    { label: 'Work Orders', value: String(workOrderCount) },
    { label: 'Avg Value', value: formatCurrency(avgValue) },
  ];

  for (let i = 0; i < kpis.length; i++) {
    const boxX = MARGIN + i * KPI_BOX_W;
    const kpi = kpis[i];
    // Box border
    ctx.page.drawRectangle({
      x: boxX + 2,
      y: KPI_Y,
      width: KPI_BOX_W - 4,
      height: KPI_BOX_H,
      borderColor: LIGHT_GRAY,
      borderWidth: 0.75,
      color: rgb(0.97, 0.97, 0.97),
    });
    // Label
    ctx.page.drawText(kpi.label.toUpperCase(), {
      x: boxX + 8,
      y: KPI_Y + KPI_BOX_H - 14,
      font: ctx.font,
      size: 6.5,
      color: GRAY,
    });
    // Value
    const valueColor = kpi.label === 'Net Income'
      ? (netIncome >= 0 ? TEAL : CORAL)
      : CHARCOAL;
    ctx.page.drawText(kpi.value, {
      x: boxX + 8,
      y: KPI_Y + 10,
      font: ctx.bold,
      size: 10,
      color: valueColor,
    });
  }

  ctx.y = KPI_Y - 18;

  // ── 3. Revenue vs Expenses Bar Chart ──────────────────────────────────────

  checkSpace(ctx, 160);
  ctx.page.drawText('REVENUE VS EXPENSES', {
    x: MARGIN, y: ctx.y, font: ctx.bold, size: 9, color: CHARCOAL,
  });
  ctx.y -= 10;

  const CHART_X = MARGIN + 48; // space for Y-axis labels
  const CHART_W = PAGE_WIDTH - MARGIN * 2 - 48;
  const CHART_H = 110;
  const CHART_BOTTOM = ctx.y - CHART_H;

  // Gridlines & Y-axis
  const maxBarVal = Math.max(...monthly.map((m, i) => Math.max(m.revenue, monthlyExpenses[i])), 1);
  const gridCount = 4;
  for (let g = 0; g <= gridCount; g++) {
    const gy = CHART_BOTTOM + (g / gridCount) * CHART_H;
    ctx.page.drawLine({
      start: { x: CHART_X, y: gy },
      end: { x: CHART_X + CHART_W, y: gy },
      thickness: 0.3,
      color: LIGHT_GRAY,
    });
    const gridVal = (maxBarVal * g) / gridCount;
    const label = gridVal >= 1000 ? `$${(gridVal / 1000).toFixed(0)}k` : `$${gridVal.toFixed(0)}`;
    ctx.page.drawText(label, {
      x: MARGIN,
      y: gy - 3.5,
      font: ctx.font,
      size: 6,
      color: GRAY,
    });
  }

  // X-axis baseline
  ctx.page.drawLine({
    start: { x: CHART_X, y: CHART_BOTTOM },
    end: { x: CHART_X + CHART_W, y: CHART_BOTTOM },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Bars
  const barGroupW = CHART_W / monthly.length;
  const BAR_GAP = 1.5;
  const barW = Math.max(2, barGroupW * 0.35);

  for (let i = 0; i < monthly.length; i++) {
    const gx = CHART_X + i * barGroupW;
    const rev = monthly[i].revenue;
    const exp = monthlyExpenses[i];

    const revH = maxBarVal > 0 ? (rev / maxBarVal) * CHART_H : 0;
    const expH = maxBarVal > 0 ? (exp / maxBarVal) * CHART_H : 0;

    // Revenue bar (teal)
    if (revH > 0) {
      ctx.page.drawRectangle({
        x: gx + (barGroupW / 2) - barW - BAR_GAP,
        y: CHART_BOTTOM,
        width: barW,
        height: revH,
        color: TEAL,
      });
    }

    // Expense bar (coral)
    if (expH > 0) {
      ctx.page.drawRectangle({
        x: gx + (barGroupW / 2) + BAR_GAP,
        y: CHART_BOTTOM,
        width: barW,
        height: expH,
        color: CORAL,
      });
    }

    // Month label — use abbreviated month only (first 3 chars)
    const shortLabel = monthly[i].month.slice(0, 3);
    const labelW = ctx.font.widthOfTextAtSize(shortLabel, 5.5);
    ctx.page.drawText(shortLabel, {
      x: gx + barGroupW / 2 - labelW / 2,
      y: CHART_BOTTOM - 9,
      font: ctx.font,
      size: 5.5,
      color: GRAY,
    });
  }

  // Legend
  const legendY = CHART_BOTTOM - 20;
  ctx.page.drawRectangle({ x: CHART_X, y: legendY, width: 8, height: 6, color: TEAL });
  ctx.page.drawText('Revenue', { x: CHART_X + 11, y: legendY, font: ctx.font, size: 7, color: GRAY });
  ctx.page.drawRectangle({ x: CHART_X + 60, y: legendY, width: 8, height: 6, color: CORAL });
  ctx.page.drawText('Expenses', { x: CHART_X + 71, y: legendY, font: ctx.font, size: 7, color: GRAY });

  ctx.y = legendY - 16;

  // ── 4. Two-column: Expense Breakdown + Revenue by Client ──────────────────

  const HALF_W = (PAGE_WIDTH - MARGIN * 2 - 12) / 2;
  const LEFT_X = MARGIN;
  const RIGHT_X = MARGIN + HALF_W + 12;

  checkSpace(ctx, 160);
  const sectionTopY = ctx.y;

  // Section headers
  ctx.page.drawText('EXPENSE BREAKDOWN', {
    x: LEFT_X, y: sectionTopY, font: ctx.bold, size: 9, color: CHARCOAL,
  });
  ctx.page.drawText('REVENUE BY CLIENT', {
    x: RIGHT_X, y: sectionTopY, font: ctx.bold, size: 9, color: CHARCOAL,
  });

  const HBAR_START_Y = sectionTopY - 14;
  const HBAR_H = 9;
  const HBAR_GAP = 6;
  const HBAR_LABEL_W = 70;
  const HBAR_AMT_W = 48;
  const HBAR_MAX_W = HALF_W - HBAR_LABEL_W - HBAR_AMT_W - 6;

  // Expense breakdown bars (left column)
  const maxExpCat = expenseCategories.length > 0 ? expenseCategories[0][1] : 1;
  let rowY = HBAR_START_Y;
  for (const [cat, amount] of expenseCategories) {
    const barFrac = maxExpCat > 0 ? amount / maxExpCat : 0;
    const filledW = barFrac * HBAR_MAX_W;

    // Background track
    ctx.page.drawRectangle({
      x: LEFT_X + HBAR_LABEL_W + 4,
      y: rowY - HBAR_H,
      width: HBAR_MAX_W,
      height: HBAR_H,
      color: LIGHT_GRAY,
    });
    // Filled bar
    if (filledW > 0) {
      ctx.page.drawRectangle({
        x: LEFT_X + HBAR_LABEL_W + 4,
        y: rowY - HBAR_H,
        width: filledW,
        height: HBAR_H,
        color: CORAL,
      });
    }
    // Category name (truncated)
    const catLabel = cat.length > 12 ? cat.slice(0, 11) + '…' : cat;
    ctx.page.drawText(catLabel, {
      x: LEFT_X,
      y: rowY - HBAR_H + 1.5,
      font: ctx.font,
      size: 6.5,
      color: CHARCOAL,
    });
    // Amount
    const amtText = formatCurrency(amount);
    ctx.page.drawText(amtText, {
      x: LEFT_X + HBAR_LABEL_W + HBAR_MAX_W + 7,
      y: rowY - HBAR_H + 1.5,
      font: ctx.font,
      size: 6.5,
      color: GRAY,
    });

    rowY -= HBAR_H + HBAR_GAP;
  }

  if (expenseCategories.length === 0) {
    ctx.page.drawText('No expenses recorded.', {
      x: LEFT_X, y: HBAR_START_Y - HBAR_H, font: ctx.font, size: 7, color: GRAY,
    });
  }

  // Revenue by client bars (right column)
  const topClients = byClient.slice(0, 8);
  const maxClientRev = topClients.length > 0 ? topClients[0].revenue : 1;
  rowY = HBAR_START_Y;
  for (const c of topClients) {
    const barFrac = maxClientRev > 0 ? c.revenue / maxClientRev : 0;
    const filledW = barFrac * HBAR_MAX_W;

    // Background track
    ctx.page.drawRectangle({
      x: RIGHT_X + HBAR_LABEL_W + 4,
      y: rowY - HBAR_H,
      width: HBAR_MAX_W,
      height: HBAR_H,
      color: LIGHT_GRAY,
    });
    // Filled bar
    if (filledW > 0) {
      ctx.page.drawRectangle({
        x: RIGHT_X + HBAR_LABEL_W + 4,
        y: rowY - HBAR_H,
        width: filledW,
        height: HBAR_H,
        color: TEAL,
      });
    }
    // Client name (truncated)
    const clientLabel = c.clientName.length > 12 ? c.clientName.slice(0, 11) + '…' : c.clientName;
    ctx.page.drawText(clientLabel, {
      x: RIGHT_X,
      y: rowY - HBAR_H + 1.5,
      font: ctx.font,
      size: 6.5,
      color: CHARCOAL,
    });
    // Amount
    ctx.page.drawText(formatCurrency(c.revenue), {
      x: RIGHT_X + HBAR_LABEL_W + HBAR_MAX_W + 7,
      y: rowY - HBAR_H + 1.5,
      font: ctx.font,
      size: 6.5,
      color: GRAY,
    });

    rowY -= HBAR_H + HBAR_GAP;
  }

  if (topClients.length === 0) {
    ctx.page.drawText('No revenue data.', {
      x: RIGHT_X, y: HBAR_START_Y - HBAR_H, font: ctx.font, size: 7, color: GRAY,
    });
  }

  // Update ctx.y to below the tallest column
  const maxRows = Math.max(expenseCategories.length, topClients.length, 1);
  ctx.y = HBAR_START_Y - maxRows * (HBAR_H + HBAR_GAP) - 12;

  drawFooter(ctx);
}

// ---- Public API ----

export type ReportType = 'profit_loss' | 'income_by_client' | 'tax_summary' | 'hours_billing' | 'aging' | 'expense';

export async function generateReportPdf(
  reportType: ReportType,
  workItems: WorkItem[],
  clients: Client[],
  range: DateRange,
  transactions?: Transaction[],
  includeCharts?: boolean
): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const ctx: PdfContext = { doc, page, font, bold, y: PAGE_HEIGHT - MARGIN };

  if (includeCharts) {
    buildChartsSummary(ctx, workItems, clients, range, transactions);
    newPage(ctx);
  }

  switch (reportType) {
    case 'profit_loss':
      buildProfitLoss(ctx, workItems, range, transactions);
      break;
    case 'income_by_client':
      buildIncomeByClient(ctx, workItems, clients, range);
      break;
    case 'tax_summary':
      buildTaxSummary(ctx, workItems, clients, range, transactions);
      break;
    case 'hours_billing':
      buildHoursBilling(ctx, workItems, range);
      break;
    case 'aging':
      buildAging(ctx, workItems);
      break;
    case 'expense':
      buildExpenseReport(ctx, range, transactions);
      break;
  }

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/** Generate a single PDF with all reports combined, each on its own page. */
export async function generateCombinedReportPdf(
  workItems: WorkItem[],
  clients: Client[],
  range: DateRange,
  transactions?: Transaction[]
): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const ctx: PdfContext = { doc, page, font, bold, y: PAGE_HEIGHT - MARGIN };

  // 1. Charts Summary (first page)
  buildChartsSummary(ctx, workItems, clients, range, transactions);

  // 2. Profit & Loss
  newPage(ctx);
  buildProfitLoss(ctx, workItems, range, transactions);

  // 3. Income by Client — new page
  newPage(ctx);
  buildIncomeByClient(ctx, workItems, clients, range);

  // 4. Tax Summary — new page
  newPage(ctx);
  buildTaxSummary(ctx, workItems, clients, range, transactions);

  // 5. Hours & Billing — new page
  newPage(ctx);
  buildHoursBilling(ctx, workItems, range);

  // 6. Aging Report — new page
  newPage(ctx);
  buildAging(ctx, workItems);

  // 7. Expense Report — new page
  newPage(ctx);
  buildExpenseReport(ctx, range, transactions);

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
