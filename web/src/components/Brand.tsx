/**
 * Brand components for TEN99 — image-based.
 *
 * BrandIcon     — compact 1099 mark (sidebar collapsed, settings)
 * BrandWordmark — full TEN99 wordmark
 *
 * Both adapt to light/dark backgrounds via the `variant` prop.
 * - 'light': light variant (white text, for dark backgrounds)
 * - 'dark': dark variant (dark text, for light backgrounds)
 */

interface BrandProps {
  /** Height of the logo in pixels. Width scales proportionally. */
  size?: number;
  /** 'light' for dark bg, 'dark' for light bg. */
  variant?: 'light' | 'dark';
  className?: string;
}

/** Compact 1099 icon mark — icon files are named by mode (light bg / dark bg), opposite to wordmark naming */
export function BrandIcon({ size = 32, variant = 'dark', className }: BrandProps) {
  const src = variant === 'light' ? '/brand-icon-dark.png' : '/brand-icon-light.png';
  return (
    <img
      className={className}
      src={src}
      alt="Ten99"
      height={size}
      style={{ height: size, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
    />
  );
}

/** Full TEN99 wordmark */
export function BrandWordmark({ size = 28, variant = 'dark', className }: BrandProps) {
  const src = variant === 'light' ? '/brand-wordmark-light.png' : '/brand-wordmark-dark.png';
  return (
    <img
      className={className}
      src={src}
      alt="Ten99"
      height={size}
      style={{ height: size, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
    />
  );
}
