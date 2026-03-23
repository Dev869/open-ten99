import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { WorkItem, Client } from './types';
import { WORK_ITEM_STATUS_LABELS } from './types';

interface PdfSettings {
  companyName: string;
  hourlyRate: number;
  taxRate?: number;
  pdfLogoUrl?: string;
  invoiceFromAddress?: string;
  invoiceNotes?: string;
  invoiceTerms?: string;
}

/* ──────────────────────────────────────────────────────────
 * Brand palette
 * ────────────────────────────────────────────────────────── */
const TEAL        = rgb(0.29, 0.66, 0.66);           // #4BA8A8
const DARK_TEAL   = rgb(0.18, 0.48, 0.48);           // #2D7A7A
const CHARCOAL    = rgb(0.176, 0.176, 0.176);        // #2D2D2D
const GRAY        = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY  = rgb(0.6, 0.6, 0.6);
const TABLE_STRIPE = rgb(0.96, 0.96, 0.96);
const TABLE_BORDER = rgb(0.82, 0.82, 0.82);
const WHITE       = rgb(1, 1, 1);
const RETAINER_ORANGE = rgb(0.9, 0.49, 0.13);

/* ──────────────────────────────────────────────────────────
 * Page dimensions & layout constants
 * ────────────────────────────────────────────────────────── */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_BAR_H = 10;
const FOOTER_ZONE = MARGIN + FOOTER_BAR_H + 30; // keep clear of footer

/* ──────────────────────────────────────────────────────────
 * Line spacing constants — consistent throughout
 * ────────────────────────────────────────────────────────── */
const LINE_H = 16;          // standard text line height
const SECTION_GAP = 24;     // gap between major sections

/**
 * Generates a branded, professional invoice PDF and returns a blob URL.
 */
