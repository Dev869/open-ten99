import { NavLink, Link } from 'react-router-dom';
import { cn } from '../lib/utils';

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

/* ── Nav Config ────────────────────────────────────── */

const navItems = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/dashboard/work-items', label: 'Work Items', Icon: IconWorkItems },
  { to: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/dashboard/clients', label: 'Clients', Icon: IconClients },
  { to: '/dashboard/analytics', label: 'Analytics', Icon: IconAnalytics },
];

/* ── Component ─────────────────────────────────────── */

interface SidebarProps {
  pendingCount: number;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ pendingCount, isOpen, onClose }: SidebarProps) {
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
          'h-full z-50 flex flex-col bg-white border-r border-[#E5E5EA] flex-shrink-0',
          // Desktop: always visible, icon-only, static position
          'hidden md:flex w-[72px]',
          // Mobile: fixed drawer
          isOpen && '!flex fixed w-[280px] shadow-2xl animate-slide-in-right'
        )}
      >
        {/* Brand mark */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 md:justify-center">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 rounded-full bg-[#1A1A2E] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-[#1A1A2E] text-lg tracking-tight md:hidden">
              OpenChanges
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-3 md:items-center mt-2">
          {navItems.map((item) => (
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
                    ? 'bg-[#4BA8A8]/10 text-[#4BA8A8]'
                    : 'text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1A1A2E]'
                )
              }
            >
              <div className="relative flex-shrink-0">
                <item.Icon />
                {item.to === '/dashboard' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#4BA8A8] rounded-full border-2 border-white" />
                )}
              </div>
              <span className="text-sm font-medium md:hidden">{item.label}</span>
              {item.to === '/dashboard' && pendingCount > 0 && (
                <span className="ml-auto md:hidden bg-[#4BA8A8] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
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
                  ? 'bg-[#4BA8A8]/10 text-[#4BA8A8]'
                  : 'text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1A1A2E]'
              )
            }
          >
            <IconSettings />
            <span className="text-sm font-medium md:hidden">Settings</span>
          </NavLink>
          <NavLink
            to="/dashboard/profile"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl transition-all duration-200',
                'md:w-11 md:h-11 md:justify-center',
                'w-full px-4 py-3 gap-3 md:px-0 md:py-0 md:gap-0',
                isActive
                  ? 'bg-[#4BA8A8]/10 text-[#4BA8A8]'
                  : 'text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1A1A2E]'
              )
            }
          >
            <IconProfile />
            <span className="text-sm font-medium md:hidden">Profile</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
