import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

interface LineItem {
  description: string;
  hours: number;
  cost: number;
}

interface WorkItemData {
  clientId: string;
  subject: string;
  lineItems: LineItem[];
  totalHours: number;
  totalCost: number;
  status: string;
  createdAt: admin.firestore.Timestamp;
  [key: string]: unknown;
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
}

/**
 * Callable Cloud Function that generates a professional change order PDF
 * from a workItem document, uploads it to Firebase Storage, and updates
 * the workItem with the download URL.
 */
export const generatePDF = onCall(
  { maxInstances: 10, timeoutSeconds: 120 },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to generate PDFs."
      );
    }

    const { workItemId } = request.data as { workItemId?: string };
    if (!workItemId || typeof workItemId !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "workItemId is required and must be a string."
      );
    }

    const db = admin.firestore();

    try {
      // --- Fetch work item ---
      const workItemSnap = await db
        .collection("workItems")
        .doc(workItemId)
        .get();

      if (!workItemSnap.exists) {
        throw new HttpsError(
          "not-found",
          `Work item ${workItemId} not found.`
        );
      }

      const workItem = workItemSnap.data() as WorkItemData;

      // --- Fetch client ---
      const clientSnap = await db
        .collection("clients")
        .doc(workItem.clientId)
        .get();
      if (!clientSnap.exists) {
        throw new HttpsError(
          "not-found",
          "Client referenced by this work item was not found."
        );
      }
      const client = clientSnap.data() as ClientData;

      // --- Fetch settings ---
      const settingsSnap = await db
        .collection("settings")
        .doc(request.auth.uid)
        .get();

      // Fall back to sensible defaults if settings doc doesn't exist yet
      const settings: SettingsData = settingsSnap.exists
        ? (settingsSnap.data() as SettingsData)
        : {
            companyName: "My Company",
            hourlyRate: 150,
          };

      // --- Generate PDF ---
      const pdfBytes = await buildChangeOrderPdf(
        workItem,
        client,
        settings,
        workItemId
      );

      // --- Upload to Firebase Storage ---
      const bucket = admin.storage().bucket();
      const filePath = `changeOrders/${workItemId}.pdf`;
      const file = bucket.file(filePath);

      await file.save(Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        metadata: {
          metadata: {
            workItemId,
            generatedBy: request.auth.uid,
          },
        },
      });

      // Make the file accessible via a signed URL valid for 7 days
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      // --- Update work item ---
      await db.collection("workItems").doc(workItemId).update({
        pdfUrl: signedUrl,
        pdfStoragePath: filePath,
        status: "approved",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("PDF generated and uploaded", {
        workItemId,
        filePath,
      });

      return {
        success: true,
        pdfUrl: signedUrl,
        storagePath: filePath,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("PDF generation failed", { error, workItemId });
      throw new HttpsError(
        "internal",
        "Failed to generate PDF. Please try again."
      );
    }
  }
);

/**
 * Builds a professional change order PDF document.
 */
