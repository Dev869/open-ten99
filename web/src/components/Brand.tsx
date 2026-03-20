/**
 * Brand components for TEN99.
 *
 * BrandIcon  — compact `<99>` mark (sidebar collapsed, mobile header, favicon-style)
 * BrandWordmark — full `TEN99` wordmark with underline
 *
 * Both adapt to light/dark backgrounds via the `variant` prop.
 */

const CORAL = '#FF7E73';
const FONT = "'Space Mono', monospace";

interface BrandProps {
  /** Height of the logo in pixels. Width scales proportionally. */
  size?: number;
  /** Use 'light' on dark backgrounds, 'dark' on light backgrounds. */
  variant?: 'light' | 'dark';
  className?: string;
}

/** Compact `<99>` icon mark */
export function BrandIcon({ size = 32, variant = 'dark', className }: BrandProps) {
  const ink = variant === 'light' ? '#FFFFFF' : '#1A1A1A';
  // Scale font sizes relative to the container
  const bracketSize = size * 0.5;
  const digitSize = size * 0.55;
  const underlineHeight = Math.max(2, size * 0.06);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.02,
        fontFamily: FONT,
        fontWeight: 700,
        lineHeight: 1,
        height: size,
      }}
    >
      <span style={{ fontSize: bracketSize, color: ink }}>&lt;</span>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ fontSize: digitSize, color: CORAL }}>99</span>
        <span
          style={{
            position: 'absolute',
            bottom: size * -0.04,
            left: 0,
            right: 0,
            height: underlineHeight,
            backgroundColor: CORAL,
            borderRadius: underlineHeight,
          }}
        />
      </span>
      <span style={{ fontSize: bracketSize, color: ink }}>&gt;</span>
    </span>
  );
}

/** Full `TEN99` wordmark with underline */
export function BrandWordmark({ size = 28, variant = 'dark', className }: BrandProps) {
  const ink = variant === 'light' ? '#FFFFFF' : '#1A1A1A';
  const underlineHeight = Math.max(2, size * 0.07);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}
    >
      <span style={{ color: ink }}>TEN</span>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ color: CORAL }}>99</span>
        <span
          style={{
            position: 'absolute',
            bottom: size * -0.08,
            left: 0,
            right: 0,
            height: underlineHeight,
            backgroundColor: CORAL,
            borderRadius: underlineHeight,
          }}
        />
      </span>
    </span>
  );
}
