import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
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
  IconSettings,
  IconUser,
  IconClose,
  IconSearch,
  IconAlert,
  IconLightbulb,
} from '../icons';

interface DrawerItem {
  to: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
  exact?: boolean;
}

interface DrawerSection {
  title: string;
  items: DrawerItem[];
}

const sections: DrawerSection[] = [
  {
    title: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard, exact: true },
      { to: '/dashboard/work-items', label: 'Work Orders', Icon: IconWrench },
      { to: '/dashboard/quotes', label: 'Quotes', Icon: IconDocument },
      { to: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar },
      { to: '/dashboard/clients', label: 'Clients', Icon: IconClients },
      { to: '/dashboard/apps', label: 'Apps', Icon: IconApps },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/dashboard/invoices', label: 'Invoices', Icon: IconDollar },
      { to: '/dashboard/finance', label: 'Finance', Icon: IconAnalytics },
    ],
  },
  {
    title: 'Team & Security',
    items: [
      { to: '/dashboard/team', label: 'Team', Icon: IconTeam },
      { to: '/dashboard/vault', label: 'Vault', Icon: IconLock },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/dashboard/profile', label: 'Profile', Icon: IconUser },
      { to: '/dashboard/settings', label: 'Settings', Icon: IconSettings },
    ],
  },
];

const SHORTCUT_HINT = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
  ? '⌘K'
  : 'Ctrl+K';

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
}

/**
 * GitHub-style slide-from-left navigation drawer.
 * Deep-black panel with grouped navigation, overlays content with a scrim.
 */
export function SideDrawer({ open, onClose, onOpenSearch }: SideDrawerProps) {
  // Render for transition (stays mounted briefly while closing)
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label="Main navigation"
    >
      {/* Scrim */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Panel */}
      <aside
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[300px] max-w-[85vw]',
          'bg-[#010409] text-[#f0f6fc] border-r border-[#21262d]',
          'flex flex-col shadow-2xl',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#21262d] flex-shrink-0">
          <span className="font-semibold text-[15px] tracking-tight text-[#f0f6fc]">
            Ten99
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#9198a1] hover:bg-[#21262d] hover:text-[#f0f6fc] transition-colors cursor-pointer"
            aria-label="Close navigation"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Search shortcut (like GitHub's "Type / to search") */}
        {onOpenSearch && (
          <div className="px-3 pt-3 flex-shrink-0">
            <button
              onClick={() => {
                onClose();
                onOpenSearch();
              }}
              className="w-full h-8 inline-flex items-center gap-2 px-3 rounded-md bg-[#0d1117] border border-[#3d444d] text-sm text-[#9198a1] hover:bg-[#151b23] hover:border-[#656c76] transition-colors cursor-pointer text-left"
            >
              <IconSearch size={14} />
              <span className="flex-1">Search</span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#151b23] border border-[#3d444d]">
                {SHORTCUT_HINT}
              </span>
            </button>
          </div>
        )}

        {/* Nav sections */}
        <nav className="flex-1 min-h-0 overflow-y-auto py-3">
          {sections.map((section, si) => (
            <div key={section.title} className={cn('px-3', si > 0 && 'mt-4')}>
              <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#656c76]">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 h-9 px-2 rounded-md text-sm transition-colors',
                          isActive
                            ? 'bg-[#21262d] text-[#f0f6fc] font-semibold'
                            : 'text-[#9198a1] hover:bg-[#151b23] hover:text-[#f0f6fc] font-medium'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-[#fd8c73]" />
                          )}
                          <span
                            className={cn(
                              'flex-shrink-0 inline-flex',
                              isActive ? 'text-[#f0f6fc]' : 'text-[#9198a1] group-hover:text-[#f0f6fc]'
                            )}
                          >
                            <item.Icon size={16} />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer links — Help */}
        <div className="border-t border-[#21262d] px-3 py-3 flex-shrink-0">
          <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#656c76]">
            Help
          </div>
          <ul className="space-y-0.5">
            <li>
              <a
                href="https://github.com/open-ten99/open-ten99/issues/new?labels=bug"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center gap-3 h-9 px-2 rounded-md text-sm text-[#9198a1] hover:bg-[#151b23] hover:text-[#f0f6fc] transition-colors"
              >
                <IconAlert size={16} />
                <span>Report a bug</span>
              </a>
            </li>
            <li>
              <a
                href="https://github.com/open-ten99/open-ten99/issues/new?labels=enhancement"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center gap-3 h-9 px-2 rounded-md text-sm text-[#9198a1] hover:bg-[#151b23] hover:text-[#f0f6fc] transition-colors"
              >
                <IconLightbulb size={16} />
                <span>Request a feature</span>
              </a>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
