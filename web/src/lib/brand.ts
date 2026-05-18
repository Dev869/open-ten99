/**
 * DW Tailored Systems brand identity — single source of truth for the
 * invoice PDF (`buildPdf.ts`) and the invoice email (`EmailComposer.tsx`).
 *
 * Scope: invoice documents only. This intentionally does NOT restyle the app.
 */

/** Business identity shown on invoices and outbound invoice email. */
export const BRAND = {
  name: 'Devin Wilson',
  title: 'Independent Software Contractor',
  company: 'DW Tailored Systems',
  email: 'devin@dwtailored.com',
  phone: '+1 (530) 753-5503',
  website: 'dwtailored.com',
  websiteUrl: 'https://dwtailored.com',
  /** SendGrid From — must stay a verified sender. */
  fromEmail: 'devin@dwtailored.com',
  fromName: 'DW Tailored Systems',
} as const;

/**
 * Default multi-line "from" address block used on the invoice PDF when the
 * contractor has not set a custom one in Settings.
 */
export const BRAND_FROM_ADDRESS = [
  BRAND.name,
  BRAND.company,
  BRAND.email,
  BRAND.phone,
].join('\n');

/**
 * Brand palette (hex) for HTML/CSS contexts (the invoice email).
 * Teal-on-cream, charcoal text — matches dwtailored.com.
 *
 * Contrast notes (WCAG AA):
 * - White on DARK_TEAL header bar: large/bold wordmark only.
 * - Body text uses CHARCOAL on white/cream (>= 12:1).
 * - Secondary text uses MUTED on white (>= 5:1).
 * - Never use TEAL for small text on cream (fails 4.5:1).
 */
export const BRAND_HEX = {
  teal: '#1C8A8A',
  darkTeal: '#14706E',
  charcoal: '#2D2D2D',
  muted: '#5C574F',
  cream: '#F3EFE4',
  subtle: '#F8F6F3',
  border: '#E4DFDA',
  white: '#FFFFFF',
} as const;

/**
 * Same palette as 0–1 RGB tuples for pdf-lib (`rgb(...BRAND_RGB.teal)`).
 */
export const BRAND_RGB = {
  teal: [0.11, 0.541, 0.541] as const,
  darkTeal: [0.078, 0.439, 0.431] as const,
  charcoal: [0.176, 0.176, 0.176] as const,
  muted: [0.361, 0.341, 0.31] as const,
  cream: [0.953, 0.937, 0.894] as const,
  subtle: [0.973, 0.965, 0.953] as const,
  border: [0.894, 0.875, 0.855] as const,
  white: [1, 1, 1] as const,
} as const;

/**
 * Slugify a string for use in a downloadable filename.
 * Lowercase, alphanumerics + single hyphens, trimmed, capped length.
 */
export function slug(input: string, maxLength = 40): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return cleaned || 'invoice';
}