export async function buildChangeOrderPdf(
  workItem: WorkItem,
  client: Client,
  settings: PdfSettings,
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Track which pages already have footers drawn (for page-break pages)
  const footeredPages = new Set<PDFPage>();

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  /* ── helper: right-align text within page margins ── */
  const rightX = MARGIN + CONTENT_W;

  /* ── helper: add a new page with proper y reset ── */
  const addPage = (): PDFPage => {
    drawFooter(page, font, settings);
    footeredPages.add(page);
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    return page;
  };

  /* ── helper: ensure enough vertical space, add page if needed ── */
  const ensureSpace = (needed: number): void => {
    if (y - needed < FOOTER_ZONE) {
      addPage();
    }
  };

  /* ════════════════════════════════════════════════════════
   * HEADER
   * ════════════════════════════════════════════════════════ */

  // "WORK ORDER" label — top right, inside a teal box
  const coLabel = 'INVOICE';
  const coFontSize = 16;
  const coTextW = fontBold.widthOfTextAtSize(coLabel, coFontSize);
  const coPadX = 14;
  const coPadY = 8;
  const coBoxW = coTextW + coPadX * 2;
  const coBoxH = coFontSize + coPadY * 2;
  const coBoxX = rightX - coBoxW;

  // Company logo or name — top left
  let headerH = 22; // default text height
  if (settings.pdfLogoUrl) {
    try {
      const logoResp = await fetch(settings.pdfLogoUrl);
      const logoBytes = new Uint8Array(await logoResp.arrayBuffer());
      const isPng = settings.pdfLogoUrl.toLowerCase().includes('.png') ||
        (logoBytes[0] === 0x89 && logoBytes[1] === 0x50);
      const logoImage = isPng
        ? await pdfDoc.embedPng(logoBytes)
        : await pdfDoc.embedJpg(logoBytes);
      const logoMaxH = 40;
      const logoMaxW = coBoxX - MARGIN - 20;
      const scale = Math.min(logoMaxW / logoImage.width, logoMaxH / logoImage.height, 1);
      const logoW = logoImage.width * scale;
      const logoH = logoImage.height * scale;
      page.drawImage(logoImage, {
        x: MARGIN,
        y: y - logoH + 22, // align bottom with text baseline area
        width: logoW,
        height: logoH,
      });
      headerH = logoH;
    } catch {
      // Logo fetch/embed failed — fall back to text
      const companyDisplayName = settings.companyName.toUpperCase();
      page.drawText(companyDisplayName, {
        x: MARGIN, y, size: 22, font: fontBold, color: DARK_TEAL,
      });
    }
  } else {
    const companyDisplayName = settings.companyName.toUpperCase();
    const maxCompanyW = coBoxX - MARGIN - 10;
    const displayText = truncateText(companyDisplayName, fontBold, 22, maxCompanyW);
    page.drawText(displayText, {
      x: MARGIN, y, size: 22, font: fontBold, color: DARK_TEAL,
    });
  }

  // Draw CHANGE ORDER box aligned with company name baseline
  const coBoxY = y - coPadY;
  page.drawRectangle({
    x: coBoxX, y: coBoxY, width: coBoxW, height: coBoxH, color: TEAL,
  });
  page.drawText(coLabel, {
    x: coBoxX + coPadX, y: coBoxY + coPadY, size: coFontSize, font: fontBold, color: WHITE,
  });

  // Move past the header
  y -= Math.max(headerH, coBoxH) + 12;

  // Horizontal rule
  page.drawRectangle({
    x: MARGIN, y, width: CONTENT_W, height: 2, color: DARK_TEAL,
  });
  y -= SECTION_GAP;

  /* ════════════════════════════════════════════════════════
   * TWO-COLUMN: Company info (left)  |  Document details (right)
   * ════════════════════════════════════════════════════════ */

  // Right column starts at 55% of content width, with a 20px gutter
  const colRightStart = MARGIN + CONTENT_W * 0.55 + 10;
  const savedY = y;

  // ── Left column: company info ──
  // Max width for left column text: stop before right column starts (with gutter)
  const leftColMaxW = colRightStart - MARGIN - 20;

  const companyLine = settings.companyName || 'DW Tailored Systems';
  page.drawText(truncateText(companyLine, fontBold, 11, leftColMaxW), {
    x: MARGIN, y, size: 11, font: fontBold, color: CHARCOAL,
  });
  y -= LINE_H;

  // Render from-address lines (user-customizable)
  const fromLines = (settings.invoiceFromAddress || 'Devin Wilson\nCustom software & consulting\ninfo@dwtailored.com')
    .split('\n')
    .filter(Boolean);
  for (const line of fromLines) {
    page.drawText(truncateText(line.trim(), font, 9, leftColMaxW), {
      x: MARGIN, y, size: 9, font, color: GRAY,
    });
    y -= 14;
  }
  const leftColEndY = y;

  // ── Right column: document details ──
  let ry = savedY;
  const labelX = colRightStart;
  const valX = colRightStart + 105;
  // Max width for value text: must not exceed rightX
  const maxValW = rightX - valX;

  const orderDate = workItem.createdAt.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const statusLabel = WORK_ITEM_STATUS_LABELS[workItem.status] ?? workItem.status;

  const detailRows: Array<{ label: string; value: string }> = [
    { label: 'Invoice #:', value: workItem.id ?? '—' },
    { label: 'Date:', value: orderDate },
    { label: 'Status:', value: statusLabel },
  ];

  if (workItem.scheduledDate) {
    const due = workItem.scheduledDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    detailRows.push({ label: 'Due Date:', value: due });
  }

  for (const row of detailRows) {
    page.drawText(row.label, { x: labelX, y: ry, size: 9, font: fontBold, color: GRAY });
    const truncVal = truncateText(row.value, font, 9, maxValW);
    page.drawText(truncVal, { x: valX, y: ry, size: 9, font, color: CHARCOAL });
    ry -= LINE_H;
  }

  // Resume below whichever column is lower
  y = Math.min(leftColEndY, ry) - SECTION_GAP;

  /* ════════════════════════════════════════════════════════
   * BILL TO
   * ════════════════════════════════════════════════════════ */
  page.drawRectangle({
    x: MARGIN, y, width: CONTENT_W, height: 1, color: TABLE_BORDER,
  });
  y -= 18;

  page.drawText('BILL TO', {
    x: MARGIN, y, size: 10, font: fontBold, color: TEAL,
  });
  y -= LINE_H;

  const clientLines = [
    client.name,
    client.company,
    client.email,
    client.phone,
  ].filter(Boolean) as string[];

  for (const line of clientLines) {
    const truncLine = truncateText(line, font, 10, CONTENT_W - 10);
    page.drawText(truncLine, { x: MARGIN, y, size: 10, font, color: CHARCOAL });
    y -= LINE_H;
  }
  y -= 8;

  /* ════════════════════════════════════════════════════════
   * SUBJECT
   * ════════════════════════════════════════════════════════ */
  page.drawRectangle({
    x: MARGIN, y, width: CONTENT_W, height: 1, color: TABLE_BORDER,
  });
  y -= 18;

  page.drawText('SUBJECT', {
    x: MARGIN, y, size: 10, font: fontBold, color: TEAL,
  });
  y -= LINE_H;

  const subjectMaxW = CONTENT_W - 10;
  const subjectLines = wrapText(workItem.subject, font, 10, subjectMaxW);
  for (const sl of subjectLines) {
    ensureSpace(LINE_H);
    page.drawText(sl, { x: MARGIN, y, size: 10, font, color: CHARCOAL });
    y -= LINE_H;
  }
  y -= 10;

  /* ════════════════════════════════════════════════════════
   * LINE ITEMS TABLE
   * ════════════════════════════════════════════════════════ */

  // Column positions — keep everything within MARGIN to rightX
  const colNum   = MARGIN;
  const colDesc  = MARGIN + 32;
  const colHrs   = MARGIN + CONTENT_W - 200;
  const colRate  = MARGIN + CONTENT_W - 130;
  const colAmt   = rightX - 8;  // right-align amounts with inner padding
  const rowH     = 24;      // enough height to prevent row bleed

  // Right-align positions for numeric columns (right edge of each zone)
  const hrsAlignRight  = colHrs + 40;
  const rateAlignRight = colRate + 50;

  // ── Table header ──
  ensureSpace(rowH + 10);
  const headerRectY = y - 8;
  page.drawRectangle({
    x: MARGIN, y: headerRectY, width: CONTENT_W, height: rowH + 4, color: DARK_TEAL,
  });

  const headerY = y;
  const hrsHeaderW  = fontBold.widthOfTextAtSize('Hours', 9);
  const rateHeaderW = fontBold.widthOfTextAtSize('Rate', 9);
  const amtHeaderW  = fontBold.widthOfTextAtSize('Amount', 9);

  page.drawText('#',           { x: colNum  + 8,                y: headerY, size: 9, font: fontBold, color: WHITE });
  page.drawText('Description', { x: colDesc + 4,                y: headerY, size: 9, font: fontBold, color: WHITE });
  page.drawText('Hours',       { x: hrsAlignRight - hrsHeaderW, y: headerY, size: 9, font: fontBold, color: WHITE });
  page.drawText('Rate',        { x: rateAlignRight - rateHeaderW, y: headerY, size: 9, font: fontBold, color: WHITE });
  page.drawText('Amount',      { x: colAmt - amtHeaderW,        y: headerY, size: 9, font: fontBold, color: WHITE });

  y -= rowH + 10;

  // ── Table rows ──
  const descMaxW = colHrs - colDesc - 20;

  for (let i = 0; i < workItem.lineItems.length; i++) {
    const item = workItem.lineItems[i];

    // Page-break guard — need space for row + bottom border
    ensureSpace(rowH + 4);

    // Stripe
    if (i % 2 === 0) {
      page.drawRectangle({
        x: MARGIN, y: y - 8, width: CONTENT_W, height: rowH, color: TABLE_STRIPE,
      });
    }

    // Bottom border
    page.drawRectangle({
      x: MARGIN, y: y - 8, width: CONTENT_W, height: 0.5, color: TABLE_BORDER,
    });

    const lineNum = String(i + 1);
    const desc = truncateText(item.description, font, 9, descMaxW);
    const hrs  = item.hours.toFixed(1);
    const rate = fmtCurrency(item.hours > 0 ? item.cost / item.hours : item.cost);
    const amt  = fmtCurrency(item.cost);

    page.drawText(lineNum, { x: colNum + 8, y, size: 9, font, color: GRAY });
    page.drawText(desc,    { x: colDesc + 4, y, size: 9, font, color: CHARCOAL });

    // Right-align numeric columns within their zones
    const hrsW  = font.widthOfTextAtSize(hrs, 9);
    const rateW = font.widthOfTextAtSize(rate, 9);
    const amtW  = font.widthOfTextAtSize(amt, 9);
    page.drawText(hrs,  { x: hrsAlignRight - hrsW,  y, size: 9, font, color: CHARCOAL });
    page.drawText(rate, { x: rateAlignRight - rateW, y, size: 9, font, color: CHARCOAL });
    page.drawText(amt,  { x: colAmt - amtW,          y, size: 9, font, color: CHARCOAL });

    y -= rowH;
  }

  // Table bottom border
  page.drawRectangle({
    x: MARGIN, y: y - 4, width: CONTENT_W, height: 1.5, color: DARK_TEAL,
  });
  y -= SECTION_GAP;

  /* ════════════════════════════════════════════════════════
   * TOTALS (right-aligned block)
   * ════════════════════════════════════════════════════════ */

  // Ensure enough space for the totals block (~120px)
  ensureSpace(130);

  const totalsLabelX = MARGIN + CONTENT_W - 210;

  // Subtotal
  const subtotalStr = fmtCurrency(workItem.totalCost);
  page.drawText('Subtotal', { x: totalsLabelX, y, size: 10, font, color: GRAY });
  const subtotalW = font.widthOfTextAtSize(subtotalStr, 10);
  page.drawText(subtotalStr, { x: rightX - subtotalW, y, size: 10, font, color: CHARCOAL });
  y -= 18;

  // Rate
  const rateStr = `${fmtCurrency(settings.hourlyRate)} / hr`;
  page.drawText('Rate', { x: totalsLabelX, y, size: 10, font, color: GRAY });
  const rateStrW = font.widthOfTextAtSize(rateStr, 10);
  page.drawText(rateStr, { x: rightX - rateStrW, y, size: 10, font, color: CHARCOAL });
  y -= 18;

  // Total Hours
  const totalHrsStr = workItem.totalHours.toFixed(1) + ' hrs';
  page.drawText('Total Hours', { x: totalsLabelX, y, size: 10, font, color: GRAY });
  const totalHrsW = font.widthOfTextAtSize(totalHrsStr, 10);
  page.drawText(totalHrsStr, { x: rightX - totalHrsW, y, size: 10, font, color: CHARCOAL });
  y -= 18;

  // Tax
  const taxAmount = settings.taxRate && settings.taxRate > 0
    ? workItem.totalCost * (settings.taxRate / 100)
    : 0;

  if (settings.taxRate && settings.taxRate > 0) {
    const taxLabel = `Tax (${settings.taxRate}%)`;
    const taxStr = fmtCurrency(taxAmount);
    page.drawText(taxLabel, { x: totalsLabelX, y, size: 10, font, color: GRAY });
    const taxW = font.widthOfTextAtSize(taxStr, 10);
    page.drawText(taxStr, { x: rightX - taxW, y, size: 10, font, color: CHARCOAL });
    y -= 18;
  }

  y -= 4;

  // Separator above total
  page.drawRectangle({
    x: totalsLabelX, y: y + 4, width: rightX - totalsLabelX, height: 1, color: TABLE_BORDER,
  });
  y -= 8;

  // TOTAL — large, bold, prominent
  const totalStr = fmtCurrency(workItem.totalCost + taxAmount);
  page.drawText('TOTAL', { x: totalsLabelX, y, size: 14, font: fontBold, color: CHARCOAL });
  const totalW = fontBold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, { x: rightX - totalW, y, size: 14, font: fontBold, color: DARK_TEAL });
  y -= SECTION_GAP;

  // Billing type
  if (workItem.deductFromRetainer) {
    page.drawText('Billing Type: Retainer', {
      x: totalsLabelX, y, size: 9, font: fontBold, color: RETAINER_ORANGE,
    });
    y -= 14;
    page.drawText('Hours will be deducted from retainer balance.', {
      x: totalsLabelX, y, size: 8, font, color: RETAINER_ORANGE,
    });
  } else {
    page.drawText('Billing Type: Hourly', {
      x: totalsLabelX, y, size: 9, font, color: GRAY,
    });
  }
  y -= SECTION_GAP;

  /* ════════════════════════════════════════════════════════
   * TERMS / FOOTER
   * ════════════════════════════════════════════════════════ */
  // Terms block needs ~60px of space
  const termsHeight = 60;
  if (y - termsHeight > FOOTER_ZONE) {
    page.drawRectangle({
      x: MARGIN, y, width: CONTENT_W, height: 1, color: TABLE_BORDER,
    });
    y -= 18;

    page.drawText('Terms & Conditions', {
      x: MARGIN, y, size: 9, font: fontBold, color: CHARCOAL,
    });
    y -= 14;

    const termsText = settings.invoiceTerms
      || 'This work order is subject to acceptance. Please review and confirm before work begins.\nPayment is due upon completion unless other terms have been arranged.';
    const termsLines = termsText.split('\n').filter(Boolean);
    for (const tLine of termsLines) {
      page.drawText(truncateText(tLine.trim(), font, 8, CONTENT_W - 10), {
        x: MARGIN, y, size: 8, font, color: GRAY,
      });
      y -= 12;
    }
  }

  // Notes section (user-customizable)
  if (settings.invoiceNotes && y - 40 > FOOTER_ZONE) {
    y -= 8;
    page.drawText('Notes', {
      x: MARGIN, y, size: 9, font: fontBold, color: CHARCOAL,
    });
    y -= 14;
    const notesLines = settings.invoiceNotes.split('\n').filter(Boolean);
    for (const nLine of notesLines) {
      if (y - 12 < FOOTER_ZONE) break;
      page.drawText(truncateText(nLine.trim(), font, 8, CONTENT_W - 10), {
        x: MARGIN, y, size: 8, font, color: GRAY,
      });
      y -= 12;
    }
  }

  // Draw footer on every page that doesn't already have one
  for (const p of pdfDoc.getPages()) {
    if (!footeredPages.has(p)) {
      drawFooter(p, font, settings);
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/* ──────────────────────────────────────────────────────────
 * Footer bar + attribution on every page
 * ────────────────────────────────────────────────────────── */
function drawFooter(
  page: PDFPage,
  font: PDFFont,
  settings: PdfSettings,
): void {
  // Position footer bar within the bottom margin area
  const barY = MARGIN - 20;
  // Dark teal footer bar
  page.drawRectangle({
    x: MARGIN, y: barY, width: CONTENT_W, height: FOOTER_BAR_H, color: DARK_TEAL,
  });

  // Attribution text centered below the bar
  const attrib = `Generated by ${settings.companyName || 'DW Tailored Systems'} via Open TEN99`;
  const attribW = font.widthOfTextAtSize(attrib, 7);
  const attribX = MARGIN + (CONTENT_W - attribW) / 2;
  // Ensure attribution doesn't go outside margins
  const clampedAttribX = Math.max(MARGIN, Math.min(attribX, MARGIN + CONTENT_W - attribW));
  page.drawText(attrib, {
    x: clampedAttribX,
    y: barY - 12,
    size: 7,
    font,
    color: LIGHT_GRAY,
  });
}

/* ──────────────────────────────────────────────────────────
 * Text utilities
 * ────────────────────────────────────────────────────────── */
function truncateText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return text;
  let current = text;
  while (font.widthOfTextAtSize(current + '...', fontSize) > maxWidth && current.length > 0) {
    current = current.slice(0, -1);
  }
  return current + '...';
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function fmtCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
