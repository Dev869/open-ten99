/* ─────────────────────────────────────────────────────────────
   Pixel Icon Library
   All icons use pixel art style on a 32×32 viewBox
   (16×16 effective pixel grid, each pixel = 2×2 units).
   ───────────────────────────────────────────────────────────── */

export interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}


/* ── Navigation / Feature Icons (Streamline Pixel) ───────── */

/** Pixel retro computer monitor */
export function IconDashboard({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.475 22.86h-4.57v-1.53h1.52v-1.52H4.575v1.52H6.1v1.53H1.525V32h28.95Zm-22.86 -1.53h16.76v1.53H7.615Zm21.34 9.15H3.045v-6.1h25.91Z" />
        <path d="M27.425 1.52h1.53v18.29h-1.53Z" />
        <path d="M18.285 25.9h7.62v1.53h-7.62Z" />
        <path d="M18.285 10.67h1.52v1.52h-1.52Z" />
        <path d="M18.285 7.62h1.52v1.52h-1.52Z" />
        <path d="M13.715 12.19h4.57v1.52h-4.57Z" />
        <path d="M12.185 10.67h1.53v1.52h-1.53Z" />
        <path d="M12.185 7.62h1.53v1.52h-1.53Z" />
        <path d="M6.1 18.29h19.81V3.05H6.1ZM7.615 4.57h16.76v12.19H7.615Z" />
        <path d="M6.095 25.9h3.05v3.05h-3.05Z" />
        <path d="M4.575 0h22.85v1.52H4.575Z" />
        <path d="M3.045 1.52h1.53v18.29h-1.53Z" />
      </g>
    </svg>
  );
}

/** Pixel wrench / work orders (Streamline Pixel) */
export function IconWrench({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m30.48 25.9 -1.53 0 0 1.53 3.05 0 0 -6.1 -1.52 0 0 4.57z" />
        <path d="M28.95 19.81h1.53v1.52h-1.53Z" />
        <path d="M27.43 24.38h1.52v1.52h-1.52Z" />
        <path d="m22.86 22.86 0 4.57 1.52 0 0 1.52 1.53 0 0 1.53 -4.57 0 0 1.52 6.09 0 0 -4.57 -1.52 0 0 -3.05 1.52 0 0 -1.52 -4.57 0z" />
        <path d="M19.81 28.95h1.53v1.53h-1.53Z" />
        <path d="M19.81 19.81h1.53v1.52h-1.53Z" />
        <path d="M18.29 22.86h1.52v6.09h-1.52Z" />
        <path d="M18.29 18.28h1.52v1.53h-1.52Z" />
        <path d="M16.76 21.33h1.53v1.53h-1.53Z" />
        <path d="M16.76 16.76h1.53v1.52h-1.53Z" />
        <path d="M15.24 19.81h1.52v1.52h-1.52Z" />
        <path d="M15.24 15.24h1.52v1.52h-1.52Z" />
        <path d="M13.72 18.28h1.52v1.53h-1.52Z" />
        <path d="M13.72 13.71h1.52v1.53h-1.52Z" />
        <path d="M12.19 16.76h1.53v1.52h-1.53Z" />
        <path d="M12.19 12.19h1.53v1.52h-1.53Z" />
        <path d="M10.67 15.24h1.52v1.52h-1.52Z" />
        <path d="M10.67 10.67h1.52v1.52h-1.52Z" />
        <path d="M9.15 13.71h1.52v1.53H9.15Z" />
        <path d="M3.05 12.19h6.1v1.52h-6.1Z" />
        <path d="M6.1 3.05h1.52v1.52H6.1Z" />
        <path d="m10.67 1.52 0 1.53 1.52 0 0 6.09 1.53 0 0 1.53 1.52 0 0 1.52 1.52 0 0 1.52 1.53 0 0 1.53 1.52 0 0 1.52 1.53 0 0 1.52 1.52 0 0 1.53 6.09 0 0 -1.53 -4.57 0 0 -1.52 -1.52 0 0 -1.52 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 -6.09 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -7.62 0 0 3.05 1.53 0 0 -1.53 4.57 0z" />
        <path d="M1.53 10.67h1.52v1.52H1.53Z" />
        <path d="m1.53 6.09 1.52 0 0 1.53 1.52 0 0 1.52 4.58 0 0 -4.57 -1.53 0 0 3.05 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -4.57 0 0 6.1 1.53 0 0 -4.58z" />
      </g>
    </svg>
  );
}

/** Pixel data file with bar chart */
export function IconDocument({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M27.43 6.09h-4.57V1.52h1.52V0H3.05v32h25.9V4.57h-1.52Zm0 24.39H4.57V1.52h16.76v6.1h6.1Z" />
        <path d="M25.91 3.05h1.52v1.52h-1.52Z" />
        <path d="M24.38 1.52h1.53v1.53h-1.53Z" />
        <path d="m21.33 22.86 -1.52 0 0 -9.15 -3.05 0 0 9.15 -1.52 0 0 -6.1 -3.05 0 0 6.1 -4.57 0 0 -3.05 1.52 0 0 -1.52 -1.52 0 0 -3.05 1.52 0 0 -1.53 -1.52 0 0 -3.04 -1.52 0 0 13.71 19.81 0 0 -1.52 -1.53 0 0 -7.62 -3.05 0 0 7.62z" />
      </g>
    </svg>
  );
}

/** Pixel calendar appointment (Streamline Pixel) */
export function IconCalendar({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m2.285 10.67 27.43 0 0 19.81 1.52 0 0 -24.38 -1.52 0 0 3.04 -27.43 0 0 -3.04 -1.52 0 0 24.38 1.52 0 0 -19.81z" />
        <path d="M28.195 4.57h1.52V6.1h-1.52Z" />
        <path d="M2.285 30.48h27.43V32H2.285Z" />
        <path d="m25.145 18.29 -3.05 0 0 1.52 -1.52 0 0 -1.52 -3.05 0 0 1.52 -1.52 0 0 3.05 1.52 0 0 1.52 1.52 0 0 1.52 1.53 0 0 1.53 1.52 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 -1.52 1.52 0 0 -3.05 -1.52 0 0 -1.52z" />
        <path d="M23.615 13.71h1.53v1.53h-1.53Z" />
        <path d="M17.525 13.71h1.52v1.53h-1.52Z" />
        <path d="M11.425 25.9h1.53v1.53h-1.53Z" />
        <path d="M11.425 19.81h1.53v1.52h-1.53Z" />
        <path d="M11.425 13.71h1.53v1.53h-1.53Z" />
        <path d="M5.335 25.9h1.52v1.53h-1.52Z" />
        <path d="M5.335 19.81h1.52v1.52h-1.52Z" />
        <path d="M5.335 13.71h1.52v1.53h-1.52Z" />
        <path d="m8.385 4.57 0 1.53 1.52 0 0 -1.53 12.19 0 0 1.53 1.52 0 0 -1.53 4.58 0 0 -1.52 -4.58 0 0 -3.05 -1.52 0 0 3.05 -12.19 0 0 -3.05 -1.52 0 0 3.05 -4.57 0 0 1.52 4.57 0z" />
        <path d="M2.285 4.57h1.53V6.1h-1.53Z" />
      </g>
    </svg>
  );
}

/** Pixel multiple users */
export function IconClients({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.48 18.285H32v1.53h-1.52Z" />
        <path d="M27.43 16.765h3.05v1.52h-3.05Z" />
        <path d="M27.43 13.715h1.52v1.53h-1.52Z" />
        <path d="m22.86 15.245 0 -3.05 -1.52 0 0 -1.53 -1.53 0 0 -3.04 1.53 0 0 -1.53 6.09 0 0 1.53 1.52 0 0 6.09 1.53 0 0 -9.14 -1.53 0 0 -1.53 -1.52 0 0 -1.52 -6.09 0 0 1.52 -1.53 0 0 1.53 -1.52 0 0 4.57 -4.57 0 0 -4.57 -1.53 0 0 -1.53 -1.52 0 0 -1.52 -6.1 0 0 1.52 -1.52 0 0 1.53 -1.52 0 0 9.14 1.52 0 0 -6.09 1.52 0 0 -1.53 6.1 0 0 1.53 1.52 0 0 3.04 -1.52 0 0 1.53 -1.52 0 0 3.05 -4.58 0 0 1.52 4.58 0 0 6.09 1.52 0 0 -7.61 1.52 0 0 -1.53 7.62 0 0 1.53 1.53 0 0 7.61 1.52 0 0 -6.09 4.57 0 0 -1.52 -4.57 0z" />
        <path d="M24.38 28.955h1.53v1.52h-1.53Z" />
        <path d="M22.86 27.435h1.52v1.52h-1.52Z" />
        <path d="M19.81 25.905h3.05v1.53h-3.05Z" />
        <path d="M19.81 22.855h1.53v1.53h-1.53Z" />
        <path d="M18.29 16.765h1.52v3.05h-1.52Z" />
        <path d="M12.19 24.385h7.62v1.52h-7.62Z" />
        <path d="M13.72 21.335h4.57v1.52h-4.57Z" />
        <path d="M12.19 16.765h1.53v3.05h-1.53Z" />
        <path d="M10.67 22.855h1.52v1.53h-1.52Z" />
        <path d="M9.15 25.905h3.04v1.53H9.15Z" />
        <path d="M7.62 27.435h1.53v1.52H7.62Z" />
        <path d="M6.1 28.955h1.52v1.52H6.1Z" />
        <path d="M3.05 13.715h1.52v1.53H3.05Z" />
        <path d="M1.53 16.765h3.04v1.52H1.53Z" />
        <path d="M0 18.285h1.53v1.53H0Z" />
      </g>
    </svg>
  );
}

