import { useRef, useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  type IconProps,
  IconDashboard,
  IconWrench,
  IconClients,
  IconBell,
  IconSun,
  IconMoon,
  IconSettings,
  IconUser,
  IconMenu,
} from '../icons';
import { TimeTrackerNavPill } from '../time/TimeTracker';
import { SideDrawer } from './SideDrawer';

interface TopNavItem {
  to: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
  match?: string[];
  exact?: boolean;
}

// Pinned primary tabs shown inline in the TopNav. The rest live in the SideDrawer.
const pinnedItems: TopNavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard, exact: true },
  { to: '/dashboard/work-items', label: 'Work Orders', Icon: IconWrench },
  { to: '/dashboard/clients', label: 'Clients', Icon: IconClients },
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

/**
 * Desktop top bar — GitHub-style deep-black header with a hamburger that
 * opens the SideDrawer, a few pinned section tabs, the TimeTracker pill,
 * and the utility cluster. Hidden on mobile (mobile uses the fixed header
 * + bottom tab bar).
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Close the drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const a = activeRef.current;
    if (a && typeof a.scrollIntoView === 'function') {
      a.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [location.pathname]);

  const utilityBtn =
    'relative w-9 h-9 inline-flex items-center justify-center rounded-md text-[#9198a1] hover:bg-[#21262d] hover:text-[#f0f6fc] transition-colors cursor-pointer';

  return (
    <>
      <div className="hidden md:block border-b border-[#21262d] bg-[#010409] text-[#f0f6fc] sticky top-0 z-20">
        <div className="flex items-center gap-2 px-4 lg:px-6">
          {/* Hamburger — opens SideDrawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              utilityBtn,
              drawerOpen && 'bg-[#21262d] text-[#f0f6fc]'
            )}
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            title="Menu"
          >
            <IconMenu size={18} />
          </button>

          {/* Divider */}
          <span className="w-px h-5 bg-[#21262d] flex-shrink-0 mx-1" />

          {/* Pinned section tabs */}
          <div
            ref={listRef}
            className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
          >
            {pinnedItems.map((item) => {
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
                      ? 'text-[#f0f6fc] font-semibold'
                      : 'text-[#9198a1] hover:text-[#f0f6fc] font-medium'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex',
                      active ? 'text-[#f0f6fc]' : 'text-[#9198a1] group-hover:text-[#f0f6fc]'
                    )}
                  >
                    <item.Icon size={16} />
                  </span>
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      'absolute left-0 right-0 -bottom-px h-[2px] transition-opacity',
                      active ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{ background: '#fd8c73' }}
                  />
                </NavLink>
              );
            })}
          </div>

          {/* Utility cluster */}
          <div className="flex items-center gap-2 flex-shrink-0 border-l border-[#21262d] pl-3 ml-1">
            <TimeTrackerNavPill />
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
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 text-[10px] font-bold leading-[16px] text-white bg-red-500 rounded-full border border-[#010409] text-center">
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
                  a && 'bg-[#21262d] text-[#f0f6fc]'
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

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenSearch={onOpenSearch}
      />
    </>
  );
}
