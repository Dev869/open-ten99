import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  type IconProps,
  IconSun, IconMoon,
  IconDashboard, IconDocument, IconCalendar, IconClients, IconTeam, IconAnalytics, IconApps,
  IconSettings, IconUser, IconLock, IconBell, IconGear, IconDollar, IconRepeat,
  IconChevronUp, IconChevronDown, IconChevronRight, IconClose, IconLayers,
} from './icons';

/* ── Nav Config ────────────────────────────────────── */

interface NavItem {
  to: string;
  key: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
  children?: NavItem[];
}

const defaultNavItems: NavItem[] = [
  { to: '/dashboard', key: 'dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/dashboard/work-items', key: 'work-items', label: 'Work Items', Icon: IconDocument },
  { to: '/dashboard/calendar', key: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/dashboard/clients', key: 'clients', label: 'Clients', Icon: IconClients },
  { to: '/dashboard/apps', key: 'apps', label: 'Apps', Icon: IconApps },
  {
    to: '/dashboard/finance',
    key: 'finance',
    label: 'Finance',
    Icon: IconAnalytics,
    children: [
      { to: '/dashboard/finance', key: 'finance-overview', label: 'Overview', Icon: IconDashboard },
      { to: '/dashboard/finance/invoices', key: 'finance-invoices', label: 'Invoices', Icon: IconDollar },
      { to: '/dashboard/finance/transactions', key: 'finance-transactions', label: 'Transactions', Icon: IconRepeat },
      { to: '/dashboard/finance/reports', key: 'finance-reports', label: 'Reports', Icon: IconDocument },
      { to: '/dashboard/finance/accounts', key: 'finance-accounts', label: 'Accounts', Icon: IconGear },
    ],
  },
  { key: 'team', to: '/dashboard/team', label: 'Team', Icon: IconTeam },
  { to: '/dashboard/vault', key: 'vault', label: 'Vault', Icon: IconLock },
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
  sidebarExpanded?: boolean;
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
  sidebarExpanded,
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
          <IconClose size={16} />
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
      className={cn(
        'fixed bottom-14 z-[60] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl p-4 w-[300px] animate-fade-in-up',
        sidebarExpanded ? 'left-[228px]' : 'left-[80px]'
      )}
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
  expanded: boolean;
  onToggleExpanded: () => void;
  notificationCount?: number;
  notificationBellRef?: React.RefObject<HTMLButtonElement | null>;
  onNotificationsClick?: () => void;
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
  expanded,
  onToggleExpanded,
  notificationCount = 0,
  notificationBellRef,
  onNotificationsClick,
}: SidebarProps) {
  const location = useLocation();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Track which nav groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    for (const item of defaultNavItems) {
      if (item.children?.some((child) => location.pathname.startsWith(child.to))) {
        expanded.add(item.key);
      }
    }
    return expanded;
  });

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Auto-expand group when navigating to a child route
  useEffect(() => {
    for (const item of defaultNavItems) {
      if (item.children?.some((child) => location.pathname.startsWith(child.to))) {
        setExpandedGroups((prev) => {
          if (prev.has(item.key)) return prev;
          const next = new Set(prev);
          next.add(item.key);
          return next;
        });
      }
    }
  }, [location.pathname]);

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
      // Migrate legacy 'analytics' key to 'finance'
      const migrated = sidebarOrder.map((k) => (k === 'analytics' ? 'finance' : k));
      // Make sure all default keys are included (in case new nav items were added)
      const orderSet = new Set(migrated);
      const extras = defaultOrder.filter((k) => !orderSet.has(k));
      return [...migrated, ...extras];
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
          'h-full z-50 flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex-shrink-0 transition-all duration-200',
          'hidden md:flex',
          expanded ? 'w-[220px]' : 'w-[72px]',
          isOpen && '!flex fixed w-[280px] shadow-2xl animate-slide-in-right'
        )}
      >
        {/* Brand mark */}
        <div className={cn('flex items-center h-16 flex-shrink-0 px-4', !expanded && 'md:justify-center')}>
          <Link to="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 shadow-md shadow-[var(--accent)]/20">
              <IconLayers size={24} />
            </div>
            <span className={cn(
              'font-bold text-[var(--text-primary)] text-xl tracking-tight',
              expanded ? '' : 'md:hidden'
            )} style={{ fontFamily: "'Space Mono', monospace" }}>
              TEN99
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 flex flex-col gap-1 px-3 mt-2', !expanded && 'md:items-center')}>
          {visibleNavItems.map((item) => {
            if (item.children) {
              const isGroupExpanded = expandedGroups.has(item.key);
              const isGroupActive = item.children.some((child) =>
                location.pathname.startsWith(child.to)
              );

              return (
                <div key={item.key}>
                  {/* Group header — collapsed sidebar navigates to first child */}
                  {!expanded ? (
                    <NavLink
                      to={item.children[0].to}
                      onClick={onClose}
                      className={cn(
                        'relative flex items-center rounded-xl transition-all duration-200',
                        'w-full px-4 py-3 gap-3',
                        'md:w-11 md:h-11 md:justify-center md:px-0 md:py-0 md:gap-0',
                        isGroupActive
                          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      <div className="flex-shrink-0">
                        <item.Icon />
                      </div>
                      <span className="text-sm font-medium md:hidden">{item.label}</span>
                    </NavLink>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.key)}
                      className={cn(
                        'relative flex items-center rounded-xl transition-all duration-200',
                        'w-full px-4 py-3 gap-3 md:px-3 md:py-2.5',
                        isGroupActive
                          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      <div className="flex-shrink-0">
                        <item.Icon />
                      </div>
                      <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                      <span className="flex-shrink-0 transition-transform duration-200 inline-flex">
                        {isGroupExpanded ? (
                          <IconChevronDown size={14} />
                        ) : (
                          <IconChevronRight size={14} />
                        )}
                      </span>
                    </button>
                  )}

                  {/* Children — only shown when sidebar is expanded and group is open */}
                  {expanded && isGroupExpanded && (
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.to === '/dashboard/finance'}
                          onClick={onClose}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center rounded-xl transition-all duration-200',
                              'w-full pl-10 pr-3 py-2 gap-3',
                              isActive
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                            )
                          }
                        >
                          <div className="flex-shrink-0">
                            <child.Icon size={18} />
                          </div>
                          <span className="text-sm font-medium">{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center rounded-xl transition-all duration-200',
                    // Mobile: always full width with label
                    'w-full px-4 py-3 gap-3',
                    // Desktop collapsed: icon only, centered
                    !expanded && 'md:w-11 md:h-11 md:justify-center md:px-0 md:py-0 md:gap-0',
                    // Desktop expanded: full width with label
                    expanded && 'md:w-full md:px-3 md:py-2.5 md:justify-start md:gap-3',
                    isActive
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                  )
                }
              >
                <div className="relative flex-shrink-0">
                  <item.Icon />
                  {item.to === '/dashboard' && pendingCount > 0 && !expanded && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--accent)] rounded-full border-2 border-[var(--bg-sidebar)] hidden md:block" />
                  )}
                </div>
                <span className="text-sm font-medium md:hidden">{item.label}</span>
                {expanded && <span className="text-sm font-medium hidden md:inline">{item.label}</span>}
                {item.to === '/dashboard' && pendingCount > 0 && (
                  <span className={cn(
                    'ml-auto bg-[var(--accent)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full',
                    expanded ? '' : 'md:hidden'
                  )}>
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={cn('flex flex-col gap-1 px-3 pb-5', !expanded && 'md:items-center')}>
          <NavLink
            to="/dashboard/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl transition-all duration-200',
                'w-full px-4 py-3 gap-3',
                !expanded && 'md:w-11 md:h-11 md:justify-center md:px-0 md:py-0 md:gap-0',
                expanded && 'md:w-full md:px-3 md:py-2.5 md:justify-start md:gap-3',
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
              )
            }
          >
            <IconSettings />
            <span className="text-sm font-medium md:hidden">Settings</span>
            {expanded && <span className="text-sm font-medium hidden md:inline">Settings</span>}
          </NavLink>
          <button
            onClick={onToggleTheme}
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              'w-full px-4 py-3 gap-3',
              !expanded && 'md:w-11 md:h-11 md:justify-center md:px-0 md:py-0 md:gap-0',
              expanded && 'md:w-full md:px-3 md:py-2.5 md:justify-start md:gap-3',
              'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
            )}
          >
            {dark ? <IconSun /> : <IconMoon />}
            <span className="text-sm font-medium md:hidden">{dark ? 'Light Mode' : 'Dark Mode'}</span>
            {expanded && <span className="text-sm font-medium hidden md:inline">{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          {onNotificationsClick && (
            <button
              ref={notificationBellRef}
              onClick={onNotificationsClick}
              className={cn(
                'relative flex items-center rounded-xl transition-all duration-200',
                'w-full px-4 py-3 gap-3',
                !expanded && 'md:w-11 md:h-11 md:justify-center md:px-0 md:py-0 md:gap-0',
                expanded && 'md:w-full md:px-3 md:py-2.5 md:justify-start md:gap-3',
                'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
              )}
              title="Notifications"
            >
              <div className="relative flex-shrink-0">
                <IconBell />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--bg-sidebar)]" />
                )}
              </div>
              <span className="text-sm font-medium md:hidden">Notifications</span>
              {expanded && <span className="text-sm font-medium hidden md:inline">Notifications</span>}
              {notificationCount > 0 && (
                <span className={cn(
                  'ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full',
                  expanded ? '' : 'md:hidden'
                )}>
                  {notificationCount}
                </span>
              )}
            </button>
          )}
          <NavLink
            to="/dashboard/profile"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl transition-all duration-200',
                'w-full px-4 py-3 gap-3',
                !expanded && 'md:w-11 md:h-11 md:justify-center md:px-0 md:py-0 md:gap-0',
                expanded && 'md:w-full md:px-3 md:py-2.5 md:justify-start md:gap-3',
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
              )
            }
          >
            <IconUser />
            <span className="text-sm font-medium md:hidden">Profile</span>
            {expanded && <span className="text-sm font-medium hidden md:inline">Profile</span>}
          </NavLink>

          {/* Customize button — desktop only */}
          {onUpdateSidebar && (
            <button
              onClick={() => setCustomizeOpen((v) => !v)}
              className={cn(
                'hidden md:flex items-center rounded-xl transition-all duration-200 mt-1',
                !expanded && 'w-11 h-11 justify-center',
                expanded && 'w-full px-3 py-2.5 justify-start gap-3',
                customizeOpen
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
              )}
              title="Customize sidebar"
            >
              <IconGear />
              {expanded && <span className="text-sm font-medium">Customize</span>}
            </button>
          )}

          {/* Expand toggle — collapsed state, desktop only */}
          {!expanded && (
            <button
              onClick={onToggleExpanded}
              className="hidden md:flex w-11 h-11 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-all duration-200 mt-1"
              title="Expand sidebar"
            >
              <IconChevronRight size={16} />
            </button>
          )}
        </div>

      </aside>

      {/* Collapse tab — fixed to sidebar edge, expanded state only, desktop only */}
      {expanded && !isOpen && (
        <button
          onClick={onToggleExpanded}
          className="fixed top-1/2 -translate-y-1/2 left-[210px] hidden md:flex items-center justify-center w-5 h-10 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:scale-110 shadow-sm transition-all duration-200 z-50"
          title="Collapse sidebar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

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
          sidebarExpanded={expanded}
        />
      )}
    </>
  );
}