/** Pixel hierarchy tree */
export function IconTeam({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.47 23.615H32v4.57h-1.53Z" />
        <path d="M25.9 28.185h4.57v1.53H25.9Z" />
        <path d="m30.47 23.615 0 -1.52 -1.52 0 0 -4.57 -1.53 0 0 4.57 -1.52 0 0 1.52 4.57 0z" />
        <path d="M25.9 15.995h1.52v1.53H25.9Z" />
        <path d="M24.38 23.615h1.52v4.57h-1.52Z" />
        <path d="m16.76 14.475 0 -4.57 1.52 0 0 -1.53 -4.57 0 0 1.53 1.52 0 0 4.57 -9.14 0 0 1.52 9.14 0 0 6.1 -1.52 0 0 1.52 4.57 0 0 -1.52 -1.52 0 0 -6.1 9.14 0 0 -1.52 -9.14 0z" />
        <path d="M18.28 23.615h1.52v4.57h-1.52Z" />
        <path d="M18.28 3.805h1.52v4.57h-1.52Z" />
        <path d="M13.71 28.185h4.57v1.53h-4.57Z" />
        <path d="M13.71 2.285h4.57v1.52h-4.57Z" />
        <path d="M12.19 23.615h1.52v4.57h-1.52Z" />
        <path d="M12.19 3.805h1.52v4.57h-1.52Z" />
        <path d="M6.09 23.615h1.52v4.57H6.09Z" />
        <path d="M4.57 15.995h1.52v1.53H4.57Z" />
        <path d="M1.52 28.185h4.57v1.53H1.52Z" />
        <path d="m3.04 22.095 -1.52 0 0 1.52 4.57 0 0 -1.52 -1.52 0 0 -4.57 -1.53 0 0 4.57z" />
        <path d="M0 23.615h1.52v4.57H0Z" />
      </g>
    </svg>
  );
}

/** Pixel cash user / finance overview (Streamline Pixel) */
export function IconFinanceOverview({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.48 1.53H32v15.23h-1.52Z" />
        <path d="M13.72 0h16.76v1.53H13.72Z" />
        <path d="M24.39 16.76h6.09v1.53h-6.09Z" />
        <path d="M24.39 10.67h1.52v3.05h-1.52Z" />
        <path d="M24.39 6.1h1.52v1.52h-1.52Z" />
        <path d="M22.86 18.29h1.53v1.52h-1.53Z" />
        <path d="M21.34 19.81h1.52v1.53h-1.52Z" />
        <path d="m21.34 15.24 0 1.52 1.52 0 0 -1.52 1.53 0 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.53 -1.53 0 0 -3.04 1.53 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 1.52 -1.53 0 0 1.53 1.53 0 0 3.04 -1.53 0 0 1.53 1.53 0 0 3.05 -1.53 0 0 1.52 1.53 0z" />
        <path d="m18.29 18.29 -1.52 0 0 4.57 4.57 0 0 -1.52 -3.05 0 0 -3.05z" />
        <path d="M18.29 12.19h1.52v1.53h-1.52Z" />
        <path d="M18.29 6.1h1.52v3.04h-1.52Z" />
        <path d="M15.24 30.48h3.05V32h-3.05Z" />
        <path d="M12.19 28.95h3.05v1.53h-3.05Z" />
        <path d="M12.19 25.91h1.53v1.52h-1.53Z" />
        <path d="M12.19 1.53h1.53v9.14h-1.53Z" />
        <path d="m4.58 27.43 0 1.52 3.04 0 0 3.05 1.53 0 0 -3.05 3.04 0 0 -1.52 -7.61 0z" />
        <path d="M10.67 22.86h1.52v1.52h-1.52Z" />
        <path d="M10.67 19.81h1.52v1.53h-1.52Z" />
        <path d="M7.62 24.38h3.05v1.53H7.62Z" />
        <path d="M4.58 19.81H6.1v1.53H4.58Z" />
        <path d="M3.05 25.91h1.53v1.52H3.05Z" />
        <path d="M1.53 28.95h3.05v1.53H1.53Z" />
        <path d="m3.05 18.29 1.53 0 0 -1.53 7.61 0 0 1.53 1.53 0 0 7.62 1.52 0 0 -10.67 -1.52 0 0 -1.52 -1.53 0 0 -1.53 -7.61 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 10.67 1.52 0 0 -7.62z" />
        <path d="M0 30.48h1.53V32H0Z" />
      </g>
    </svg>
  );
}

/** Pixel money bill (Streamline Pixel) */
export function IconAnalytics({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.47 6.1H32v1.52h-1.53Z" />
        <path d="m28.95 15.24 0 1.52 -1.52 0 0 1.53 1.52 0 0 1.52 -1.52 0 0 1.52 1.52 0 0 1.53 -1.52 0 0 1.52 3.04 0 0 -12.19 -1.52 0 0 1.52 -1.52 0 0 1.53 1.52 0z" />
        <path d="M25.9 4.57h4.57V6.1H25.9Z" />
        <path d="m25.9 7.62 0 1.52 1.53 0 0 1.53 1.52 0 0 -1.53 1.52 0 0 -1.52 -4.57 0z" />
        <path d="m30.47 3.05 0 -1.53 -1.52 0 0 -1.52 -1.52 0 0 1.52 -1.53 0 0 1.53 4.57 0z" />
        <path d="M24.38 12.19h3.05v1.52h-3.05Z" />
        <path d="m10.66 15.24 3.05 0 0 1.52 1.53 0 0 1.53 3.04 0 0 1.52 -3.04 0 0 1.52 3.04 0 0 1.53 -3.04 0 0 1.52 3.04 0 0 1.53 -3.04 0 0 1.52 3.04 0 0 1.52 3.05 0 0 -1.52 3.05 0 0 -1.52 3.05 0 0 -1.53 -3.05 0 0 -1.52 3.05 0 0 -1.53 -3.05 0 0 -1.52 3.05 0 0 -1.52 -3.05 0 0 -1.53 3.05 0 0 -1.52 -3.05 0 0 -1.53 -3.05 0 0 -1.52 -3.05 0 0 -1.52 -3.04 0 0 -1.53 -3.05 0 0 1.53 -3.05 0 0 1.52 -3.05 0 0 1.52 4.57 0 0 1.53z" />
        <path d="M24.38 3.05h1.52v1.52h-1.52Z" />
        <path d="M21.33 7.62h3.05v1.52h-3.05Z" />
        <path d="M18.28 6.1h3.05v1.52h-3.05Z" />
        <path d="M15.24 7.62h3.04v1.52h-3.04Z" />
        <path d="M15.24 28.95h3.04v1.53h-3.04Z" />
        <path d="M13.71 4.57h1.53V6.1h-1.53Z" />
        <path d="m13.71 28.95 1.53 0 0 -1.52 -1.53 0 0 -1.52 1.53 0 0 -1.53 -1.53 0 0 -1.52 1.53 0 0 -1.53 -1.53 0 0 -1.52 1.53 0 0 -1.52 -3.05 0 0 1.52 -3.05 0 0 1.52 3.05 0 0 1.53 -3.05 0 0 1.52 3.05 0 0 1.53 -3.05 0 0 1.52 3.05 0 0 1.52 -3.05 0 0 1.53 3.05 0 0 1.52 3.05 0 0 -1.52 -1.53 0 0 -1.53z" />
        <path d="M10.66 0h3.05v1.52h-3.05Z" />
        <path d="M10.66 6.1h3.05v1.52h-3.05Z" />
        <path d="M10.66 3.05h3.05v1.52h-3.05Z" />
        <path d="M9.14 1.52h1.52v1.53H9.14Z" />
        <path d="M6.09 27.43h3.05v1.52H6.09Z" />
        <path d="M6.09 18.29h3.05v1.52H6.09Z" />
        <path d="M6.09 24.38h3.05v1.53H6.09Z" />
        <path d="M6.09 21.33h3.05v1.53H6.09Z" />
        <path d="M6.09 6.1h1.53v1.52H6.09Z" />
        <path d="M3.04 25.91h3.05v1.52H3.04Z" />
        <path d="M3.04 22.86h3.05v1.52H3.04Z" />
        <path d="M3.04 19.81h3.05v1.52H3.04Z" />
        <path d="M3.04 16.76h3.05v1.53H3.04Z" />
        <path d="M3.04 13.71h3.05v1.53H3.04Z" />
        <path d="m1.52 7.62 0 1.52 1.52 0 0 1.53 1.53 0 0 -1.53 1.52 0 0 -1.52 -4.57 0z" />
        <path d="m6.09 3.05 0 -1.53 -1.52 0 0 -1.52 -1.53 0 0 1.52 -1.52 0 0 1.53 4.57 0z" />
        <path d="m3.04 24.38 -1.52 0 0 -1.52 1.52 0 0 -1.53 -1.52 0 0 -1.52 1.52 0 0 -1.52 -1.52 0 0 -1.53 1.52 0 0 -1.52 -3.04 0 0 10.67 3.04 0 0 -1.53z" />
        <path d="M1.52 4.57h4.57V6.1H1.52Z" />
        <path d="M0 3.05h1.52v1.52H0Z" />
      </g>
    </svg>
  );
}

/** Pixel browser with code */
export function IconApps({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m1.52 9.14 28.96 0 0 19.81 1.52 0 0 -25.9 -1.52 0 0 4.57 -28.96 0 0 -4.57 -1.52 0 0 25.9 1.52 0 0 -19.81z" />
        <path d="M1.52 28.95h28.96v1.53H1.52Z" />
        <path d="M4.57 12.19v13.72h22.86V12.19Zm9.14 7.62h-1.52v1.52h-1.52v1.53H9.14v-1.53h1.53v-1.52h1.52v-1.52h-1.52v-1.53H9.14v-1.52h1.53v1.52h1.52v1.53h1.52Zm9.15 0h-6.1v-1.52h6.1Z" />
        <path d="M9.14 4.57h1.53V6.1H9.14Z" />
        <path d="M6.1 4.57h1.52V6.1H6.1Z" />
        <path d="M3.05 4.57h1.52V6.1H3.05Z" />
        <path d="M1.52 1.52h28.96v1.53H1.52Z" />
      </g>
    </svg>
  );
}

