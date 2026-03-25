/**
 * Scoring utilities for matching receipts to bank transactions.
 * All scores are in the range [0, 1].
 */

export interface ReceiptData {
  vendor?: string;
  amount?: number;
  date?: Date;
}

export interface TransactionData {
  amount: number;
  date: Date;
  description: string;
}

/**
 * Scores how closely a receipt amount matches a transaction amount.
 * Compares absolute values since transactions store expenses as negative.
 *
 * - Exact match: 1.0
 * - Within ±$1: 0.8
 * - Within ±5%: 0.5
 * - Otherwise: 0
 */
export function scoreReceiptAmount(receiptAmount: number, txAmount: number): number {
  const ra = Math.abs(receiptAmount);
  const ta = Math.abs(txAmount);

  if (ra === 0 && ta === 0) return 1.0;
  if (ra === 0 || ta === 0) return 0;

  const diff = Math.abs(ra - ta);

  if (diff === 0) return 1.0;
  if (diff <= 1.0) return 0.8;
  if (diff / ra <= 0.05) return 0.5;
  return 0;
}

/**
 * Scores how closely a receipt date matches a transaction date.
 *
 * - Same day: 1.0
 * - Within ±1 day: 0.8
 * - Within ±3 days: 0.5
 * - Otherwise: 0
 */
export function scoreReceiptDate(receiptDate: Date, txDate: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffDays = Math.abs(receiptDate.getTime() - txDate.getTime()) / MS_PER_DAY;

  if (diffDays < 0.5) return 1.0;
  if (diffDays <= 1) return 0.8;
  if (diffDays <= 3) return 0.5;
  return 0;
}

/**
 * Scores how closely a receipt vendor matches a transaction description.
 * Case-insensitive comparison.
 *
 * - Substring match: 1.0
 * - Normalized partial match (>50% of vendor in description): 0.7
 * - Otherwise: 0
 */
export function scoreReceiptVendor(vendor: string, description: string): number {
  const v = vendor.toLowerCase().trim();
  const d = description.toLowerCase().trim();

  if (!v || !d) return 0;
  if (d.includes(v) || v.includes(d)) return 1.0;

  const vendorWords = v.split(/\s+/).filter((w) => w.length > 2);
  if (vendorWords.length === 0) return 0;

  const matchedWords = vendorWords.filter((w) => d.includes(w));
  const ratio = matchedWords.length / vendorWords.length;

  if (ratio > 0.5) return 0.7;
  return 0;
}

/**
 * Computes a weighted composite match score between a receipt and a transaction.
 *
 * Weights:
 * - Amount: 0.5
 * - Vendor: 0.3
 * - Date:   0.2
 */
export function computeReceiptMatchScore(receipt: ReceiptData, tx: TransactionData): number {
  const amountScore = receipt.amount != null ? scoreReceiptAmount(receipt.amount, tx.amount) : 0;
  const vendorScore = receipt.vendor ? scoreReceiptVendor(receipt.vendor, tx.description) : 0;
  const dateScore = receipt.date ? scoreReceiptDate(receipt.date, tx.date) : 0;

  return amountScore * 0.5 + vendorScore * 0.3 + dateScore * 0.2;
}
