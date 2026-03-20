/**
 * Auto-categorize transactions into Schedule C expense categories.
 *
 * Layer 1: Plaid personal_finance_category.primary → Schedule C mapping
 * Layer 2: Keyword matching on description (for Stripe or unmapped Plaid)
 * Layer 3: Falls back to "Uncategorized"
 */

// Plaid personal_finance_category.primary → Schedule C category
const PLAID_CATEGORY_MAP: Record<string, string> = {
  // Software & Subscriptions
  ENTERTAINMENT: 'Software & Subscriptions',
  // Equipment & Tools
  GENERAL_MERCHANDISE: 'Equipment & Tools',
  HOME_IMPROVEMENT: 'Equipment & Tools',
  // Office Supplies
  OFFICE_SUPPLIES: 'Office Supplies',
  // Travel
  TRAVEL: 'Travel',
  TRANSPORTATION: 'Travel',
  // Meals & Entertainment
  FOOD_AND_DRINK: 'Meals & Entertainment',
  // Vehicle & Fuel
  GAS: 'Vehicle & Fuel',
  AUTOMOTIVE: 'Vehicle & Fuel',
  // Insurance
  INSURANCE: 'Insurance',
  // Professional Services
  PROFESSIONAL_SERVICES: 'Professional Services',
  GOVERNMENT_AND_NON_PROFIT: 'Professional Services',
  LEGAL: 'Professional Services',
  // Advertising & Marketing
  ADVERTISING: 'Advertising & Marketing',
  // Utilities & Telecom
  UTILITIES: 'Utilities & Telecom',
  TELECOM: 'Utilities & Telecom',
  INTERNET: 'Utilities & Telecom',
  // Subcontractors
  PERSONAL_CARE: 'Uncategorized',
  // Materials & Supplies
  BUILDING_MATERIALS: 'Materials & Supplies',
  HARDWARE: 'Materials & Supplies',
  // Education & Training
  EDUCATION: 'Education & Training',
  // Generic
  BANK_FEES: 'Professional Services',
  LOAN_PAYMENTS: 'Uncategorized',
  TRANSFER: 'Uncategorized',
  INCOME: 'Uncategorized',
  RENT: 'Uncategorized',
  MEDICAL: 'Uncategorized',
};

// Keyword patterns for description-based matching (case-insensitive)
// Checked in order — first match wins.
const KEYWORD_RULES: { keywords: string[]; category: string }[] = [
  // Software & Subscriptions
  { keywords: ['adobe', 'github', 'google cloud', 'aws', 'heroku', 'vercel', 'netlify', 'digitalocean', 'dropbox', 'slack', 'zoom', 'microsoft 365', 'office 365', 'canva', 'figma', 'notion', 'linear', 'jira', 'atlassian', 'openai', 'anthropic', 'cloudflare', 'namecheap', 'godaddy', 'hover', 'squarespace', 'shopify', 'stripe fee', 'saas', 'subscription', 'software'], category: 'Software & Subscriptions' },
  // Equipment & Tools
  { keywords: ['apple store', 'best buy', 'b&h photo', 'newegg', 'amazon', 'tools', 'equipment', 'hardware store'], category: 'Equipment & Tools' },
  // Office Supplies
  { keywords: ['staples', 'office depot', 'officemax', 'paper', 'printer', 'ink', 'toner', 'office supply'], category: 'Office Supplies' },
  // Travel
  { keywords: ['airline', 'delta', 'united', 'american air', 'southwest', 'jetblue', 'spirit', 'frontier', 'hotel', 'marriott', 'hilton', 'hyatt', 'airbnb', 'vrbo', 'expedia', 'booking.com', 'kayak', 'flight', 'airport', 'tsa'], category: 'Travel' },
  // Meals & Entertainment
  { keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'mcdonald', 'chipotle', 'grubhub', 'doordash', 'uber eats', 'postmates', 'seamless', 'dining', 'lunch', 'dinner', 'breakfast', 'bar ', 'pub ', 'brewery'], category: 'Meals & Entertainment' },
  // Vehicle & Fuel
  { keywords: ['shell', 'exxon', 'chevron', 'bp ', 'gas station', 'fuel', 'gasoline', 'petrol', 'jiffy lube', 'autozone', 'napa auto', 'tire', 'car wash', 'parking', 'toll', 'uber', 'lyft'], category: 'Vehicle & Fuel' },
  // Insurance
  { keywords: ['insurance', 'geico', 'state farm', 'allstate', 'progressive', 'liberty mutual', 'usaa', 'premium', 'policy'], category: 'Insurance' },
  // Professional Services
  { keywords: ['attorney', 'lawyer', 'legal', 'accountant', 'cpa', 'bookkeeper', 'tax prep', 'consulting', 'advisory'], category: 'Professional Services' },
  // Advertising & Marketing
  { keywords: ['facebook ads', 'google ads', 'linkedin ads', 'meta ads', 'advertising', 'marketing', 'promotion', 'sponsor', 'ad spend'], category: 'Advertising & Marketing' },
  // Utilities & Telecom
  { keywords: ['electric', 'power', 'water', 'gas bill', 'utility', 'comcast', 'xfinity', 'at&t', 'verizon', 't-mobile', 'sprint', 'spectrum', 'cox', 'internet', 'phone bill', 'cell phone'], category: 'Utilities & Telecom' },
  // Materials & Supplies
  { keywords: ['home depot', 'lowes', 'menards', 'lumber', 'plywood', 'concrete', 'drywall', 'paint', 'building supply', 'material'], category: 'Materials & Supplies' },
  // Education & Training
  { keywords: ['udemy', 'coursera', 'skillshare', 'masterclass', 'pluralsight', 'linkedin learning', 'training', 'course', 'certification', 'seminar', 'workshop', 'conference', 'tuition'], category: 'Education & Training' },
];

/**
 * Categorize a transaction using Plaid category or description keywords.
 *
 * @param plaidPrimaryCategory - Plaid personal_finance_category.primary (e.g., "FOOD_AND_DRINK"). Null for non-Plaid transactions.
 * @param description - Transaction description/merchant name.
 * @returns Schedule C expense category string.
 */
export function categorizeTransaction(
  plaidPrimaryCategory: string | null | undefined,
  description: string
): string {
  // Layer 1: Plaid category mapping
  if (plaidPrimaryCategory) {
    const mapped = PLAID_CATEGORY_MAP[plaidPrimaryCategory];
    if (mapped && mapped !== 'Uncategorized') {
      return mapped;
    }
  }

  // Layer 2: Keyword matching on description
  const descLower = description.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => descLower.includes(kw))) {
      return rule.category;
    }
  }

  // Layer 3: Fallback
  return 'Uncategorized';
}

/**
 * Determine transaction type from amount and Plaid category.
 * Positive amounts (after Plaid negation) = income.
 * Negative amounts = expense.
 * Transfers are detected by Plaid category.
 */
export function classifyTransactionType(
  amount: number,
  plaidPrimaryCategory?: string | null
): 'income' | 'expense' | 'transfer' | 'uncategorized' {
  if (plaidPrimaryCategory === 'TRANSFER' || plaidPrimaryCategory === 'LOAN_PAYMENTS') {
    return 'transfer';
  }
  if (amount > 0) return 'income';
  if (amount < 0) return 'expense';
  return 'uncategorized';
}
