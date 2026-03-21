/**
 * Client-side keyword-based categorization for CSV imports.
 * Mirrors the server-side categorize.ts logic but runs in the browser.
 */

const KEYWORD_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ['adobe', 'github', 'google cloud', 'aws', 'heroku', 'vercel', 'netlify', 'digitalocean', 'dropbox', 'slack', 'zoom', 'microsoft 365', 'canva', 'figma', 'notion', 'linear', 'jira', 'openai', 'anthropic', 'cloudflare', 'namecheap', 'godaddy', 'shopify', 'saas', 'subscription', 'software'], category: 'Software & Subscriptions' },
  { keywords: ['apple store', 'best buy', 'b&h photo', 'newegg', 'amazon', 'tools', 'equipment'], category: 'Equipment & Tools' },
  { keywords: ['staples', 'office depot', 'officemax', 'paper', 'printer', 'ink', 'office supply'], category: 'Office Supplies' },
  { keywords: ['airline', 'delta', 'united', 'american air', 'southwest', 'jetblue', 'hotel', 'marriott', 'hilton', 'airbnb', 'expedia', 'flight', 'airport'], category: 'Travel' },
  { keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'mcdonald', 'chipotle', 'grubhub', 'doordash', 'uber eats', 'dining', 'lunch', 'dinner'], category: 'Meals & Entertainment' },
  { keywords: ['shell', 'exxon', 'chevron', 'gas station', 'fuel', 'gasoline', 'jiffy lube', 'autozone', 'parking', 'toll', 'uber', 'lyft'], category: 'Vehicle & Fuel' },
  { keywords: ['insurance', 'geico', 'state farm', 'allstate', 'progressive', 'premium'], category: 'Insurance' },
  { keywords: ['attorney', 'lawyer', 'legal', 'accountant', 'cpa', 'bookkeeper', 'consulting'], category: 'Professional Services' },
  { keywords: ['facebook ads', 'google ads', 'linkedin ads', 'advertising', 'marketing', 'promotion'], category: 'Advertising & Marketing' },
  { keywords: ['electric', 'power', 'water', 'utility', 'comcast', 'xfinity', 'at&t', 'verizon', 't-mobile', 'internet', 'phone bill'], category: 'Utilities & Telecom' },
  { keywords: ['home depot', 'lowes', 'menards', 'lumber', 'concrete', 'paint', 'building supply', 'material'], category: 'Materials & Supplies' },
  { keywords: ['udemy', 'coursera', 'skillshare', 'training', 'course', 'certification', 'conference'], category: 'Education & Training' },
];

export function categorizeByKeyword(description: string): string {
  const lower = description.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'Uncategorized';
}