/** Pixel cog in browser */
export function IconSettings({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m30.47 6.1 -28.95 0 0 -4.57 -1.52 0 0 28.95 1.52 0 0 -22.86 28.95 0 0 22.86 1.53 0 0 -28.95 -1.53 0 0 4.57z" />
        <path d="M1.52 30.48h28.95V32H1.52Z" />
        <path d="M22.86 22.86h1.52v1.52h-1.52Z" />
        <path d="m22.86 18.29 1.52 0 0 1.52 -1.52 0 0 1.53 3.04 0 0 -4.58 -3.04 0 0 1.53z" />
        <path d="M22.86 13.72h1.52v1.52h-1.52Z" />
        <path d="M21.33 24.38h1.53v1.53h-1.53Z" />
        <path d="M21.33 21.34h1.53v1.52h-1.53Z" />
        <path d="M21.33 15.24h1.53v1.52h-1.53Z" />
        <path d="M21.33 12.19h1.53v1.53h-1.53Z" />
        <path d="M19.81 25.91h1.52v1.52h-1.52Z" />
        <path d="M19.81 10.67h1.52v1.52h-1.52Z" />
        <path d="M18.28 24.38h1.53v1.53h-1.53Z" />
        <path d="M18.28 16.76h1.53v4.58h-1.53Z" />
        <path d="M18.28 12.19h1.53v1.53h-1.53Z" />
        <path d="m16.76 27.43 -1.52 0 0 -1.52 -1.53 0 0 3.04 4.57 0 0 -3.04 -1.52 0 0 1.52z" />
        <path d="M13.71 21.34h4.57v1.52h-4.57Z" />
        <path d="M13.71 15.24h4.57v1.52h-4.57Z" />
        <path d="m15.24 10.67 1.52 0 0 1.52 1.52 0 0 -3.04 -4.57 0 0 3.04 1.53 0 0 -1.52z" />
        <path d="M12.19 24.38h1.52v1.53h-1.52Z" />
        <path d="M12.19 16.76h1.52v4.58h-1.52Z" />
        <path d="M12.19 12.19h1.52v1.53h-1.52Z" />
        <path d="M10.67 25.91h1.52v1.52h-1.52Z" />
        <path d="M10.67 10.67h1.52v1.52h-1.52Z" />
        <path d="M9.14 24.38h1.53v1.53H9.14Z" />
        <path d="M9.14 21.34h1.53v1.52H9.14Z" />
        <path d="M9.14 15.24h1.53v1.52H9.14Z" />
        <path d="M9.14 12.19h1.53v1.53H9.14Z" />
        <path d="M9.14 3.05h1.53v1.52H9.14Z" />
        <path d="M7.62 22.86h1.52v1.52H7.62Z" />
        <path d="m7.62 19.81 0 -1.52 1.52 0 0 -1.53 -3.05 0 0 4.58 3.05 0 0 -1.53 -1.52 0z" />
        <path d="M7.62 13.72h1.52v1.52H7.62Z" />
        <path d="M6.09 3.05h1.53v1.52H6.09Z" />
        <path d="M3.05 3.05h1.52v1.52H3.05Z" />
        <path d="M1.52 0h28.95v1.53H1.52Z" />
      </g>
    </svg>
  );
}

/** Pixel user with crosshair */
export function IconUser({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m30.47 12.19 -1.52 0 0 3.05 -1.52 0 0 1.52 1.52 0 0 3.05 1.52 0 0 -3.05 1.53 0 0 -1.52 -1.53 0 0 -3.05z" />
        <path d="M27.43 19.81h1.52v3.05h-1.52Z" />
        <path d="M27.43 9.14h1.52v3.05h-1.52Z" />
        <path d="M25.9 22.86h1.53v3.04H25.9Z" />
        <path d="M25.9 6.09h1.53v3.05H25.9Z" />
        <path d="m24.38 24.38 -1.53 0 0 3.05 3.05 0 0 -1.53 -1.52 0 0 -1.52z" />
        <path d="M22.85 4.57h3.05v1.52h-3.05Z" />
        <path d="M19.81 27.43h3.04v1.52h-3.04Z" />
        <path d="M19.81 22.86h3.04v1.52h-3.04Z" />
        <path d="M19.81 19.81h1.52v1.52h-1.52Z" />
        <path d="M19.81 3.05h3.04v1.52h-3.04Z" />
        <path d="M18.28 13.71h1.53v3.05h-1.53Z" />
        <path d="m16.76 27.43 -1.53 0 0 1.52 -3.04 0 0 1.53 3.04 0 0 1.52 1.53 0 0 -1.52 3.05 0 0 -1.53 -3.05 0 0 -1.52z" />
        <path d="M12.19 21.33h7.62v1.53h-7.62Z" />
        <path d="M13.71 18.28h4.57v1.53h-4.57Z" />
        <path d="m15.23 4.57 1.53 0 0 -1.52 3.05 0 0 -1.53 -3.05 0 0 -1.52 -1.53 0 0 1.52 -3.04 0 0 1.53 3.04 0 0 1.52z" />
        <path d="M12.19 13.71h1.52v3.05h-1.52Z" />
        <path d="M9.14 27.43h3.05v1.52H9.14Z" />
        <path d="M9.14 22.86h3.05v1.52H9.14Z" />
        <path d="M10.66 19.81h1.53v1.52h-1.53Z" />
        <path d="M9.14 3.05h3.05v1.52H9.14Z" />
        <path d="m10.66 12.19 1.53 0 0 -1.52 7.62 0 0 1.52 1.52 0 0 7.62 1.52 0 0 -10.67 -1.52 0 0 -1.52 -1.52 0 0 -1.53 -7.62 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 10.67 1.52 0 0 -7.62z" />
        <path d="m7.62 24.38 0 1.52 -1.53 0 0 1.53 3.05 0 0 -3.05 -1.52 0z" />
        <path d="M6.09 4.57h3.05v1.52H6.09Z" />
        <path d="M4.57 22.86h1.52v3.04H4.57Z" />
        <path d="M4.57 6.09h1.52v3.05H4.57Z" />
        <path d="M3.04 19.81h1.53v3.05H3.04Z" />
        <path d="M3.04 9.14h1.53v3.05H3.04Z" />
        <path d="m4.57 16.76 0 -1.52 -1.53 0 0 -3.05 -1.52 0 0 3.05 -1.52 0 0 1.52 1.52 0 0 3.05 1.52 0 0 -3.05 1.53 0z" />
      </g>
    </svg>
  );
}

/** Pixel padlock */
export function IconLock({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M25.905 13.71h1.52v15.24h-1.52Z" />
        <path d="M24.375 28.95h1.53v1.53h-1.53Z" />
        <path d="M7.615 30.48h16.76V32H7.615Z" />
        <path d="M21.335 1.52h1.52v1.53h-1.52Z" />
        <path d="m18.285 19.81 -1.52 0 0 -1.52 1.52 0 0 -1.53 -4.57 0 0 1.53 -1.53 0 0 3.04 1.53 0 0 1.53 1.52 0 0 4.57 1.53 0 0 -4.57 1.52 0 0 -1.53 1.52 0 0 -3.04 -1.52 0 0 1.52z" />
        <path d="M10.665 0h10.67v1.52h-10.67Z" />
        <path d="M9.145 1.52h1.52v1.53h-1.52Z" />
        <path d="m25.905 13.71 0 -1.52 -1.53 0 0 -9.14 -1.52 0 0 9.14 -13.71 0 0 -9.14 -1.53 0 0 9.14 -1.52 0 0 1.52 19.81 0z" />
        <path d="M6.095 28.95h1.52v1.53h-1.52Z" />
        <path d="M4.575 13.71h1.52v15.24h-1.52Z" />
      </g>
    </svg>
  );
}

/** Pixel notification bell with alert dots */
export function IconBell({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.47 25.9H32v3.05h-1.53Z" />
        <path d="M30.47 3.05H32V6.1h-1.53Z" />
        <path d="M28.95 28.95h1.52v1.53h-1.52Z" />
        <path d="M28.95 1.52h1.52v1.53h-1.52Z" />
        <path d="M27.43 25.9h1.52v1.53h-1.52Z" />
        <path d="M27.43 19.81h1.52v3.05h-1.52Z" />
        <path d="M27.43 4.57h1.52V6.1h-1.52Z" />
        <path d="M25.9 0h3.05v1.52H25.9Z" />
        <path d="M25.9 30.48h3.05V32H25.9Z" />
        <path d="M25.9 27.43h1.53v1.52H25.9Z" />
        <path d="M25.9 22.86h1.53v1.52H25.9Z" />
        <path d="M25.9 18.29h1.53v1.52H25.9Z" />
        <path d="M25.9 3.05h1.53v1.52H25.9Z" />
        <path d="M22.85 24.38h3.05v1.52h-3.05Z" />
        <path d="M24.38 10.67h1.52v7.62h-1.52Z" />
        <path d="M22.85 21.33h1.53v1.53h-1.53Z" />
        <path d="M22.85 7.62h1.53v3.05h-1.53Z" />
        <path d="m9.14 21.33 3.05 0 0 1.53 1.52 0 0 1.52 4.57 0 0 -1.52 1.53 0 0 -1.53 3.04 0 0 -1.52 -13.71 0 0 1.52z" />
        <path d="M21.33 6.1h1.52v1.52h-1.52Z" />
        <path d="M9.14 25.9h13.71v1.53H9.14Z" />
        <path d="M18.28 4.57h3.05V6.1h-3.05Z" />
        <path d="M13.71 3.05h4.57v1.52h-4.57Z" />
        <path d="M10.66 4.57h3.05V6.1h-3.05Z" />
        <path d="M9.14 6.1h1.52v1.52H9.14Z" />
        <path d="M6.09 24.38h3.05v1.52H6.09Z" />
        <path d="M7.62 21.33h1.52v1.53H7.62Z" />
        <path d="M7.62 7.62h1.52v3.05H7.62Z" />
        <path d="M6.09 10.67h1.53v7.62H6.09Z" />
        <path d="M4.57 27.43h1.52v1.52H4.57Z" />
        <path d="M4.57 22.86h1.52v1.52H4.57Z" />
        <path d="M4.57 18.29h1.52v1.52H4.57Z" />
        <path d="M4.57 3.05h1.52v1.52H4.57Z" />
        <path d="M3.05 0h3.04v1.52H3.05Z" />
        <path d="M3.05 30.48h3.04V32H3.05Z" />
        <path d="M3.05 25.9h1.52v1.53H3.05Z" />
        <path d="M3.05 19.81h1.52v3.05H3.05Z" />
        <path d="M3.05 4.57h1.52V6.1H3.05Z" />
        <path d="M1.52 28.95h1.53v1.53H1.52Z" />
        <path d="M1.52 1.52h1.53v1.53H1.52Z" />
        <path d="M0 25.9h1.52v3.05H0Z" />
        <path d="M0 3.05h1.52V6.1H0Z" />
      </g>
    </svg>
  );
}

