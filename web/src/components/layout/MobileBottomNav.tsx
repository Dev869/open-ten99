import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  IconDashboard,
  IconWrench,
  IconCalendar,
  IconClients,
  IconMore,
  IconApps,
  IconTeam,
  IconLock,
  IconSettings,
  IconUser,
  IconSun,
  IconMoon,
  IconClose,
  IconChevronRight,
  IconDollar,
  IconDocument,
  IconBook,
  IconRepeat,
  IconGear,
  IconFinanceOverview,
  IconClock,
  IconCamera,
} from '../icons';
import type { IconProps } from '../icons';

/* ── Tab definitions ──────────────────────────────────── */

interface TabItem {
  to: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
}

const primaryTabs: TabItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/dashboard/work-items', label: 'Work Orders', Icon: IconWrench },
  { to: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/dashboard/clients', label: 'Clients', Icon: IconClients },
];

interface MenuSection {
  title: string;
  items: TabItem[];
}

const menuSections: MenuSection[] = [
  {
    title: 'Work',
    items: [
      { to: '/dashboard/work-items', label: 'Work Orders', Icon: IconWrench },
      { to: '/dashboard/clients', label: 'Clients', Icon: IconClients },
      { to: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar },
      { to: '/dashboard/team', label: 'Team', Icon: IconTeam },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/dashboard/finance', label: 'Overview', Icon: IconFinanceOverview },
      { to: '/dashboard/finance/invoices', label: 'Invoices', Icon: IconDollar },
      { to: '/dashboard/finance/expenses', label: 'Expenses', Icon: IconBook },
      { to: '/dashboard/finance/receipts', label: 'Receipts', Icon: IconCamera },
      { to: '/dashboard/finance/transactions', label: 'Transactions', Icon: IconRepeat },
      { to: '/dashboard/finance/reports', label: 'Reports', Icon: IconDocument },
      { to: '/dashboard/finance/accounts', label: 'Accounts', Icon: IconGear },
      { to: '/dashboard/finance/mileage', label: 'Mileage', Icon: IconClock },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/dashboard/apps', label: 'Apps', Icon: IconApps },
      { to: '/dashboard/vault', label: 'Vault', Icon: IconLock },
      { to: '/dashboard/settings', label: 'Settings', Icon: IconSettings },
      { to: '/dashboard/profile', label: 'Profile', Icon: IconUser },
    ],
  },
];

/* ── Full-page Menu ──────────────────────────────────── */

interface MorePageProps {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  onToggleTheme: () => void;
}

function MorePage({ open, onClose, dark, onToggleTheme }: MorePageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [slidingOut, setSlidingOut] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Prevent body scroll when menu is visible (but not while sliding out)
  useEffect(() => {
    if (open && !slidingOut) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, slidingOut]);

  function handleNav(to: string) {
    // Navigate first so the new page renders behind the menu
    navigate(to);
    // Wait one frame for React to paint the new page, then slide away
    requestAnimationFrame(() => {
      setSlidingOut(true);
      setTimeout(() => onClose(), 300);
    });
  }

  // After close, reset slidingOut so next open starts clean
  useEffect(() => {
    if (!open) setSlidingOut(false);
  }, [open]);

  if (!open && !slidingOut) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[70] bg-[var(--bg-page)] flex flex-col transition-transform duration-300 ease-out',
        slidingOut ? '-translate-x-full' : 'translate-x-0'
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header — matches mobile page title bar style */}
      <div className="flex items-center h-14 px-4 flex-shrink-0">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Menu</h1>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
        >
          <IconClose size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {menuSections.map((section) => (
          <div key={section.title}>
            {/* Section header */}
            <div className="bg-[var(--bg-input)] px-4 py-2.5">
              <h2 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
                {section.title}
              </h2>
            </div>

            {/* Section items */}
            <div>
              {section.items.map((item) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                return (
                  <button
                    key={item.to}
                    onClick={() => handleNav(item.to)}
                    className={cn(
                      'flex items-center gap-4 w-full px-4 py-3.5 border-b border-[var(--border)]/30 active:bg-[var(--bg-input)] transition-colors text-left',
                      isActive && 'text-[var(--accent)]'
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      isActive ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-input)]'
                    )}>
                      <item.Icon size={20} color={isActive ? 'var(--accent)' : 'var(--text-secondary)'} />
                    </div>
                    <span className="flex-1 text-sm font-semibold text-[var(--text-primary)]">
                      {item.label}
                    </span>
                    <IconChevronRight size={14} color="var(--text-secondary)" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Theme toggle */}
        <div className="px-4 mt-4">
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0">
              {dark ? <IconSun size={20} /> : <IconMoon size={20} />}
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)] flex-1 text-left">
              {dark ? 'Light Mode' : 'Dark Mode'}
            </span>
            <IconChevronRight size={14} color="var(--text-secondary)" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bottom Tab Bar ───────────────────────────────────── */

interface MobileBottomNavProps {
  dark: boolean;
  onToggleTheme: () => void;
}

export function MobileBottomNav({ dark, onToggleTheme }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleCloseMore = useCallback(() => setMoreOpen(false), []);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-card)] border-t border-[var(--border)] flex items-center justify-around md:hidden"
        style={{
          minHeight: '56px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {primaryTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center flex-1 py-3 rounded-lg transition-colors active:bg-[var(--bg-input)]',
                isActive
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-secondary)]'
              )
            }
          >
            <tab.Icon size={24} />
          </NavLink>
        ))}

        {/* More tab */}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex items-center justify-center flex-1 py-3 rounded-lg transition-colors active:bg-[var(--bg-input)]',
            moreOpen
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-secondary)]'
          )}
        >
          <IconMore size={24} />
        </button>
      </nav>

      <MorePage
        open={moreOpen}
        onClose={handleCloseMore}
        dark={dark}
        onToggleTheme={onToggleTheme}
      />
    </>
  );
}
