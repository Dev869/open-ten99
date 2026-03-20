/**
 * Scoring utilities for matching bank transactions to invoices.
 * All scores are in the range [0, 1].
 */

export interface Transaction {
  amount: number;
  date: Date;
  description: string;
}

export interface Invoice {
  totalCost: number;
  invoiceSentDate: Date;
  clientName: string;
}

/**
 * Computes the longest common subsequence length of two strings.
 */
function longestCommonSubsequence(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Scores how closely a transaction amount matches an invoice amount.
 * Uses absolute values for comparison.
 *
 * - Exact match: 1.0
 * - Within 2%: 0.8
 * - Within 5%: 0.5
 * - Otherwise: 0
 */
export function scoreAmount(txAmount: number, invoiceAmount: number): number {
  const tx = Math.abs(txAmount);
  const inv = Math.abs(invoiceAmount);

  if (inv === 0 && tx === 0) return 1.0;
  if (inv === 0) return 0;

  const diff = Math.abs(tx - inv) / inv;

  if (diff === 0) return 1.0;
  if (diff <= 0.02) return 0.8;
  if (diff <= 0.05) return 0.5;
  return 0;
}

/**
 * Scores how closely a transaction date matches an invoice date.
 *
 * - Same day: 1.0
 * - Within 3 days: 0.8
 * - Within 7 days: 0.5
 * - Within 14 days: 0.2
 * - Otherwise: 0
 */
export function scoreDate(txDate: Date, invoiceDate: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffDays = Math.abs(txDate.getTime() - invoiceDate.getTime()) / MS_PER_DAY;

  if (diffDays === 0) return 1.0;
  if (diffDays <= 3) return 0.8;
  if (diffDays <= 7) return 0.5;
  if (diffDays <= 14) return 0.2;
  return 0;
}

/**
 * Scores how closely a transaction description matches a client name.
 *
 * - Case-insensitive substring match: 1.0
 * - LCS similarity > 0.8 (relative to client name length): 0.7
 * - Otherwise: 0
 */
export function scoreName(description: string, clientName: string): number {
  const descLower = description.toLowerCase();
  const nameLower = clientName.toLowerCase();

  if (descLower.includes(nameLower)) return 1.0;

  const lcsLen = longestCommonSubsequence(descLower, nameLower);
  const similarity = lcsLen / nameLower.length;

  if (similarity > 0.8) return 0.7;
  return 0;
}

/**
 * Computes a weighted composite match score between a transaction and an invoice.
 *
 * Weights:
 * - Amount: 0.5
 * - Date:   0.3
 * - Name:   0.2
 */
export function computeMatchScore(tx: Transaction, invoice: Invoice): number {
  const amountScore = scoreAmount(tx.amount, invoice.totalCost);
  const dateScore = scoreDate(tx.date, invoice.invoiceSentDate);
  const nameScore = scoreName(tx.description, invoice.clientName);

  return amountScore * 0.5 + dateScore * 0.3 + nameScore * 0.2;
}