/** Pixel double cog */
export function IconGear({ size = 18, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m28.95 7.62 0 1.52 1.53 0 0 1.53 -1.53 0 0 1.52 3.05 0 0 -4.57 -3.05 0z" />
        <path d="M28.95 13.71h1.53v1.53h-1.53Z" />
        <path d="M28.95 4.57h1.53v1.52h-1.53Z" />
        <path d="M27.43 15.24h1.52v1.52h-1.52Z" />
        <path d="M27.43 12.19h1.52v1.52h-1.52Z" />
        <path d="M27.43 6.09h1.52v1.53h-1.52Z" />
        <path d="M27.43 3.05h1.52v1.52h-1.52Z" />
        <path d="M25.91 16.76h1.52v1.52h-1.52Z" />
        <path d="M25.91 1.52h1.52v1.53h-1.52Z" />
        <path d="M24.38 15.24h1.53v1.52h-1.53Z" />
        <path d="M24.38 3.05h1.53v1.52h-1.53Z" />
        <path d="m19.81 0 0 3.05 1.53 0 0 -1.53 1.52 0 0 1.53 1.52 0 0 -3.05 -4.57 0z" />
        <path d="M21.34 25.9h1.52v1.53h-1.52Z" />
        <path d="m19.81 16.76 0 1.52 3.05 0 0 3.05 -3.05 0 0 1.53 4.57 0 0 -6.1 -4.57 0z" />
        <path d="M19.81 27.43h1.53v1.52h-1.53Z" />
        <path d="M19.81 24.38h1.53v1.52h-1.53Z" />
        <path d="M19.81 13.71h1.53v1.53h-1.53Z" />
        <path d="m19.81 12.19 1.53 0 0 1.52 3.04 0 0 -1.52 1.53 0 0 -4.57 -1.53 0 0 1.52 -1.52 0 0 -1.52 1.52 0 0 -1.53 -4.57 0 0 1.53 -1.52 0 0 3.05 1.52 0 0 1.52z" />
        <path d="M18.29 28.95h1.52v1.53h-1.52Z" />
        <path d="M18.29 22.86h1.52v1.52h-1.52Z" />
        <path d="M18.29 15.24h1.52v1.52h-1.52Z" />
        <path d="M18.29 3.05h1.52v1.52h-1.52Z" />
        <path d="M16.76 27.43h1.53v1.52h-1.53Z" />
        <path d="M16.76 10.67h1.53v1.52h-1.53Z" />
        <path d="M16.76 1.52h1.53v1.53h-1.53Z" />
        <path d="M15.24 25.9h1.52v1.53h-1.52Z" />
        <path d="M15.24 18.28h1.52v3.05h-1.52Z" />
        <path d="M15.24 12.19h1.52v1.52h-1.52Z" />
        <path d="M15.24 3.05h1.52v1.52h-1.52Z" />
        <path d="m13.72 30.48 -3.05 0 0 -3.05 -1.52 0 0 4.57 6.09 0 0 -4.57 -1.52 0 0 3.05z" />
        <path d="M13.72 21.33h1.52v1.53h-1.52Z" />
        <path d="M13.72 16.76h1.52v1.52h-1.52Z" />
        <path d="M13.72 4.57h1.52v1.52h-1.52Z" />
        <path d="M10.67 15.24h3.05v1.52h-3.05Z" />
        <path d="M10.67 22.86h3.05v1.52h-3.05Z" />
        <path d="M9.15 21.33h1.52v1.53H9.15Z" />
        <path d="M9.15 16.76h1.52v1.52H9.15Z" />
        <path d="m10.67 9.14 3.05 0 0 3.05 1.52 0 0 -4.57 -6.09 0 0 4.57 1.52 0 0 -3.05z" />
        <path d="M7.62 25.9h1.53v1.53H7.62Z" />
        <path d="M7.62 18.28h1.53v3.05H7.62Z" />
        <path d="M7.62 12.19h1.53v1.52H7.62Z" />
        <path d="M6.1 27.43h1.52v1.52H6.1Z" />
        <path d="M6.1 10.67h1.52v1.52H6.1Z" />
        <path d="M4.57 28.95H6.1v1.53H4.57Z" />
        <path d="M4.57 22.86H6.1v1.52H4.57Z" />
        <path d="M4.57 15.24H6.1v1.52H4.57Z" />
        <path d="M4.57 9.14H6.1v1.53H4.57Z" />
        <path d="M3.05 27.43h1.52v1.52H3.05Z" />
        <path d="M3.05 24.38h1.52v1.52H3.05Z" />
        <path d="m1.53 21.33 0 -3.05 3.04 0 0 -1.52 -4.57 0 0 6.1 4.57 0 0 -1.53 -3.04 0z" />
        <path d="M3.05 13.71h1.52v1.53H3.05Z" />
        <path d="M3.05 10.67h1.52v1.52H3.05Z" />
        <path d="M1.53 25.9h1.52v1.53H1.53Z" />
        <path d="M1.53 12.19h1.52v1.52H1.53Z" />
      </g>
    </svg>
  );
}

/* ── Directional Icons ────────────────────────────────────── */

export function IconChevronUp({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M14 10h4v2h-4Z" />
        <path d="M12 12h2v2h-2Z" />
        <path d="M18 12h2v2h-2Z" />
        <path d="M10 14h2v2h-2Z" />
        <path d="M20 14h2v2h-2Z" />
        <path d="M8 16h2v2H8Z" />
        <path d="M22 16h2v2h-2Z" />
        <path d="M6 18h2v2H6Z" />
        <path d="M24 18h2v2h-2Z" />
      </g>
    </svg>
  );
}

export function IconChevronDown({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M6 12h2v2H6Z" />
        <path d="M24 12h2v2h-2Z" />
        <path d="M8 14h2v2H8Z" />
        <path d="M22 14h2v2h-2Z" />
        <path d="M10 16h2v2h-2Z" />
        <path d="M20 16h2v2h-2Z" />
        <path d="M12 18h2v2h-2Z" />
        <path d="M18 18h2v2h-2Z" />
        <path d="M14 20h4v2h-4Z" />
      </g>
    </svg>
  );
}

export function IconChevronLeft({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M18 6h2v2h-2Z" />
        <path d="M16 8h2v2h-2Z" />
        <path d="M14 10h2v2h-2Z" />
        <path d="M12 12h2v2h-2Z" />
        <path d="M10 14h2v4h-2Z" />
        <path d="M12 18h2v2h-2Z" />
        <path d="M14 20h2v2h-2Z" />
        <path d="M16 22h2v2h-2Z" />
        <path d="M18 24h2v2h-2Z" />
      </g>
    </svg>
  );
}

export function IconChevronRight({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M12 6h2v2h-2Z" />
        <path d="M14 8h2v2h-2Z" />
        <path d="M16 10h2v2h-2Z" />
        <path d="M18 12h2v2h-2Z" />
        <path d="M20 14h2v4h-2Z" />
        <path d="M18 18h2v2h-2Z" />
        <path d="M16 20h2v2h-2Z" />
        <path d="M14 22h2v2h-2Z" />
        <path d="M12 24h2v2h-2Z" />
      </g>
    </svg>
  );
}

/* ── Theme Icons ──────────────────────────────────────────── */

/** Pixel starburst sun */
export function IconSun({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Center 4x4 circle */}
        <path d="M12 12h8v8h-8Z" />
        {/* Top ray */}
        <path d="M14 2h4v4h-4Z" />
        {/* Bottom ray */}
        <path d="M14 26h4v4h-4Z" />
        {/* Left ray */}
        <path d="M2 14h4v4H2Z" />
        {/* Right ray */}
        <path d="M26 14h4v4h-4Z" />
        {/* Top-left ray */}
        <path d="M4 4h2v2H4Z" />
        <path d="M6 6h2v2H6Z" />
        {/* Top-right ray */}
        <path d="M26 4h2v2h-2Z" />
        <path d="M24 6h2v2h-2Z" />
        {/* Bottom-left ray */}
        <path d="M4 26h2v2H4Z" />
        <path d="M6 24h2v2H6Z" />
        {/* Bottom-right ray */}
        <path d="M26 26h2v2h-2Z" />
        <path d="M24 24h2v2h-2Z" />
        {/* Connect center to rays */}
        <path d="M14 8h4v4h-4Z" />
        <path d="M14 20h4v4h-4Z" />
        <path d="M8 14h4v4H8Z" />
        <path d="M20 14h4v4h-4Z" />
      </g>
    </svg>
  );
}

/** Pixel crescent moon */
export function IconMoon({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Outer crescent shape */}
        <path d="M10 2h8v2h-8Z" />
        <path d="M8 4h2v2H8Z" />
        <path d="M18 4h2v2h-2Z" />
        <path d="M6 6h2v4H6Z" />
        <path d="M4 10h2v12H4Z" />
        <path d="M6 22h2v4H6Z" />
        <path d="M8 26h2v2H8Z" />
        <path d="M10 28h8v2h-8Z" />
        <path d="M18 26h2v2h-2Z" />
        <path d="M20 22h2v4h-2Z" />
        <path d="M22 18h2v4h-2Z" />
        {/* Inner cutout creates crescent - fill between outer and inner */}
        <path d="M20 6h2v4h-2Z" />
        <path d="M22 10h2v8h-2Z" />
      </g>
    </svg>
  );
}

/* ── Action Icons ─────────────────────────────────────────── */

/** Pixel magnifying glass with code */
export function IconSearch({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M29.72 23.625h-1.53V22.1h-1.52v-1.52h-1.53v-3.05h-1.52v3.05H22.1v1.52h-1.53v1.53h-3.04v1.52h3.04v1.52h1.53v1.53h1.52v1.52h1.52v1.52h4.58v-1.52h1.52v-4.57h-1.52Zm0 4.57h-1.53v-1.53h-1.52v-1.52h-1.53v-1.52h1.53v1.52h1.52v1.52h1.53Z" />
        <path d="M25.14 9.905h1.53v7.62h-1.53Z" />
        <path d="M23.62 6.855h1.52v3.05h-1.52Z" />
        <path d="M22.1 5.335h1.52v1.52H22.1Z" />
        <path d="M20.57 12.955h1.53v1.52h-1.53Z" />
        <path d="M20.57 3.815h1.53v1.52h-1.53Z" />
        <path d="M19.05 14.475h1.52v1.53h-1.52Z" />
        <path d="M19.05 11.425h1.52v1.53h-1.52Z" />
        <path d="M17.53 16.005h1.52v1.52h-1.52Z" />
        <path d="M17.53 9.905h1.52v1.52h-1.52Z" />
        <path d="M17.53 2.285h3.04v1.53h-3.04Z" />
        <path d="M9.91 25.145h7.62v1.52H9.91Z" />
        <path d="M14.48 9.905H16v3.05h-1.52Z" />
        <path d="M12.95 12.955h1.53v1.52h-1.53Z" />
        <path d="M11.43 14.475h1.52v3.05h-1.52Z" />
        <path d="M9.91 0.765h7.62v1.52H9.91Z" />
        <path d="M6.86 23.625h3.05v1.52H6.86Z" />
        <path d="M8.38 16.005h1.53v1.52H8.38Z" />
        <path d="M8.38 9.905h1.53v1.52H8.38Z" />
        <path d="M6.86 2.285h3.05v1.53H6.86Z" />
        <path d="M6.86 14.475h1.52v1.53H6.86Z" />
        <path d="M6.86 11.425h1.52v1.53H6.86Z" />
        <path d="M5.34 22.095h1.52v1.53H5.34Z" />
        <path d="M5.34 12.955h1.52v1.52H5.34Z" />
        <path d="M5.34 3.815h1.52v1.52H5.34Z" />
        <path d="M3.81 20.575h1.53v1.52H3.81Z" />
        <path d="M3.81 5.335h1.53v1.52H3.81Z" />
        <path d="M2.29 17.525h1.52v3.05H2.29Z" />
        <path d="M2.29 6.855h1.52v3.05H2.29Z" />
        <path d="M0.76 9.905h1.53v7.62H0.76Z" />
      </g>
    </svg>
  );
}

