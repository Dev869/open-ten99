import type { Receipt, Transaction } from './types';

export function computeReceiptMatchScoreClient(receipt: Receipt, tx: Transaction): number {
  let score = 0;

  // Amount (weight: 0.5)
  if (receipt.amount != null) {
    const ra = Math.abs(receipt.amount);
    const ta = Math.abs(tx.amount);
    const diff = Math.abs(ra - ta);
    if (diff === 0) score += 0.5;
    else if (diff <= 1) score += 0.4;
    else if (ra > 0 && diff / ra <= 0.05) score += 0.25;
  }

  // Vendor (weight: 0.3)
  if (receipt.vendor) {
    const v = receipt.vendor.toLowerCase();
    const d = tx.description.toLowerCase();
    if (d.includes(v) || v.includes(d)) score += 0.3;
    else {
      const words = v.split(/\s+/).filter((w) => w.length > 2);
      const matched = words.filter((w) => d.includes(w));
      if (words.length > 0 && matched.length / words.length > 0.5) score += 0.21;
    }
  }

  // Date (weight: 0.2)
  if (receipt.date) {
    const diffMs = Math.abs(receipt.date.getTime() - tx.date.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0.5) score += 0.2;
    else if (diffDays <= 1) score += 0.16;
    else if (diffDays <= 3) score += 0.1;
  }

  return score;
}