async function buildChangeOrderPdf(
  workItem: WorkItemData,
  client: ClientData,
  settings: SettingsData,
  workItemId: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const darkColor = rgb(0.15, 0.15, 0.15);
  const grayColor = rgb(0.4, 0.4, 0.4);
  const accentColor = rgb(0.2, 0.4, 0.7);
  const lightGrayBg = rgb(0.95, 0.95, 0.95);

  // --- Header: Company Name ---
  page.drawText(settings.companyName, {
    x: margin,
    y,
    size: 22,
    font: helveticaBold,
    color: accentColor,
  });
  y -= 30;

  // --- Title ---
  page.drawText("CHANGE ORDER", {
    x: margin,
    y,
    size: 16,
    font: helveticaBold,
    color: darkColor,
  });
  y -= 24;

  // Horizontal rule
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.5,
    color: accentColor,
  });
  y -= 24;

  // --- Meta info ---
  const orderDate = workItem.createdAt
    ? workItem.createdAt.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const metaLines = [
    { label: "Order ID:", value: workItemId },
    { label: "Date:", value: orderDate },
    { label: "Subject:", value: workItem.subject },
  ];

  for (const meta of metaLines) {
    page.drawText(meta.label, {
      x: margin,
      y,
      size: 10,
      font: helveticaBold,
      color: grayColor,
    });
    page.drawText(meta.value, {
      x: margin + 80,
      y,
      size: 10,
      font: helvetica,
      color: darkColor,
    });
    y -= 16;
  }
  y -= 8;

  // --- Client info ---
  page.drawText("CLIENT", {
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
    page.drawText(line, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: darkColor,
    });
    y -= 14;
  }
  y -= 16;

  // --- Line Items Table ---
  page.drawText("LINE ITEMS", {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: accentColor,
  });
  y -= 20;

  // Table header
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

  page.drawText("Description", {
    x: colDescription + 6,
    y: y,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Hours", {
    x: colHours,
    y: y,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Cost", {
    x: colCost,
    y: y,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  y -= 22;

  // Table rows
  for (let i = 0; i < workItem.lineItems.length; i++) {
    const item = workItem.lineItems[i];

    // Check if we need a new page (leave room for totals)
    if (y < margin + 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    // Alternate row background
    if (i % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: contentWidth,
        height: 18,
        color: lightGrayBg,
      });
    }

    // Truncate long descriptions to fit the column
    const desc = truncateText(
      item.description,
      helvetica,
      10,
      colHours - colDescription - 16
    );

    page.drawText(desc, {
      x: colDescription + 6,
      y,
      size: 10,
      font: helvetica,
      color: darkColor,
    });

    page.drawText(item.hours.toFixed(1), {
      x: colHours,
      y,
      size: 10,
      font: helvetica,
      color: darkColor,
    });

    page.drawText(formatCurrency(item.cost), {
      x: colCost,
      y,
      size: 10,
      font: helvetica,
      color: darkColor,
    });

    y -= 20;
  }

  y -= 8;

  // Separator line above totals
  page.drawLine({
    start: { x: colHours - 10, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: grayColor,
  });
  y -= 18;

  // --- Totals ---
  page.drawText("Total Hours:", {
    x: colHours - 70,
    y,
    size: 11,
    font: helveticaBold,
    color: darkColor,
  });
  page.drawText(workItem.totalHours.toFixed(1), {
    x: colHours,
    y,
    size: 11,
    font: helveticaBold,
    color: darkColor,
  });
  y -= 18;

  page.drawText("Total Cost:", {
    x: colHours - 70,
    y,
    size: 11,
    font: helveticaBold,
    color: darkColor,
  });
  page.drawText(formatCurrency(workItem.totalCost), {
    x: colCost,
    y,
    size: 11,
    font: helveticaBold,
    color: accentColor,
  });
  y -= 18;

  page.drawText(`Rate: ${formatCurrency(settings.hourlyRate)}/hr`, {
    x: colHours - 70,
    y,
    size: 9,
    font: helvetica,
    color: grayColor,
  });
  y -= 36;

  // --- Footer ---
  if (y > margin + 30) {
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: lightGrayBg,
    });
    y -= 16;
    page.drawText(
      "This change order is subject to acceptance. Please review and confirm.",
      {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: grayColor,
      }
    );
    y -= 14;
    page.drawText(`Generated by ${settings.companyName} via OpenChanges`, {
      x: margin,
      y,
      size: 8,
      font: helvetica,
      color: grayColor,
    });
  }

  return pdfDoc.save();
}

/**
 * Truncates text to fit within a given width using the font metrics.
 */
function truncateText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string {
  let current = text;
  while (font.widthOfTextAtSize(current, fontSize) > maxWidth && current.length > 0) {
    current = current.slice(0, -1);
  }
  if (current.length < text.length && current.length > 3) {
    current = current.slice(0, -3) + "...";
  }
  return current;
}

/**
 * Formats a number as USD currency string.
 */
function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