/** Pixel hamburger menu */
export function IconMenu({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M29.71 3.81h1.53v24.38h-1.53Z" />
        <path d="M28.19 28.19h1.52v1.52h-1.52Z" />
        <path d="M28.19 2.28h1.52v1.53h-1.52Z" />
        <path d="M3.81 29.71h24.38v1.53H3.81Z" />
        <path d="m25.14 20.57 -18.28 0 0 1.52 -1.53 0 0 3.05 1.53 0 0 -1.52 18.28 0 0 1.52 1.53 0 0 -3.05 -1.53 0 0 -1.52z" />
        <path d="m25.14 12.95 -18.28 0 0 1.52 -1.53 0 0 3.05 1.53 0 0 -1.52 18.28 0 0 1.52 1.53 0 0 -3.05 -1.53 0 0 -1.52z" />
        <path d="m25.14 5.33 -18.28 0 0 1.52 -1.53 0 0 3.05 1.53 0 0 -1.52 18.28 0 0 1.52 1.53 0 0 -3.05 -1.53 0 0 -1.52z" />
        <path d="M6.86 25.14h18.28v1.52H6.86Z" />
        <path d="M6.86 17.52h18.28v1.52H6.86Z" />
        <path d="M6.86 9.9h18.28v1.53H6.86Z" />
        <path d="M3.81 0.76h24.38v1.52H3.81Z" />
        <path d="M2.29 28.19h1.52v1.52H2.29Z" />
        <path d="M2.29 2.28h1.52v1.53H2.29Z" />
        <path d="M0.76 3.81h1.53v24.38H0.76Z" />
      </g>
    </svg>
  );
}

export function IconPlus({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Vertical bar */}
        <path d="M14 6h4v20h-4Z" />
        {/* Horizontal bar */}
        <path d="M6 14h20v4H6Z" />
      </g>
    </svg>
  );
}

export function IconClose({ size = 18, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Top-left to bottom-right diagonal */}
        <path d="M6 6h2v2H6Z" />
        <path d="M8 8h2v2H8Z" />
        <path d="M10 10h2v2h-2Z" />
        <path d="M12 12h2v2h-2Z" />
        <path d="M14 14h4v4h-4Z" />
        <path d="M18 18h2v2h-2Z" />
        <path d="M20 20h2v2h-2Z" />
        <path d="M22 22h2v2h-2Z" />
        <path d="M24 24h2v2h-2Z" />
        {/* Top-right to bottom-left diagonal */}
        <path d="M24 6h2v2h-2Z" />
        <path d="M22 8h2v2h-2Z" />
        <path d="M20 10h2v2h-2Z" />
        <path d="M18 12h2v2h-2Z" />
        <path d="M12 18h2v2h-2Z" />
        <path d="M10 20h2v2h-2Z" />
        <path d="M8 22h2v2H8Z" />
        <path d="M6 24h2v2H6Z" />
      </g>
    </svg>
  );
}

export function IconCheck({ size = 18, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Circle outline */}
        <path d="M10 2h12v2H10Z" />
        <path d="M6 4h4v2H6Z" />
        <path d="M22 4h4v2h-4Z" />
        <path d="M4 6h2v4H4Z" />
        <path d="M26 6h2v4h-2Z" />
        <path d="M2 10h2v12H2Z" />
        <path d="M28 10h2v12h-2Z" />
        <path d="M4 22h2v4H4Z" />
        <path d="M26 22h2v4h-2Z" />
        <path d="M6 26h4v2H6Z" />
        <path d="M22 26h4v2h-4Z" />
        <path d="M10 28h12v2H10Z" />
        {/* Checkmark inside */}
        <path d="M20 10h2v2h-2Z" />
        <path d="M18 12h2v2h-2Z" />
        <path d="M16 14h2v2h-2Z" />
        <path d="M14 16h2v2h-2Z" />
        <path d="M12 18h2v2h-2Z" />
        <path d="M10 16h2v2h-2Z" />
        <path d="M8 14h2v2H8Z" />
      </g>
    </svg>
  );
}

/** Pixel graphic tablet / edit (Streamline Pixel) */
export function IconEdit({ size = 14, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.48 5.335H32v21.33h-1.52Z" />
        <path d="M1.52 26.665h28.96v1.53H1.52Z" />
        <path d="m28.95 3.805 -3.04 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 1.52 -1.52 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 3.05 3.05 0 0 -1.53 1.52 0 0 -1.52 1.52 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 -1.52 1.52 0 0 -1.53 1.52 0 0 -3.05z" />
        <path d="M13.71 17.525h1.53v1.52h-1.53Z" />
        <path d="M12.19 11.425h1.52v1.53h-1.52Z" />
        <path d="M9.14 19.045h4.57v1.53H9.14Z" />
        <path d="M10.67 12.955h1.52v1.52h-1.52Z" />
        <path d="M9.14 9.905h3.05v1.52H9.14Z" />
        <path d="M9.14 14.475h1.53v1.52H9.14Z" />
        <path d="M7.62 15.995h1.52v3.05H7.62Z" />
        <path d="M7.62 11.425h1.52v1.53H7.62Z" />
        <path d="M6.1 12.955h1.52v1.52H6.1Z" />
        <path d="m4.57 8.385 15.24 0 0 -1.53 -16.76 0 0 18.29 25.9 0 0 -15.24 -1.52 0 0 13.71 -22.86 0 0 -15.23z" />
        <path d="M1.52 3.805h21.34v1.53H1.52Z" />
        <path d="M0 5.335h1.52v21.33H0Z" />
      </g>
    </svg>
  );
}

/** Pixel paint brush / customize (Streamline Pixel) */
export function IconPaintBrush({ size = 18, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.48 1.52H32v4.57h-1.52Z" />
        <path d="M28.95 6.09h1.53v3.05h-1.53Z" />
        <path d="M27.43 0h3.05v1.52h-3.05Z" />
        <path d="M27.43 9.14h1.52v3.05h-1.52Z" />
        <path d="M25.9 12.19h1.53v3.05H25.9Z" />
        <path d="M25.9 1.52h1.53v3.05H25.9Z" />
        <path d="M24.38 15.24h1.52v3.04h-1.52Z" />
        <path d="M24.38 4.57h1.52v3.05h-1.52Z" />
        <path d="M22.86 22.86h1.52v4.57h-1.52Z" />
        <path d="M22.86 18.28h1.52v3.05h-1.52Z" />
        <path d="M22.86 7.62h1.52v3.05h-1.52Z" />
        <path d="M21.33 10.67h1.53v3.04h-1.53Z" />
        <path d="m21.33 25.9 -1.52 0 0 1.53 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 1.52 -1.53 0 0 -3.04 -1.52 0 0 4.57 -1.52 0 0 1.52 -1.53 0 0 1.52 -7.62 0 0 1.53 16.77 0 0 -1.53 3.04 0 0 -1.52 1.53 0 0 -1.52 -1.53 0 0 -1.53z" />
        <path d="M19.81 21.33h3.05v1.53h-3.05Z" />
        <path d="M19.81 13.71h1.52v3.05h-1.52Z" />
        <path d="m19.81 21.33 0 -4.57 -1.52 0 0 3.05 -3.05 0 0 1.52 4.57 0z" />
        <path d="M13.71 21.33h1.53v1.53h-1.53Z" />
        <path d="M13.71 12.19h1.53v1.52h-1.53Z" />
        <path d="M12.19 13.71h1.52v1.53h-1.52Z" />
        <path d="M1.52 10.67h12.19v1.52H1.52Z" />
        <path d="M9.14 22.86h1.53v1.52H9.14Z" />
        <path d="M7.62 15.24h4.57v1.52H7.62Z" />
        <path d="M7.62 24.38h1.52v1.52H7.62Z" />
        <path d="M4.57 21.33h4.57v1.53H4.57Z" />
        <path d="M4.57 16.76h3.05v1.52H4.57Z" />
        <path d="M3.05 25.9h4.57v1.53H3.05Z" />
        <path d="M3.05 18.28h1.52v3.05H3.05Z" />
        <path d="M1.52 27.43h1.53v1.52H1.52Z" />
        <path d="M0 28.95h1.52v1.52H0Z" />
      </g>
    </svg>
  );
}

export function IconTrash({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Handle */}
        <path d="M12 2h8v2h-8Z" />
        {/* Lid */}
        <path d="M4 6h24v2H4Z" />
        <path d="M10 4h2v2h-2Z" />
        <path d="M20 4h2v2h-2Z" />
        {/* Can body */}
        <path d="M6 8h2v20H6Z" />
        <path d="M24 8h2v20h-2Z" />
        <path d="M6 28h20v2H6Z" />
        {/* Vertical lines inside */}
        <path d="M10 12h2v12h-2Z" />
        <path d="M15 12h2v12h-2Z" />
        <path d="M20 12h2v12h-2Z" />
      </g>
    </svg>
  );
}

