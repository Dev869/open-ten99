import { useRef, useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  type IconProps,
  IconDashboard,
  IconWrench,
  IconDocument,
  IconCalendar,
  IconClients,
  IconApps,
  IconDollar,
  IconAnalytics,
  IconTeam,
  IconLock,
  IconBell,
  IconSun,
  IconMoon,
  IconSettings,
  IconUser,
  IconMenu,
  IconSearch,
  IconAlert,
  IconLightbulb,
} from './icons';

interface TopNavItem {
  to: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
  /** If set, the tab is active when pathname starts with any of these prefixes. */
  match?: string[];
  /** Exact-only match for `to` (no startsWith). Used for root dashboard. */
  exact?: boolean;
}

const items: TopNavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard, exact: true },
  { to: '/dashboard/work-items', label: 'Work Orders', Icon: IconWrench },
  { to: '/dashboard/quotes', label: 'Quotes', Icon: IconDocument },
  { to: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/dashboard/clients', label: 'Clients', Icon: IconClients },
  { to: '/dashboard/apps', label: 'Apps', Icon: IconApps },
  { to: '/dashboard/invoices', label: 'Invoices', Icon: IconDollar, match: ['/dashboard/invoices', '/dashboard/finance/invoices'] },
  { to: '/dashboard/finance', label: 'Finance', Icon: IconAnalytics, match: ['/dashboard/finance'] },
  { to: '/dashboard/team', label: 'Team', Icon: IconTeam },
  { to: '/dashboard/vault', label: 'Vault', Icon: IconLock },
];

function isActive(pathname: string, item: TopNavItem): boolean {
  if (item.exact) return pathname === item.to;
  if (item.match) return item.match.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
  return pathname === item.to || pathname.startsWith(item.to + '/');
}

interface TopNavProps {
  dark: boolean;
  onToggleTheme: () => void;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  notificationBellRef?: React.RefObject<HTMLButtonElement | null>;
  onOpenSearch?: () => void;
}

const SHORTCUT_HINT = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
  ? '⌘K'
  : 'Ctrl+K';

/**
 * Sole desktop navigation surface: primary section tabs on the left,
 * utility cluster (notifications, theme, settings, profile) on the right.
 * Hidden on mobile — mobile uses the fixed header + bottom tab bar.
 */
export function TopNav({
  dark,
  onToggleTheme,
  notificationCount = 0,
  onNotificationsClick,
  notificationBellRef,
  onOpenSearch,
}: TopNavProps) {
  const location = useLocation();
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Overflow menu (three-line hamburger) state
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  // Close the menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const a = activeRef.current;
    if (a && typeof a.scrollIntoView === 'function') {
      a.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [location.pathname]);

  const utilityBtn =
    'relative w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors';

  return (
    <div className="hidden md:block border-b border-[var(--border)] bg-[var(--bg-page)] sticky top-0 z-20">
      <div className="flex items-center gap-2 px-4 lg:px-6">
        {/* Overflow menu — three-line hamburger on the far left */}
        <div className="relative flex-shrink-0">
          <button
            ref={menuButtonRef}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              utilityBtn,
              menuOpen && 'bg-[var(--bg-input)] text-[var(--text-primary)]'
            )}
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Menu"
          >
            <IconMenu size={18} />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute left-0 top-full mt-1 w-60 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-1.5 z-[60] animate-fade-in"
            >
              {onOpenSearch && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSearch();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
                >
                  <IconSearch size={16} />
                  <span className="flex-1 text-left">Search</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)]">
                    {SHORTCUT_HINT}
                  </span>
                </button>
              )}

              <div className="my-1 border-t border-[var(--border)]" />
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Help
              </div>
              <a
                role="menuitem"
                href="https://github.com/open-ten99/open-ten99/issues/new?labels=bug"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
              >
                <IconAlert size={16} />
                <span>Report a bug</span>
              </a>
              <a
                role="menuitem"
                href="https://github.com/open-ten99/open-ten99/issues/new?labels=enhancement"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
              >
                <IconLightbulb size={16} />
                <span>Request a feature</span>
              </a>
            </div>
          )}
        </div>

        {/* Section tabs — scrollable */}
        <div className="relative flex-1 min-w-0">
          {canScrollLeft && (
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--bg-page)] to-transparent" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-page)] to-transparent" />
          )}
          <div
            ref={listRef}
            className="flex items-center gap-1 overflow-x-auto scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
          >
            {items.map((item) => {
              const active = isActive(location.pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  ref={active ? activeRef : undefined}
                  end={item.exact}
                  className={cn(
                    'group relative flex items-center gap-2 px-3 py-3 text-sm whitespace-nowrap transition-colors',
                    active
                      ? 'text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex',
                      active
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                    )}
                  >
                    <item.Icon size={16} />
                  </span>
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      'absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-opacity',
                      active ? 'bg-[var(--accent)] opacity-100' : 'opacity-0'
                    )}
                  />
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Utility cluster */}
        <div className="flex items-center gap-1 flex-shrink-0 border-l border-[var(--border)] pl-2 ml-1">
          {onNotificationsClick && (
            <button
              ref={notificationBellRef}
              onClick={onNotificationsClick}
              className={utilityBtn}
              title="Notifications"
              aria-label="Notifications"
            >
              <IconBell size={18} />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 text-[10px] font-bold leading-[16px] text-white bg-red-500 rounded-full border border-[var(--bg-page)] text-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={onToggleTheme}
            className={utilityBtn}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <NavLink
            to="/dashboard/settings"
            className={({ isActive: a }) =>
              cn(
                utilityBtn,
                a && 'bg-[var(--accent)]/10 text-[var(--accent)] hover:text-[var(--accent)]'
              )
            }
            title="Settings"
            aria-label="Settings"
          >
            <IconSettings size={18} />
          </NavLink>
          <Link to="/dashboard/profile" className={utilityBtn} title="Profile" aria-label="Profile">
            <IconUser size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
