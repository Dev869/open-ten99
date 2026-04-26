import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

interface LineItem {
  description: string;
  hours: number;
  cost: number;
  costOverride?: number | null;
}

interface QuoteData {
  ownerId?: string;
  clientId: string;
  title: string;
  description?: string;
  status: string;
  quoteNumber?: string;
  validUntil?: admin.firestore.Timestamp;
  lineItems: LineItem[];
  totalHours: number;
  totalCost: number;
  taxRate?: number | null;
  discount?: number | null;
  terms?: string | null;
  createdAt?: admin.firestore.Timestamp;
}

interface ClientData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
}

interface SettingsData {
  companyName: string;
  hourlyRate: number;
  accentColor?: string;
  pdfLogoUrl?: string;
  invoiceTaxRate?: number;
  invoiceTerms?: string;
  invoiceFromAddress?: string;
}

/**
 * Generates a quote PDF, uploads to Storage, and stamps the quote document
 * with the resulting URL. Mirrors generatePDF (work order) intentionally so
 * the two stay easy to maintain side by side.
 */
export const generateQuotePDF = onCall(
  { cors: true, maxInstances: 10, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to generate PDFs.");
    }

    const { quoteId } = request.data as { quoteId?: string };
    if (!quoteId || typeof quoteId !== "string") {
      throw new HttpsError("invalid-argument", "quoteId is required and must be a string.");
    }

    const db = admin.firestore();

    try {
      const quoteSnap = await db.collection("quotes").doc(quoteId).get();
      if (!quoteSnap.exists) {
        throw new HttpsError("not-found", `Quote ${quoteId} not found.`);
      }
      const quote = quoteSnap.data() as QuoteData;

      if (quote.ownerId && quote.ownerId !== request.auth?.uid) {
        throw new HttpsError("permission-denied", "Not authorized to generate this PDF");
      }

      const clientSnap = await db.collection("clients").doc(quote.clientId).get();
      if (!clientSnap.exists) {
        throw new HttpsError("not-found", "Client referenced by this quote was not found.");
      }
      const client = clientSnap.data() as ClientData;

      const settingsSnap = await db.collection("settings").doc(request.auth.uid).get();
      const settings: SettingsData = settingsSnap.exists
        ? (settingsSnap.data() as SettingsData)
        : { companyName: "My Company", hourlyRate: 150 };

      const pdfBytes = await buildQuotePdf(quote, client, settings, quoteId);

      const bucket = admin.storage().bucket();
      const filePath = `quotes/${quoteId}.pdf`;
      const file = bucket.file(filePath);

      await file.save(Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        metadata: {
          metadata: {
            quoteId,
            generatedBy: request.auth.uid,
          },
        },
      });

      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      await db.collection("quotes").doc(quoteId).update({
        pdfUrl: signedUrl,
        pdfStoragePath: filePath,
        ownerId: request.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("Quote PDF generated", { quoteId, filePath });

      return { success: true, pdfUrl: signedUrl, storagePath: filePath };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Quote PDF generation failed", { error, quoteId });
      throw new HttpsError("internal", "Failed to generate quote PDF. Please try again.");
    }
  }
);