export function IconRefresh({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Arrowhead top-right */}
        <path d="M22 2h6v2h-6Z" />
        <path d="M26 4h2v6h-2Z" />
        {/* Circular arc top */}
        <path d="M12 4h10v2H12Z" />
        <path d="M8 6h4v2H8Z" />
        <path d="M6 8h2v2H6Z" />
        <path d="M4 10h2v4H4Z" />
        {/* Left side */}
        <path d="M4 14h2v4H4Z" />
        <path d="M6 18h2v4H6Z" />
        {/* Bottom arc */}
        <path d="M8 22h2v2H8Z" />
        <path d="M10 24h4v2h-4Z" />
        <path d="M14 26h8v2h-8Z" />
        {/* Right side continuing */}
        <path d="M22 24h2v2h-2Z" />
        <path d="M24 20h2v4h-2Z" />
        <path d="M26 16h2v4h-2Z" />
        {/* Arrow connection */}
        <path d="M22 4h4v2h-4Z" />
        <path d="M24 6h2v4h-2Z" />
      </g>
    </svg>
  );
}

export function IconSend({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Arrow tip upper-right */}
        <path d="M26 2h4v2h-4Z" />
        <path d="M24 4h6v2h-6Z" />
        <path d="M22 6h4v2h-4Z" />
        <path d="M20 8h4v2h-4Z" />
        <path d="M18 10h4v2h-4Z" />
        <path d="M16 12h4v2h-4Z" />
        <path d="M14 14h4v2h-4Z" />
        {/* Lower body */}
        <path d="M12 16h4v2h-4Z" />
        <path d="M10 18h4v2h-4Z" />
        <path d="M8 20h4v2H8Z" />
        {/* Tail sections */}
        <path d="M2 14h14v2H2Z" />
        <path d="M14 16h2v10h-2Z" />
        <path d="M6 22h4v2H6Z" />
        <path d="M4 24h4v2H4Z" />
        <path d="M2 26h4v2H2Z" />
      </g>
    </svg>
  );
}

export function IconCopy({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Back document */}
        <path d="M2 2h18v2H2Z" />
        <path d="M2 2h2v18H2Z" />
        <path d="M18 2h2v10h-2Z" />
        <path d="M2 18h10v2H2Z" />
        {/* Front document */}
        <path d="M12 12h18v2H12Z" />
        <path d="M12 12h2v18h-2Z" />
        <path d="M28 12h2v18h-2Z" />
        <path d="M12 28h18v2H12Z" />
      </g>
    </svg>
  );
}

/** Pixel key with decorative lock frame */
export function IconKey({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.48 25.9H32v4.58h-1.52Z" />
        <path d="M30.48 1.52H32v4.57h-1.52Z" />
        <path d="M25.91 0h4.57v1.52h-4.57Z" />
        <path d="M25.91 30.48h4.57V32h-4.57Z" />
        <path d="M24.38 13.71h1.53v13.72h-1.53Z" />
        <path d="M22.86 27.43h1.52v1.52h-1.52Z" />
        <path d="M9.15 28.95h13.71v1.53H9.15Z" />
        <path d="M19.81 3.05h1.53v1.52h-1.53Z" />
        <path d="m13.72 22.86 1.52 0 0 3.04 1.52 0 0 -3.04 1.53 0 0 -1.53 1.52 0 0 -3.05 -1.52 0 0 1.53 -1.53 0 0 -1.53 1.53 0 0 -1.52 -4.57 0 0 1.52 -1.53 0 0 3.05 1.53 0 0 1.53z" />
        <path d="M12.19 1.52h7.62v1.53h-7.62Z" />
        <path d="M10.67 3.05h1.52v1.52h-1.52Z" />
        <path d="m10.67 12.19 0 -7.62 -1.52 0 0 7.62 -1.53 0 0 1.52 16.76 0 0 -1.52 -1.52 0 0 -7.62 -1.52 0 0 7.62 -10.67 0z" />
        <path d="M7.62 27.43h1.53v1.52H7.62Z" />
        <path d="M6.1 13.71h1.52v13.72H6.1Z" />
        <path d="M1.53 30.48H6.1V32H1.53Z" />
        <path d="M1.53 0H6.1v1.52H1.53Z" />
        <path d="M0 25.9h1.53v4.58H0Z" />
        <path d="M0 1.52h1.53v4.57H0Z" />
      </g>
    </svg>
  );
}

/* ── Status Icons ─────────────────────────────────────────── */

/** Pixel warning triangle */
export function IconAlert({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.48 27.43H32v3.05h-1.52Z" />
        <path d="M28.95 24.38h1.53v3.05h-1.53Z" />
        <path d="M1.52 30.48h28.96V32H1.52Z" />
        <path d="M27.43 21.33h1.52v3.05h-1.52Z" />
        <path d="M25.9 18.29h1.53v3.04H25.9Z" />
        <path d="M24.38 15.24h1.52v3.05h-1.52Z" />
        <path d="M22.86 12.19h1.52v3.05h-1.52Z" />
        <path d="M21.33 9.14h1.53v3.05h-1.53Z" />
        <path d="M19.81 6.09h1.52v3.05h-1.52Z" />
        <path d="M18.29 3.05h1.52v3.04h-1.52Z" />
        <path d="m18.29 21.33 -4.58 0 0 1.53 -1.52 0 0 4.57 1.52 0 0 1.52 4.58 0 0 -1.52 1.52 0 0 -4.57 -1.52 0 0 -1.53z" />
        <path d="M18.29 9.14h-4.58v1.53h-1.52v6.09h1.52v3.05h4.58v-3.05h1.52v-6.09h-1.52Zm0 6.1h-1.53v-3.05h-1.52v-1.52h1.52v1.52h1.53Z" />
        <path d="M16.76 1.52h1.53v1.53h-1.53Z" />
        <path d="M15.24 0h1.52v1.52h-1.52Z" />
        <path d="M13.71 1.52h1.53v1.53h-1.53Z" />
        <path d="M12.19 3.05h1.52v3.04h-1.52Z" />
        <path d="M10.67 6.09h1.52v3.05h-1.52Z" />
        <path d="M9.14 9.14h1.53v3.05H9.14Z" />
        <path d="M7.62 12.19h1.52v3.05H7.62Z" />
        <path d="M6.09 15.24h1.53v3.05H6.09Z" />
        <path d="M4.57 18.29h1.52v3.04H4.57Z" />
        <path d="M3.05 21.33h1.52v3.05H3.05Z" />
        <path d="M1.52 24.38h1.53v3.05H1.52Z" />
        <path d="M0 27.43h1.52v3.05H0Z" />
      </g>
    </svg>
  );
}

/** Pixel shield with lock */
export function IconShield({ size = 14, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M27.425 4.57h1.53v16.76h-1.53Z" />
        <path d="M25.905 21.33h1.52v3.05h-1.52Z" />
        <path d="M24.385 24.38h1.52v1.53h-1.52Z" />
        <path d="M24.385 3.05h3.04v1.52h-3.04Z" />
        <path d="M22.855 25.91h1.53v1.52h-1.53Z" />
        <path d="M22.855 13.71h1.53v9.15h-1.53Z" />
        <path d="M21.335 27.43h1.52v1.52h-1.52Z" />
        <path d="M21.335 22.86h1.52v1.52h-1.52Z" />
        <path d="M21.335 1.52h3.05v1.53h-3.05Z" />
        <path d="M18.285 28.95h3.05v1.53h-3.05Z" />
        <path d="M10.665 24.38h10.67v1.53h-10.67Z" />
        <path d="m18.285 18.29 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 1.52 -1.52 0 0 3.05 1.52 0 0 1.52 1.52 0 0 1.53 1.53 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 -3.05 -1.53 0 0 1.53z" />
        <path d="M18.285 4.57h1.53V6.1h-1.53Z" />
        <path d="M16.765 15.24h1.52v1.52h-1.52Z" />
        <path d="M13.715 30.48h4.57V32h-4.57Z" />
        <path d="M13.715 3.05h4.57v1.52h-4.57Z" />
        <path d="M10.665 28.95h3.05v1.53h-3.05Z" />
        <path d="M12.195 4.57h1.52V6.1h-1.52Z" />
        <path d="M10.665 0h10.67v1.52h-10.67Z" />
        <path d="m22.855 13.71 0 -1.52 -1.52 0 0 -6.09 -1.52 0 0 6.09 -7.62 0 0 -6.09 -1.53 0 0 6.09 -1.52 0 0 1.52 13.71 0z" />
        <path d="M9.145 27.43h1.52v1.52h-1.52Z" />
        <path d="M9.145 22.86h1.52v1.52h-1.52Z" />
        <path d="M7.625 1.52h3.04v1.53h-3.04Z" />
        <path d="M7.625 25.91h1.52v1.52h-1.52Z" />
        <path d="M7.625 13.71h1.52v9.15h-1.52Z" />
        <path d="M6.095 24.38h1.53v1.53h-1.53Z" />
        <path d="M4.575 3.05h3.05v1.52h-3.05Z" />
        <path d="M4.575 21.33h1.52v3.05h-1.52Z" />
        <path d="M3.045 4.57h1.53v16.76h-1.53Z" />
      </g>
    </svg>
  );
}

export function IconClock({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Circle outline */}
        <path d="M10 2h12v2H10Z" />
        <path d="M6 4h4v2H6Z" />
        <path d="M22 4h4v2h-4Z" />
        <path d="M4 6h2v4H4Z" />
        <path d="M26 6h2v4h-2Z" />
        <path d="M2 10h2v12H2Z" />
        <path d="M28 10h2v12h-2Z" />
        <path d="M4 22h2v4H4Z" />
        <path d="M26 22h2v4h-2Z" />
        <path d="M6 26h4v2H6Z" />
        <path d="M22 26h4v2h-4Z" />
        <path d="M10 28h12v2H10Z" />
        {/* Hour hand (12 to center, vertical) */}
        <path d="M15 8h2v8h-2Z" />
        {/* Minute hand (center to 3, horizontal) */}
        <path d="M17 14h6v2h-6Z" />
      </g>
    </svg>
  );
}

/* ── Media Controls ───────────────────────────────────────── */

/** Pixel YouTube-style play button (Streamline Pixel) */
export function IconPlay({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M30.47 9.14h-1.52V6.09h-1.53V4.57H25.9V3.05h-3.05V1.52h-3.04V0h-7.62v1.52H9.14v1.53H6.09v1.52H4.57v1.52H3.04v3.05H1.52v3.05H0v7.62h1.52v3.05h1.52v3.04h1.53v1.53h1.52v1.52h3.05v1.53h3.05V32h7.62v-1.52h3.04v-1.53h3.05v-1.52h1.52V25.9h1.53v-3.04h1.52v-3.05H32v-7.62h-1.53Zm-7.62 7.62h-1.52v1.53h-1.52v1.52h-1.53v1.52h-1.52v1.53h-3.05v1.52h-1.52V7.62h1.52v1.52h3.05v1.53h1.52v1.52h1.53v1.52h1.52v1.53h1.52Z" fill={color || 'currentColor'} />
    </svg>
  );
}

