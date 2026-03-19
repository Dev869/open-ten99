import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { cn } from '../lib/utils';

/* ── Theme Icons ──────────────────────────────────── */

function IconSun() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

/* ── SVG Icons ─────────────────────────────────────── */

function IconDashboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function IconWorkItems() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconClients() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconVault() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

function IconCustomize() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Nav Config ────────────────────────────────────── */

interface NavItem {
  to: string;
  key: string;
  label: string;
  Icon: () => JSX.Element;
}

const defaultNavItems: NavItem[] = [
  { to: '/dashboard', key: 'dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/dashboard/work-items', key: 'work-items', label: 'Work Items', Icon: IconWorkItems },
  { to: '/dashboard/calendar', key: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/dashboard/clients', key: 'clients', label: 'Clients', Icon: IconClients },
  { to: '/dashboard/analytics', key: 'analytics', label: 'Analytics', Icon: IconAnalytics },
  { key: 'team', to: '/dashboard/team', label: 'Team', Icon: IconTeam },
  { to: '/dashboard/vault', key: 'vault', label: 'Vault', Icon: IconVault },
];

const defaultOrder = defaultNavItems.map((item) => item.key);

/* ── Toggle Switch ─────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--bg-card)] shadow-sm ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

/* ── Customization Panel ───────────────────────────── */

interface CustomizePanelProps {
  items: NavItem[];
  order: string[];
  hidden: string[];
  onReorder: (newOrder: string[]) => void;
  onToggle: (key: string) => void;
  onReset: () => void;
  onClose: () => void;
  isMobile: boolean;
}

function CustomizePanel({
  items,
  order,
  hidden,
  onReorder,
  onToggle,
  onReset,
  onClose,
  isMobile,
}: CustomizePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside (desktop only)
  useEffect(() => {
    if (isMobile) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay adding the listener so the opening click doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isMobile, onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Build ordered items list from order array
  const orderedItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.key, item]));
    return order.map((key) => map.get(key)).filter(Boolean) as NavItem[];
  }, [items, order]);

  function moveUp(key: string) {
    const idx = order.indexOf(key);
    if (idx <= 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onReorder(next);
  }

  function moveDown(key: string) {
    const idx = order.indexOf(key);
    if (idx < 0 || idx >= order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onReorder(next);
  }

  const panelContent = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Customize Sidebar</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {orderedItems.map((item, idx) => {
          const isHidden = hidden.includes(item.key);
          return (
            <div
              key={item.key}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150',
                isHidden ? 'opacity-50' : ''
              )}
            >
              <div className="flex-shrink-0 text-[var(--text-secondary)]">
                <item.Icon />
              </div>
              <span className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">
                {item.label}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => moveUp(item.key)}
                  disabled={idx === 0}
                  className={cn(
                    'w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                    idx === 0
                      ? 'text-[var(--border)] cursor-not-allowed'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <IconChevronUp />
                </button>
                <button
                  onClick={() => moveDown(item.key)}
                  disabled={idx === orderedItems.length - 1}
                  className={cn(
                    'w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                    idx === orderedItems.length - 1
                      ? 'text-[var(--border)] cursor-not-allowed'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <IconChevronDown />
                </button>
                <Toggle checked={!isHidden} onChange={() => onToggle(item.key)} />
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onReset}
        className="mt-3 text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] font-medium text-center transition-colors py-1"
      >
        Reset to Default
      </button>
    </div>
  );

  // Mobile: modal overlay
  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] animate-fade-in"
          onClick={onClose}
        />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl p-4 animate-fade-in-up max-h-[80vh] overflow-y-auto">
          {panelContent}
        </div>
      </>
    );
  }

  // Desktop: positioned popover next to sidebar
  return (
    <div
      ref={panelRef}
      className="fixed left-[80px] bottom-14 z-[60] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl p-4 w-[300px] animate-fade-in-up"
      style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
    >
      {panelContent}
    </div>
  );
}

/* ── Component ─────────────────────────────────────── */

interface SidebarProps {
  pendingCount: number;
  isOpen: boolean;
  onClose: () => void;
  sidebarOrder?: string[];
  sidebarHidden?: string[];
  onUpdateSidebar?: (order: string[], hidden: string[]) => void;
  dark: boolean;
  onToggleTheme: () => void;
}

export function Sidebar({
  pendingCount,
  isOpen,
  onClose,
  dark,
  onToggleTheme,
  sidebarOrder,
  sidebarHidden,
  onUpdateSidebar,
}: SidebarProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Track viewport for mobile detection
  useEffect(() => {
    function check() {
      setIsMobileView(window.innerWidth < 768);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Resolve current order and hidden sets
  const currentOrder = useMemo(() => {
    if (sidebarOrder && sidebarOrder.length > 0) {
      // Make sure all default keys are included (in case new nav items were added)
      const orderSet = new Set(sidebarOrder);
      const extras = defaultOrder.filter((k) => !orderSet.has(k));
      return [...sidebarOrder, ...extras];
    }
    return defaultOrder;
  }, [sidebarOrder]);

  const currentHidden = useMemo(() => {
    return sidebarHidden ?? [];
  }, [sidebarHidden]);

  // Compute visible nav items in order
  const visibleNavItems = useMemo(() => {
    const itemMap = new Map(defaultNavItems.map((item) => [item.key, item]));
    return currentOrder
      .map((key) => itemMap.get(key))
      .filter((item): item is NavItem => item != null && !currentHidden.includes(item.key));
  }, [currentOrder, currentHidden]);

  const handleReorder = useCallback(
    (newOrder: string[]) => {
      onUpdateSidebar?.(newOrder, currentHidden);
    },
    [onUpdateSidebar, currentHidden]
  );

  const handleToggle = useCallback(
    (key: string) => {
      const newHidden = currentHidden.includes(key)
        ? currentHidden.filter((k) => k !== key)
        : [...currentHidden, key];
      onUpdateSidebar?.(currentOrder, newHidden);
    },
    [onUpdateSidebar, currentOrder, currentHidden]
  );

  const handleReset = useCallback(() => {
    onUpdateSidebar?.(defaultOrder, []);
  }, [onUpdateSidebar]);

  const handleCloseCustomize = useCallback(() => {
    setCustomizeOpen(false);
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'h-full z-50 flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex-shrink-0',
          // Desktop: always visible, icon-only, static position
          'hidden md:flex w-[72px]',
          // Mobile: fixed drawer
          isOpen && '!flex fixed w-[280px] shadow-2xl animate-slide-in-right'
        )}
      >
        {/* Brand mark */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 md:justify-center">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-[var(--text-primary)] text-lg tracking-tight md:hidden">
              OpenChanges
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-3 md:items-center mt-2">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center rounded-xl transition-all duration-200',
                  // Desktop: centered icon button
                  'md:w-11 md:h-11 md:justify-center',
                  // Mobile: full width with label
                  'w-full px-4 py-3 gap-3 md:px-0 md:py-0 md:gap-0',
                  isActive
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                )
              }
            >
              <div className="relative flex-shrink-0">
                <item.Icon />
                {item.to === '/dashboard' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--accent)] rounded-full border-2 border-[var(--bg-sidebar)]" />
                )}
              </div>
              <span className="text-sm font-medium md:hidden">{item.label}</span>
              {item.to === '/dashboard' && pendingCount > 0 && (
                <span className="ml-auto md:hidden bg-[var(--accent)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="flex flex-col gap-1 px-3 md:items-center pb-5">
          <NavLink
            to="/dashboard/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl transition-all duration-200',
                'md:w-11 md:h-11 md:justify-center',
                'w-full px-4 py-3 gap-3 md:px-0 md:py-0 md:gap-0',
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
              )
            }
          >
            <IconSettings />
            <span className="text-sm font-medium md:hidden">Settings</span>
          </NavLink>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-3 rounded-xl transition-all md:w-11 md:h-11 md:justify-center w-full px-4 py-3 md:px-0 md:py-0 md:gap-0 text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
          >
            {dark ? <IconSun /> : <IconMoon />}
            <span className="text-sm font-medium md:hidden">{dark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <NavLink
            to="/dashboard/profile"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl transition-all duration-200',
                'md:w-11 md:h-11 md:justify-center',
                'w-full px-4 py-3 gap-3 md:px-0 md:py-0 md:gap-0',
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
              )
            }
          >
            <IconProfile />
            <span className="text-sm font-medium md:hidden">Profile</span>
          </NavLink>

          {/* Customize button — desktop only */}
          {onUpdateSidebar && (
            <button
              onClick={() => setCustomizeOpen((v) => !v)}
              className={cn(
                'hidden md:flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 mt-1',
                customizeOpen
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
              )}
              title="Customize sidebar"
            >
              <IconCustomize />
            </button>
          )}
        </div>
      </aside>

      {/* Customization panel */}
      {customizeOpen && onUpdateSidebar && (
        <CustomizePanel
          items={defaultNavItems}
          order={currentOrder}
          hidden={currentHidden}
          onReorder={handleReorder}
          onToggle={handleToggle}
          onReset={handleReset}
          onClose={handleCloseCustomize}
          isMobile={isMobileView}
        />
      )}
    </>
  );
}
