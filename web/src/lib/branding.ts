/**
 * Centralized branding constants for Open TEN99.
 *
 * Override these defaults by configuring your company info in Settings.
 * For email sending, set environment variables or Firebase secrets.
 */

// App identity
export const APP_NAME = 'Open TEN99';
export const APP_VERSION = 'v1.0';

// Default company info (shown when user hasn't configured their own)
export const DEFAULT_COMPANY_NAME = 'Your Company';
export const DEFAULT_COMPANY_SHORT = 'Your Company';
export const DEFAULT_FROM_ADDRESS = 'Your Name\nYour Business\nyou@example.com';
export const DEFAULT_PAYMENT_NOTE = 'Payment via ACH or check.';

// Email defaults (override via settings or environment)
export const DEFAULT_NOREPLY_EMAIL = 'noreply@example.com';
export const DEFAULT_SIGNOFF = `Best regards,\n${DEFAULT_COMPANY_NAME}`;

// Email logo URLs (set to empty string to use text fallback)
export const EMAIL_LOGO_WIDE_URL = '';
export const EMAIL_LOGO_ICON_URL = '';

// Default signature for email composer
export const DEFAULT_SIGNATURE = {
  name: 'Your Name',
  title: `Owner, ${DEFAULT_COMPANY_NAME}`,
  website: '',
  websiteLabel: '',
} as const;

// Support links (point to GitHub repo for open-source)
export const SUPPORT_EMAIL = '';
export const GITHUB_REPO_URL = 'https://github.com/yourusername/open-ten99';

// Portal base URL (configured per deployment)
export const PORTAL_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