export function IconPause({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Left bar */}
        <path d="M6 4h8v24H6Z" />
        {/* Right bar */}
        <path d="M18 4h8v24h-8Z" />
      </g>
    </svg>
  );
}

export function IconStop({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M6 6h20v20H6Z" />
      </g>
    </svg>
  );
}

/* ── Visibility Icons ─────────────────────────────────────── */

export function IconEye({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Eye shape - top lid */}
        <path d="M12 8h8v2h-8Z" />
        <path d="M8 10h4v2H8Z" />
        <path d="M20 10h4v2h-4Z" />
        <path d="M4 12h4v2H4Z" />
        <path d="M24 12h4v2h-4Z" />
        <path d="M2 14h2v2H2Z" />
        <path d="M28 14h2v2h-2Z" />
        {/* Eye shape - bottom lid */}
        <path d="M4 18h4v2H4Z" />
        <path d="M24 18h4v2h-4Z" />
        <path d="M8 20h4v2H8Z" />
        <path d="M20 20h4v2h-4Z" />
        <path d="M12 22h8v2h-8Z" />
        {/* Pupil */}
        <path d="M14 14h4v4h-4Z" />
      </g>
    </svg>
  );
}

export function IconEyeOff({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Eye shape - top lid */}
        <path d="M12 8h8v2h-8Z" />
        <path d="M8 10h4v2H8Z" />
        <path d="M20 10h4v2h-4Z" />
        <path d="M4 12h4v2H4Z" />
        <path d="M24 12h4v2h-4Z" />
        <path d="M2 14h2v2H2Z" />
        <path d="M28 14h2v2h-2Z" />
        {/* Eye shape - bottom lid */}
        <path d="M4 18h4v2H4Z" />
        <path d="M24 18h4v2h-4Z" />
        <path d="M8 20h4v2H8Z" />
        <path d="M20 20h4v2h-4Z" />
        <path d="M12 22h8v2h-8Z" />
        {/* Pupil */}
        <path d="M14 14h4v4h-4Z" />
        {/* Diagonal slash */}
        <path d="M24 4h2v2h-2Z" />
        <path d="M22 6h2v2h-2Z" />
        <path d="M20 8h2v2h-2Z" />
        <path d="M18 10h2v2h-2Z" />
        <path d="M16 12h2v2h-2Z" />
        <path d="M14 14h2v2h-2Z" />
        <path d="M12 16h2v2h-2Z" />
        <path d="M10 18h2v2h-2Z" />
        <path d="M8 20h2v2H8Z" />
        <path d="M6 22h2v2H6Z" />
      </g>
    </svg>
  );
}

/* ── Communication Icons ──────────────────────────────────── */

/** Pixel open mail with address */
export function IconMail({ size = 18, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m30.48 12.19 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 -3.04 -1.52 0 0 12.19 1.52 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 13.71 1.52 0 0 -16.76 -1.52 0z" />
        <path d="M28.95 28.95h1.53v1.53h-1.53Z" />
        <path d="M3.05 30.48h25.9V32H3.05Z" />
        <path d="M24.38 18.29h1.53v1.52h-1.53Z" />
        <path d="M22.86 25.91h1.52v1.52h-1.52Z" />
        <path d="M22.86 19.81h1.52v1.52h-1.52Z" />
        <path d="M21.33 24.38h1.53v1.53h-1.53Z" />
        <path d="M21.33 21.33h1.53v1.53h-1.53Z" />
        <path d="M21.33 10.67h1.53v4.57h-1.53Z" />
        <path d="M19.81 9.14h1.52v1.53h-1.52Z" />
        <path d="M10.67 22.86h10.66v1.52H10.67Z" />
        <path d="M18.29 15.24h3.04v1.52h-3.04Z" />
        <path d="m18.29 10.67 -4.57 0 0 1.52 3.04 0 0 3.05 1.53 0 0 -4.57z" />
        <path d="M13.72 15.24h3.04v1.52h-3.04Z" />
        <path d="M12.19 7.62h7.62v1.52h-7.62Z" />
        <path d="M12.19 18.29h7.62v1.52h-7.62Z" />
        <path d="M12.19 12.19h1.53v3.05h-1.53Z" />
        <path d="M10.67 16.76h1.52v1.53h-1.52Z" />
        <path d="M10.67 9.14h1.52v1.53h-1.52Z" />
        <path d="M9.14 24.38h1.53v1.53H9.14Z" />
        <path d="M9.14 21.33h1.53v1.53H9.14Z" />
        <path d="M9.14 10.67h1.53v6.09H9.14Z" />
        <path d="M7.62 25.91h1.52v1.52H7.62Z" />
        <path d="M7.62 19.81h1.52v1.52H7.62Z" />
        <path d="m25.91 6.1 0 -1.53 -3.05 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 -1.52 -7.62 0 0 1.52 -1.52 0 0 1.53 -1.53 0 0 1.52 -3.04 0 0 1.53 19.81 0z" />
        <path d="M6.1 18.29h1.52v1.52H6.1Z" />
        <path d="M1.52 28.95h1.53v1.53H1.52Z" />
        <path d="m1.52 15.24 1.53 0 0 1.52 1.52 0 0 1.53 1.53 0 0 -12.19 -1.53 0 0 3.04 -1.52 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 16.76 1.52 0 0 -13.71z" />
      </g>
    </svg>
  );
}

/* ── Info / Knowledge Icons ───────────────────────────────── */

/** Pixel light bulb */
export function IconLightbulb({ size = 18, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M27.43 6.1h1.52v12.19h-1.52Z" />
        <path d="M25.9 18.29h1.53v1.52H25.9Z" />
        <path d="M25.9 4.57h1.53V6.1H25.9Z" />
        <path d="M24.38 19.81h1.52v1.52h-1.52Z" />
        <path d="M24.38 3.05h1.52v1.52h-1.52Z" />
        <path d="M22.85 21.33h1.53v1.53h-1.53Z" />
        <path d="M22.85 1.52h1.53v1.53h-1.53Z" />
        <path d="M18.28 22.86v-6.1h-1.52v6.1h-1.52v-6.1h-1.53v6.1H9.14v1.52h1.52v6.1h1.53v-1.53h7.62v1.53h1.52v-6.1h1.52v-1.52Zm1.53 3.04h-7.62v-1.52h7.62Z" />
        <path d="M19.81 10.67h1.52v3.04h-1.52Z" />
        <path d="M18.28 13.71h1.53v3.05h-1.53Z" />
        <path d="M12.19 30.48h7.62V32h-7.62Z" />
        <path d="M12.19 13.71h1.52v3.05h-1.52Z" />
        <path d="M10.66 10.67h1.53v3.04h-1.53Z" />
        <path d="M9.14 0h13.71v1.52H9.14Z" />
        <path d="M7.62 21.33h1.52v1.53H7.62Z" />
        <path d="M7.62 1.52h1.52v1.53H7.62Z" />
        <path d="M6.09 19.81h1.53v1.52H6.09Z" />
        <path d="M6.09 3.05h1.53v1.52H6.09Z" />
        <path d="M4.57 18.29h1.52v1.52H4.57Z" />
        <path d="M4.57 4.57h1.52V6.1H4.57Z" />
        <path d="M3.05 6.1h1.52v12.19H3.05Z" />
      </g>
    </svg>
  );
}

/** Pixel archive books */
export function IconBook({ size = 18, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M28.96 6.1V0H13.72v1.52h-6.1v1.53H3.05v10.67H1.53v3.04H0V32h32V6.1ZM7.62 30.48H1.53v-9.15h6.09Zm0 -10.67H4.58V4.57h3.04ZM9.15 3.05h4.57v1.52h-3.05v15.24H9.15Zm4.57 3.05v13.71H12.2V6.1Zm1.52 24.38H9.15v-9.15h6.09Zm15.24 0H16.77V19.81h-1.53V1.52h12.19V6.1h-4.57v1.52h7.62Z" />
        <path d="M25.91 21.33h1.52v1.53h-1.52Z" />
        <path d="M25.91 18.29h1.52v1.52h-1.52Z" />
        <path d="M22.86 22.86h3.05v1.52h-3.05Z" />
        <path d="M21.34 21.33h1.52v1.53h-1.52Z" />
        <path d="M21.34 18.29h1.52v1.52h-1.52Z" />
        <path d="M21.34 7.62h1.52v3.05h-1.52Z" />
        <path d="M19.81 10.67h1.53v3.05h-1.53Z" />
        <path d="M18.29 13.72h1.52v3.04h-1.52Z" />
        <path d="M18.29 3.05h1.52v1.52h-1.52Z" />
        <path d="M16.77 16.76h1.52v3.05h-1.52Z" />
        <path d="M10.67 24.38h3.05v3.05h-3.05Z" />
        <path d="M3.05 24.38H6.1v3.05H3.05Z" />
      </g>
    </svg>
  );
}

