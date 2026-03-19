/* ─────────────────────────────────────────────────────────────
   Retro Sci-Fi Icon Library
   Filled + outlined style with chunky proportions.
   Colors via CSS vars: --icon-fill, --icon-highlight,
   --icon-accent, --icon-stroke (see index.css)
   ───────────────────────────────────────────────────────────── */

export interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/* ── Navigation Icons ─────────────────────────────────────── */

/** Retro TV monitor with antenna + screen grid */
export function IconDashboard({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="8" y1="5" x2="6.5" y2="2.5" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="5" x2="17.5" y2="2.5" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="6.5" cy="2.5" r="1" fill="var(--icon-accent)" />
      <circle cx="17.5" cy="2.5" r="1" fill="var(--icon-accent)" />
      <rect x="2" y="5" width="20" height="14" rx="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <rect x="5" y="8" width="14" height="8" rx="1.5" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.8" />
      <line x1="12" y1="8" x2="12" y2="16" stroke={s} strokeWidth="0.7" opacity="0.4" />
      <line x1="5" y1="12" x2="19" y2="12" stroke={s} strokeWidth="0.7" opacity="0.4" />
      <line x1="9" y1="19" x2="15" y2="19" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="21" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Retro datapad with display lines */
export function IconDocument({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" fill="var(--icon-highlight)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="13" x2="16" y2="13" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8" y1="17" x2="13" y2="17" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16.5" cy="17" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

/** Retro calendar with binding posts */
export function IconCalendar({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <line x1="8" y1="2" x2="8" y2="6" stroke={s} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" stroke={s} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="5.5" y="10" width="13" height="10" rx="1.5" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.8" />
      <circle cx="8.5" cy="13.5" r="1" fill="var(--icon-accent)" />
      <circle cx="12" cy="13.5" r="1" fill={s} opacity="0.3" />
      <circle cx="15.5" cy="13.5" r="1" fill={s} opacity="0.3" />
      <circle cx="8.5" cy="17" r="1" fill={s} opacity="0.3" />
      <circle cx="12" cy="17" r="1" fill={s} opacity="0.3" />
    </svg>
  );
}

/** Two retro astronaut helmets */
export function IconClients({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="7" r="4" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <ellipse cx="9" cy="6.5" rx="2" ry="1.5" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.6" />
      <path d="M1 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="7" r="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <ellipse cx="17" cy="6.5" rx="1.5" ry="1.2" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.5" />
      <path d="M21 21v-1.5a3.5 3.5 0 00-2.5-3.36" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Retro hierarchy with robot head */
export function IconTeam({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="5" r="3.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="11" cy="4.5" r="0.8" fill="var(--icon-highlight)" />
      <circle cx="13" cy="4.5" r="0.8" fill="var(--icon-highlight)" />
      <line x1="12" y1="2" x2="12" y2="1" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="8.5" x2="12" y2="12" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="12" x2="5" y2="16" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="12" x2="19" y2="16" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="5" cy="18" r="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="19" cy="18" r="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="5" cy="18" r="1" fill="var(--icon-accent)" />
      <circle cx="19" cy="18" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

/** Retro oscilloscope bars */
export function IconAnalytics({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="14" width="4" height="8" rx="1.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <rect x="10" y="6" width="4" height="16" rx="1.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <rect x="17" y="10" width="4" height="12" rx="1.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="5" cy="14" r="1" fill="var(--icon-accent)" />
      <circle cx="12" cy="6" r="1" fill="var(--icon-accent)" />
      <circle cx="19" cy="10" r="1" fill="var(--icon-accent)" />
      <line x1="2" y1="22" x2="22" y2="22" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Retro control panel sliders */
export function IconSettings({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="4" y1="7" x2="20" y2="7" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="17" x2="20" y2="17" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="7" r="2.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="15" cy="12" r="2.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="10" cy="17" r="2.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="8" cy="7" r="0.8" fill="var(--icon-accent)" />
      <circle cx="15" cy="12" r="0.8" fill="var(--icon-accent)" />
      <circle cx="10" cy="17" r="0.8" fill="var(--icon-accent)" />
    </svg>
  );
}

/** Retro astronaut profile */
export function IconUser({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8" r="4.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <ellipse cx="12" cy="7" rx="2.5" ry="2" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.6" />
      <path d="M4 21v-2a5 5 0 015-5h6a5 5 0 015 5v2" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Retro safe with dial */
export function IconLock({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="2.5" fill="var(--icon-highlight)" stroke={s} strokeWidth="1.2" />
      <circle cx="12" cy="16" r="0.8" fill="var(--icon-accent)" />
    </svg>
  );
}

/** Retro alarm dome */
export function IconBell({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5" r="1" fill="var(--icon-accent)" />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Retro gear cog */
export function IconGear({ size = 18, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="var(--icon-highlight)" stroke={s} strokeWidth="1.2" />
      <circle cx="12" cy="12" r="0.8" fill="var(--icon-accent)" />
    </svg>
  );
}

/* ── Directional Icons ────────────────────────────────────── */

export function IconChevronUp({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 15l6-6 6 6" stroke={s} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronDown({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 9l6 6 6-6" stroke={s} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronLeft({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 6l-6 6 6 6" stroke={s} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronRight({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 6l6 6-6 6" stroke={s} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Theme Icons ──────────────────────────────────────────── */

/** Retro starburst sun */
export function IconSun({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="4" fill="var(--icon-accent)" stroke={s} strokeWidth="1.8" />
      <line x1="12" y1="1" x2="12" y2="4" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="20" x2="12" y2="23" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="1" y1="12" x2="4" y2="12" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="12" x2="23" y2="12" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" stroke={s} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Retro crescent moon */
export function IconMoon({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15" cy="7" r="0.8" fill="var(--icon-accent)" />
    </svg>
  );
}

/* ── Action Icons ─────────────────────────────────────────── */

export function IconSearch({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="7" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="11" cy="11" r="3.5" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.8" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconMenu({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="2.5" rx="1.25" fill="var(--icon-fill)" stroke={s} strokeWidth="1" />
      <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="var(--icon-fill)" stroke={s} strokeWidth="1" />
      <rect x="3" y="16.5" width="18" height="2.5" rx="1.25" fill="var(--icon-fill)" stroke={s} strokeWidth="1" />
    </svg>
  );
}

export function IconPlus({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ size = 18, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="6" y1="6" x2="18" y2="18" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="18" y1="6" x2="6" y2="18" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ size = 18, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <polyline points="8 12 11 15 17 9" stroke={s} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function IconEdit({ size = 14, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M17 3a2.85 2.85 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="4" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

export function IconTrash({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="6" width="14" height="16" rx="2" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <line x1="3" y1="6" x2="21" y2="6" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="10" y1="11" x2="10" y2="17" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="11" x2="14" y2="17" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconRefresh({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <polyline points="23 4 23 10 17 10" fill="var(--icon-fill)" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSend({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M22 2L11 13" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCopy({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" fill="var(--icon-highlight)" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconKey({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="8" cy="15" r="5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="8" cy="15" r="2" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.8" />
      <path d="M12 11l5-5m0 0l3 3-2 2-3-3m0 0l2-2" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Status Icons ─────────────────────────────────────────── */

export function IconAlert({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <line x1="12" y1="8" x2="12" y2="13" stroke={s} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.2" fill={s} />
    </svg>
  );
}

export function IconShield({ size = 14, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9 12 11 14 15 10" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function IconClock({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.6" />
      <polyline points="12 7 12 12 15 14" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="12" cy="12" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

/* ── Media Controls ───────────────────────────────────────── */

export function IconPlay({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <polygon points="6,3 20,12 6,21" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

export function IconPause({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="3" width="5" height="18" rx="1.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <rect x="14" y="3" width="5" height="18" rx="1.5" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
    </svg>
  );
}

export function IconStop({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.5" fill="var(--icon-accent)" />
    </svg>
  );
}

/* ── Visibility Icons ─────────────────────────────────────── */

export function IconEye({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="var(--icon-highlight)" stroke={s} strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

export function IconEyeOff({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="1" y1="1" x2="23" y2="23" stroke={s} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Communication Icons ──────────────────────────────────── */

export function IconMail({ size = 18, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="3" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <path d="M22 4l-10 8L2 4" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="7" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

/* ── Info / Knowledge Icons ───────────────────────────────── */

export function IconLightbulb({ size = 18, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 18h6M10 22h4" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.09 14A6 6 0 0018 8a6 6 0 10-9.09 6" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="2" fill="var(--icon-accent)" />
      <line x1="12" y1="2" x2="12" y2="4" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconBook({ size = 18, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="5" width="8" height="5" rx="1" fill="var(--icon-highlight)" stroke={s} strokeWidth="0.6" />
      <circle cx="17" cy="5" r="1" fill="var(--icon-accent)" />
    </svg>
  );
}

/** Retro stacked layers — app logo */
export function IconLayers({ size = 22, className, color }: IconProps) {
  const s = color || 'white';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--icon-fill)" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconDollar({ size = 22, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="var(--icon-fill)" stroke={s} strokeWidth="1.8" />
      <line x1="12" y1="2" x2="12" y2="22" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.5 7.5H9.5a3 3 0 000 6h5a3 3 0 010 6H7.5" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRepeat({ size = 16, className, color }: IconProps) {
  const s = color || 'var(--icon-stroke)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <polyline points="17 1 21 5 17 9" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11V9a4 4 0 014-4h14" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 23 3 19 7 15" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13v2a4 4 0 01-4 4H3" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Toast / Inline Status Icons ──────────────────────────── */

export function IconCheckSmall({ size = 16, className, color }: IconProps) {
  const s = color || 'currentColor';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <polyline points="20 6 9 17 4 12" stroke={s} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlertCircle({ size = 16, className, color }: IconProps) {
  const s = color || 'currentColor';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" stroke={s} strokeWidth="1.8" />
      <line x1="15" y1="9" x2="9" y2="15" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="9" x2="15" y2="15" stroke={s} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconInfo({ size = 16, className, color }: IconProps) {
  const s = color || 'currentColor';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" stroke={s} strokeWidth="1.8" />
      <line x1="12" y1="16" x2="12" y2="12" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill={s} />
    </svg>
  );
}
