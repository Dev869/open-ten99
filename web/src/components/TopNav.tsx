import { useRef, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

/**
 * Horizontal tab bar shown at the top of the contractor content area on
 * desktop. Complements the sidebar by giving an always-labeled, scan-able
 * view of the main sections — useful as the app has grown to ~10+ surfaces.
 * Hidden on mobile (mobile uses the bottom tab bar).
 */
export function TopNav() {
  const location = useLocation();
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  // Scroll the active tab into view on route change.
  useEffect(() => {
    const a = activeRef.current;
    if (a && typeof a.scrollIntoView === 'function') {
      a.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [location.pathname]);

  return (
    <div className="hidden md:block border-b border-[var(--border)] bg-[var(--bg-page)] sticky top-0 z-20">
      <div className="relative">
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--bg-page)] to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-page)] to-transparent" />
        )}
        <div
          ref={listRef}
          className="flex items-center gap-1 px-4 lg:px-6 overflow-x-auto scrollbar-none"
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
                <span className={cn('inline-flex', active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]')}>
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
    </div>
  );
}
