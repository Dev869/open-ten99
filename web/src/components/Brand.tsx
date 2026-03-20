/**
 * Brand components for TEN99 — pixel art style.
 *
 * BrandIcon  — compact `<99>` mark (sidebar collapsed, settings)
 * BrandWordmark — full `TEN99` wordmark with underline
 *
 * Both adapt to light/dark backgrounds via the `variant` prop.
 * - 'auto' (default): uses CSS var(--text-primary) so it follows the theme
 * - 'light': forces white ink (for known dark backgrounds like login)
 * - 'dark': forces dark ink
 *
 * Uses "Press Start 2P" pixel font to match the Streamline Pixel icon set.
 */

const CORAL = '#FF7E73';
const FONT = "'Press Start 2P', 'Space Mono', monospace";

interface BrandProps {
  /** Height of the logo in pixels. Width scales proportionally. */
  size?: number;
  /** 'auto' follows theme, 'light' for dark bg, 'dark' for light bg. */
  variant?: 'auto' | 'light' | 'dark';
  className?: string;
}

function inkColor(variant: 'auto' | 'light' | 'dark') {
  if (variant === 'light') return '#FFFFFF';
  if (variant === 'dark') return '#1A1A1A';
  return 'var(--text-primary)';
}

/** Compact `<99>` icon mark */
export function BrandIcon({ size = 32, variant = 'auto', className }: BrandProps) {
  const ink = inkColor(variant);
  const bracketSize = size * 0.4;
  const digitSize = size * 0.45;
  const underlineHeight = Math.max(2, size * 0.08);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.04,
        fontFamily: FONT,
        fontWeight: 400,
        lineHeight: 1,
        height: size,
        imageRendering: 'pixelated',
      }}
    >
      <span style={{ fontSize: bracketSize, color: ink }}>&lt;</span>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ fontSize: digitSize, color: CORAL }}>99</span>
        <span
          style={{
            position: 'absolute',
            bottom: size * -0.06,
            left: 0,
            right: 0,
            height: underlineHeight,
            backgroundColor: CORAL,
          }}
        />
      </span>
      <span style={{ fontSize: bracketSize, color: ink }}>&gt;</span>
    </span>
  );
}

/** Full `TEN99` wordmark with underline */
export function BrandWordmark({ size = 28, variant = 'auto', className }: BrandProps) {
  const ink = inkColor(variant);
  const underlineHeight = Math.max(2, size * 0.08);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: FONT,
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '0.02em',
        imageRendering: 'pixelated',
      }}
    >
      <span style={{ color: ink }}>TEN</span>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ color: CORAL }}>99</span>
        <span
          style={{
            position: 'absolute',
            bottom: size * -0.1,
            left: 0,
            right: 0,
            height: underlineHeight,
            backgroundColor: CORAL,
          }}
        />
      </span>
    </span>
  );
}