async function buildQuotePdf(
  quote: QuoteData,
  client: ClientData,
  settings: SettingsData,
  quoteId: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const darkColor = rgb(0.15, 0.15, 0.15);
  const grayColor = rgb(0.4, 0.4, 0.4);
  const accentColor = rgb(0.2, 0.4, 0.7);
  const lightGrayBg = rgb(0.95, 0.95, 0.95);

  // Header
  page.drawText(settings.companyName, {
    x: margin,
    y,
    size: 22,
    font: helveticaBold,
    color: accentColor,
  });
  y -= 30;

  page.drawText("QUOTE", {
    x: margin,
    y,
    size: 16,
    font: helveticaBold,
    color: darkColor,
  });
  y -= 24;

  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.5,
    color: accentColor,
  });
  y -= 24;

  // Meta
  const created = quote.createdAt
    ? quote.createdAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const validUntil = quote.validUntil
    ? quote.validUntil.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const metaLines = [
    { label: "Quote #:", value: quote.quoteNumber || quoteId },
    { label: "Date:", value: created },
    { label: "Valid until:", value: validUntil },
    { label: "Subject:", value: quote.title },
  ];
  for (const meta of metaLines) {
    page.drawText(meta.label, { x: margin, y, size: 10, font: helveticaBold, color: grayColor });
    page.drawText(meta.value, { x: margin + 90, y, size: 10, font: helvetica, color: darkColor });
    y -= 16;
  }
  y -= 8;

  // Client
  page.drawText("PREPARED FOR", {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: accentColor,
  });
  y -= 16;
  const clientLines = [
    client.name,
    client.company ? client.company : null,
    client.email,
    client.phone ? client.phone : null,
  ].filter(Boolean) as string[];
  for (const line of clientLines) {
    page.drawText(line, { x: margin, y, size: 10, font: helvetica, color: darkColor });
    y -= 14;
  }
  y -= 16;

  // Description
  if (quote.description) {
    page.drawText("SCOPE", {
      x: margin,
      y,
      size: 11,
      font: helveticaBold,
      color: accentColor,
    });
    y -= 16;
    const wrapped = wrapText(quote.description, helvetica, 10, contentWidth);
    for (const line of wrapped) {
      if (y < margin + 100) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: 10, font: helvetica, color: darkColor });
      y -= 14;
    }
    y -= 8;
  }

  // Line items
  page.drawText("LINE ITEMS", {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: accentColor,
  });
  y -= 20;

  const colDescription = margin;
  const colHours = margin + contentWidth - 160;
  const colCost = margin + contentWidth - 70;

  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: contentWidth,
    height: 18,
    color: accentColor,
  });
  page.drawText("Description", { x: colDescription + 6, y, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  page.drawText("Hours", { x: colHours, y, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  page.drawText("Cost", { x: colCost, y, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  y -= 22;

  for (let i = 0; i < quote.lineItems.length; i++) {
    const item = quote.lineItems[i];
    if (y < margin + 100) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (i % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: contentWidth,
        height: 18,
        color: lightGrayBg,
      });
    }
    const desc = truncateText(item.description ?? '', helvetica, 10, colHours - colDescription - 16);
    const cost = item.costOverride != null ? item.costOverride : (item.cost ?? 0);
    const hours = item.hours ?? 0;
    page.drawText(desc, { x: colDescription + 6, y, size: 10, font: helvetica, color: darkColor });
    page.drawText(hours.toFixed(2), { x: colHours, y, size: 10, font: helvetica, color: darkColor });
    page.drawText(formatCurrency(cost), { x: colCost, y, size: 10, font: helvetica, color: darkColor });
    y -= 20;
  }

  y -= 8;
  page.drawLine({
    start: { x: colHours - 10, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: grayColor,
  });
  y -= 18;

  const subtotal = quote.totalCost ?? 0;
  const discount = quote.discount ?? 0;
  const taxedBase = Math.max(0, subtotal - discount);
  const taxRate = quote.taxRate ?? settings.invoiceTaxRate ?? 0;
  const tax = (taxedBase * taxRate) / 100;
  const grand = taxedBase + tax;

  drawTotalsRow(page, "Subtotal", formatCurrency(subtotal), colHours, colCost, y, helveticaBold, helvetica, darkColor, false);
  y -= 16;
  if (discount > 0) {
    drawTotalsRow(page, "Discount", `- ${formatCurrency(discount)}`, colHours, colCost, y, helveticaBold, helvetica, darkColor, false);
    y -= 16;
  }
  if (tax > 0) {
    drawTotalsRow(page, `Tax (${taxRate}%)`, formatCurrency(tax), colHours, colCost, y, helveticaBold, helvetica, darkColor, false);
    y -= 16;
  }
  drawTotalsRow(page, "Total", formatCurrency(grand), colHours, colCost, y, helveticaBold, helveticaBold, accentColor, true);
  y -= 30;

  // Terms
  const termsText = quote.terms || settings.invoiceTerms;
  if (termsText && y > margin + 60) {
    page.drawText("TERMS", { x: margin, y, size: 11, font: helveticaBold, color: accentColor });
    y -= 16;
    const wrapped = wrapText(termsText, helvetica, 9, contentWidth);
    for (const line of wrapped) {
      if (y < margin + 30) break;
      page.drawText(line, { x: margin, y, size: 9, font: helvetica, color: grayColor });
      y -= 12;
    }
  }

  return pdfDoc.save();
}

function drawTotalsRow(
  page: ReturnType<PDFDocument["addPage"]>,
  label: string,
  value: string,
  colHours: number,
  colCost: number,
  y: number,
  labelFont: PDFFont,
  valueFont: PDFFont,
  color: ReturnType<typeof rgb>,
  bold: boolean,
) {
  page.drawText(label, { x: colHours - 70, y, size: bold ? 12 : 10, font: labelFont, color });
  page.drawText(value, { x: colCost, y, size: bold ? 12 : 10, font: valueFont, color });
}

function truncateText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  let current = text;
  while (font.widthOfTextAtSize(current, fontSize) > maxWidth && current.length > 0) {
    current = current.slice(0, -1);
  }
  if (current.length < text.length && current.length > 3) {
    current = current.slice(0, -3) + "...";
  }
  return current;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    if (paragraph === "") lines.push("");
  }
  return lines;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