/** Pixel coin with dollar sign */
export function IconDollar({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="m18.285 6.095 3.05 0 0 1.52 1.52 0 0 1.53 1.53 0 0 3.05 1.52 0 0 7.61 -1.52 0 0 3.05 -1.53 0 0 1.53 -1.52 0 0 1.52 -3.05 0 0 1.52 -7.62 0 0 1.53 10.67 0 0 -1.53 3.05 0 0 -1.52 1.52 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -3.05 1.52 0 0 -7.61 -1.52 0 0 -3.05 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 -1.52 -3.05 0 0 -1.53 -10.67 0 0 1.53 7.62 0 0 1.52z" />
        <path d="M22.855 12.195h1.53v7.61h-1.53Z" />
        <path d="M21.335 19.805h1.52v1.53h-1.52Z" />
        <path d="M21.335 10.665h1.52v1.53h-1.52Z" />
        <path d="M19.815 21.335h1.52v1.52h-1.52Z" />
        <path d="M19.815 9.145h1.52v1.52h-1.52Z" />
        <path d="M18.285 22.855h1.53v1.53h-1.53Z" />
        <path d="M18.285 7.615h1.53v1.53h-1.53Z" />
        <path d="M10.665 24.385h7.62v1.52h-7.62Z" />
        <path d="M16.765 16.765h1.52v3.04h-1.52Z" />
        <path d="M16.765 12.195h1.52v1.52h-1.52Z" />
        <path d="M10.665 6.095h7.62v1.52h-7.62Z" />
        <path d="m13.715 21.335 0 1.52 1.52 0 0 -1.52 1.53 0 0 -1.53 -1.53 0 0 -3.04 1.53 0 0 -1.53 -1.53 0 0 -3.04 1.53 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 1.52 -1.52 0 0 1.53 1.52 0 0 3.04 -1.52 0 0 1.53 1.52 0 0 3.04 -1.52 0 0 1.53 1.52 0z" />
        <path d="M10.665 18.285h1.53v1.52h-1.53Z" />
        <path d="M10.665 12.195h1.53v3.04h-1.53Z" />
        <path d="M7.625 25.905h3.04v1.52h-3.04Z" />
        <path d="M9.145 22.855h1.52v1.53h-1.52Z" />
        <path d="M9.145 7.615h1.52v1.53h-1.52Z" />
        <path d="M7.625 4.575h3.04v1.52h-3.04Z" />
        <path d="M7.625 21.335h1.52v1.52h-1.52Z" />
        <path d="M7.625 9.145h1.52v1.52h-1.52Z" />
        <path d="M6.095 24.385h1.53v1.52h-1.53Z" />
        <path d="M6.095 19.805h1.53v1.53h-1.53Z" />
        <path d="M6.095 10.665h1.53v1.53h-1.53Z" />
        <path d="M6.095 6.095h1.53v1.52h-1.53Z" />
        <path d="M4.575 22.855h1.52v1.53h-1.52Z" />
        <path d="M4.575 12.195h1.52v7.61h-1.52Z" />
        <path d="M4.575 7.615h1.52v1.53h-1.52Z" />
        <path d="M3.045 19.805h1.53v3.05h-1.53Z" />
        <path d="M3.045 9.145h1.53v3.05h-1.53Z" />
        <path d="M1.525 12.195h1.52v7.61h-1.52Z" />
      </g>
    </svg>
  );
}

export function IconRepeat({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Top arrow pointing right */}
        <path d="M24 2h2v2h-2Z" />
        <path d="M26 4h2v2h-2Z" />
        <path d="M28 6h2v2h-2Z" />
        <path d="M26 8h2v2h-2Z" />
        <path d="M24 10h2v2h-2Z" />
        {/* Top horizontal bar */}
        <path d="M8 6h18v2H8Z" />
        {/* Right side down */}
        <path d="M26 8h2v4h-2Z" />
        {/* Left side connecting top */}
        <path d="M6 6h2v2H6Z" />
        <path d="M4 8h2v4H4Z" />
        {/* Bottom arrow pointing left */}
        <path d="M8 20h2v2H8Z" />
        <path d="M6 22h2v2H6Z" />
        <path d="M4 24h2v2H4Z" />
        <path d="M2 22h2v2H2Z" />
        <path d="M4 20h2v2H4Z" />
        {/* Bottom horizontal bar */}
        <path d="M6 24h18v2H6Z" />
        {/* Left side up */}
        <path d="M4 20h2v4H4Z" />
        {/* Right side connecting bottom */}
        <path d="M24 24h2v2h-2Z" />
        <path d="M26 20h2v4h-2Z" />
      </g>
    </svg>
  );
}

/* ── Toast / Inline Status Icons ──────────────────────────── */

export function IconCheckSmall({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M24 6h2v2h-2Z" />
        <path d="M22 8h2v2h-2Z" />
        <path d="M20 10h2v2h-2Z" />
        <path d="M18 12h2v2h-2Z" />
        <path d="M16 14h2v2h-2Z" />
        <path d="M14 16h2v2h-2Z" />
        <path d="M12 18h2v2h-2Z" />
        <path d="M10 20h2v2h-2Z" />
        <path d="M8 18h2v2H8Z" />
        <path d="M6 16h2v2H6Z" />
      </g>
    </svg>
  );
}

export function IconAlertCircle({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Circle outline */}
        <path d="M10 2h12v2H10Z" />
        <path d="M6 4h4v2H6Z" />
        <path d="M22 4h4v2h-4Z" />
        <path d="M4 6h2v4H4Z" />
        <path d="M26 6h2v4h-2Z" />
        <path d="M2 10h2v12H2Z" />
        <path d="M28 10h2v12h-2Z" />
        <path d="M4 22h2v4H4Z" />
        <path d="M26 22h2v4h-2Z" />
        <path d="M6 26h4v2H6Z" />
        <path d="M22 26h4v2h-4Z" />
        <path d="M10 28h12v2H10Z" />
        {/* X inside - top-left to bottom-right */}
        <path d="M10 10h2v2h-2Z" />
        <path d="M12 12h2v2h-2Z" />
        <path d="M14 14h4v4h-4Z" />
        <path d="M18 18h2v2h-2Z" />
        <path d="M20 20h2v2h-2Z" />
        {/* X inside - top-right to bottom-left */}
        <path d="M20 10h2v2h-2Z" />
        <path d="M18 12h2v2h-2Z" />
        <path d="M12 18h2v2h-2Z" />
        <path d="M10 20h2v2h-2Z" />
      </g>
    </svg>
  );
}

/** Pixel information circle */
export function IconInfo({ size = 16, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M30.48 9.14h-1.53V6.09h-1.52V4.57H25.9V3.05h-3.04V1.52h-3.05V0h-7.62v1.52H9.14v1.53H6.09v1.52H4.57v1.52H3.05v3.05H1.52v3.05H0v7.62h1.52v3.05h1.53v3.04h1.52v1.53h1.52v1.52h3.05v1.53h3.05V32h7.62v-1.52h3.05v-1.53h3.04v-1.52h1.53V25.9h1.52v-3.04h1.53v-3.05H32v-7.62h-1.52ZM12.19 6.09h1.52V4.57h4.58v1.52h1.52v4.58h-1.52v1.52h-4.58v-1.52h-1.52ZM22.86 25.9h-1.53v1.53h-7.62V25.9h-1.52V15.24h1.52v-1.53h4.58v1.53h1.52v7.62h1.52v1.52h1.53Z" />
      </g>
    </svg>
  );
}

/** Pixel three-dot "more" / ellipsis icon (horizontal) */
export function IconMore({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Left dot */}
        <rect x="2" y="13" width="6" height="6" />
        {/* Center dot */}
        <rect x="13" y="13" width="6" height="6" />
        {/* Right dot */}
        <rect x="24" y="13" width="6" height="6" />
      </g>
    </svg>
  );
}

/** Pixel thumbs up / like (Streamline Pixel) */
export function IconCamera({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11Z" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" stroke={color || 'currentColor'} strokeWidth="2" />
    </svg>
  );
}

export function IconCar({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 17h14M5 17a2 2 0 0 1-2-2v-3h18v3a2 2 0 0 1-2 2M5 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2m10 0v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M3 12l2.3-6.13A2 2 0 0 1 7.16 4h9.68a2 2 0 0 1 1.86 1.27L21 12" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="15" r="1" fill={color || 'currentColor'} />
      <circle cx="17" cy="15" r="1" fill={color || 'currentColor'} />
    </svg>
  );
}

export function IconThumbsUp({ size = 22, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        <path d="M24.375 9.15v1.52h-1.52v1.52h1.52v15.24h-3.05v1.52h3.05v1.53h6.1V9.15Zm3.05 6.09h-1.52v-3.05h1.52Z" />
        <path d="M21.325 9.15h1.53v1.52h-1.53Z" />
        <path d="M19.805 7.62h1.52v1.53h-1.52Z" />
        <path d="M19.805 28.95h1.52v1.53h-1.52Z" />
        <path d="M18.285 1.53h1.52v6.09h-1.52Z" />
        <path d="M15.235 0h3.05v1.53h-3.05Z" />
        <path d="M6.095 30.48h13.71V32H6.095Z" />
        <path d="M15.235 10.67h1.52v1.52h-1.52Z" />
        <path d="M13.715 1.53h1.52v1.52h-1.52Z" />
        <path d="M13.715 9.15h1.52v1.52h-1.52Z" />
        <path d="M12.185 3.05h1.53v6.1h-1.53Z" />
        <path d="M4.565 12.19h10.67v1.53H4.565Z" />
        <path d="m10.665 27.43 0 -1.52 -7.62 0 0 3.04 1.52 0 0 -1.52 6.1 0z" />
        <path d="M4.565 28.95h1.53v1.53h-1.53Z" />
        <path d="M3.045 13.72h1.52v1.52h-1.52Z" />
        <path d="m9.135 22.86 0 -1.52 -6.09 0 0 -3.05 6.09 0 0 -1.53 -6.09 0 0 -1.52 -1.52 0 0 10.67 1.52 0 0 -3.05 6.09 0z" />
      </g>
    </svg>
  );
}

/** Pixel sparkle / AI indicator — four-pointed star with small accent dots */
export function IconSparkle({ size = 14, className, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g fill={color || 'currentColor'}>
        {/* Main four-pointed star */}
        <path d="M14 0h4v2h-4z" />
        <path d="M14 2h2v4h-2z" />
        <path d="M16 2h2v4h-2z" />
        <path d="M12 6h2v2h-2z" />
        <path d="M18 6h2v2h-2z" />
        <path d="M10 8h2v2h-2z" />
        <path d="M20 8h2v2h-2z" />
        <path d="M8 10h2v2h-2z" />
        <path d="M22 10h2v2h-2z" />
        <path d="M6 12h2v2h-2z" />
        <path d="M24 12h2v2h-2z" />
        <path d="M4 14h2v4h-2z" />
        <path d="M26 14h2v4h-2z" />
        <path d="M0 14h4v4H0z" />
        <path d="M28 14h4v4h-4z" />
        <path d="M6 18h2v2h-2z" />
        <path d="M24 18h2v2h-2z" />
        <path d="M8 20h2v2h-2z" />
        <path d="M22 20h2v2h-2z" />
        <path d="M10 22h2v2h-2z" />
        <path d="M20 22h2v2h-2z" />
        <path d="M12 24h2v2h-2z" />
        <path d="M18 24h2v2h-2z" />
        <path d="M14 26h4v4h-4z" />
        <path d="M14 30h4v2h-4z" />
      </g>
    </svg>
  );
}
