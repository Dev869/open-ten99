import { useState, useCallback } from 'react';
import {
  IconDocument,
  IconClients,
  IconCalendar,
  IconDollar,
  IconBook,
  IconLock,
  IconSettings,
  IconFinanceOverview,
  IconWrench,
  IconApps,
  IconRepeat,
  IconTeam,
  IconGear,
  IconClose,
  IconChevronUp,
  IconChevronDown,
  IconEye,
  IconEyeOff,
} from '../icons/Icons';
import type { IconProps } from '../icons/Icons';

/* ── All available shortcuts ───────────────────────── */

export interface ShortcutDef {
  id: string;
  to: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
}

export const ALL_SHORTCUTS: ShortcutDef[] = [
  { id: 'work-items', to: '/dashboard/work-items', label: 'Work Orders', Icon: IconWrench },
  { id: 'clients', to: '/dashboard/clients', label: 'Clients', Icon: IconClients },
  { id: 'calendar', to: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar },
  { id: 'invoices', to: '/dashboard/finance/invoices', label: 'Invoices', Icon: IconDollar },
  { id: 'expenses', to: '/dashboard/finance/expenses', label: 'Expenses', Icon: IconBook },
  { id: 'receipts', to: '/dashboard/finance/receipts', label: 'Receipts', Icon: IconFinanceOverview },
  { id: 'vault', to: '/dashboard/vault', label: 'Vault', Icon: IconLock },
  { id: 'settings', to: '/dashboard/settings', label: 'Settings', Icon: IconSettings },
  { id: 'apps', to: '/dashboard/apps', label: 'Apps', Icon: IconApps },
  { id: 'finance', to: '/dashboard/finance', label: 'Finance', Icon: IconFinanceOverview },
  { id: 'transactions', to: '/dashboard/finance/transactions', label: 'Transactions', Icon: IconRepeat },
  { id: 'reports', to: '/dashboard/finance/reports', label: 'Reports', Icon: IconDocument },
  { id: 'accounts', to: '/dashboard/finance/accounts', label: 'Accounts', Icon: IconGear },
  { id: 'team', to: '/dashboard/team', label: 'Team', Icon: IconTeam },
];

const DEFAULT_VISIBLE = [
  'work-items', 'clients', 'calendar', 'invoices',
  'expenses', 'receipts', 'vault', 'settings',
];
const DEFAULT_ORDER = ALL_SHORTCUTS.map((s) => s.id);
const STORAGE_KEY = 'oc-mobile-shortcuts';

/* ── Persistence ───────────────────────────────────── */

export interface ShortcutConfig {
  order: string[];
  hidden: string[];
}

export function loadShortcutConfig(): ShortcutConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ShortcutConfig;
      const knownIds = new Set(DEFAULT_ORDER);
      const storedIds = new Set(parsed.order);
      const missing = DEFAULT_ORDER.filter((id) => !storedIds.has(id));
      return {
        order: [...parsed.order.filter((id) => knownIds.has(id)), ...missing],
        hidden: parsed.hidden.filter((id) => knownIds.has(id)),
      };
    }
  } catch { /* ignore */ }
  // Default: show the original 8, hide the rest
  const hidden = DEFAULT_ORDER.filter((id) => !DEFAULT_VISIBLE.includes(id));
  return { order: DEFAULT_ORDER, hidden };
}

function saveShortcutConfig(config: ShortcutConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ── Hook ──────────────────────────────────────────── */

export function useMobileShortcuts() {
  const [config, setConfig] = useState<ShortcutConfig>(loadShortcutConfig);

  const updateConfig = useCallback((next: ShortcutConfig) => {
    setConfig(next);
    saveShortcutConfig(next);
  }, []);

  const visibleShortcuts = config.order
    .filter((id) => !config.hidden.includes(id))
    .map((id) => ALL_SHORTCUTS.find((s) => s.id === id)!)
    .filter(Boolean);

  const isVisible = useCallback(
    (id: string) => !config.hidden.includes(id),
    [config.hidden]
  );

  const toggleShortcut = useCallback(
    (id: string) => {
      const next = config.hidden.includes(id)
        ? { ...config, hidden: config.hidden.filter((h) => h !== id) }
        : { ...config, hidden: [...config.hidden, id] };
      updateConfig(next);
    },
    [config, updateConfig]
  );

  const moveShortcut = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const idx = config.order.indexOf(id);
      if (idx < 0) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= config.order.length) return;
      const next = [...config.order];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      updateConfig({ ...config, order: next });
    },
    [config, updateConfig]
  );

  const resetToDefault = useCallback(() => {
    const hidden = DEFAULT_ORDER.filter((id) => !DEFAULT_VISIBLE.includes(id));
    updateConfig({ order: DEFAULT_ORDER, hidden });
  }, [updateConfig]);

  return { config, visibleShortcuts, isVisible, toggleShortcut, moveShortcut, resetToDefault };
}

/* ── Configurator Panel ────────────────────────────── */

interface ShortcutConfiguratorProps {
  config: ShortcutConfig;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onReset: () => void;
  onClose: () => void;
}

export function ShortcutConfigurator({
  config,
  onToggle,
  onMove,
  onReset,
  onClose,
}: ShortcutConfiguratorProps) {
  const shortcutMap = Object.fromEntries(ALL_SHORTCUTS.map((s) => [s.id, s]));
  const visibleCount = config.order.filter((id) => !config.hidden.includes(id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="relative bg-[var(--bg-card)] rounded-t-2xl border-t border-[var(--border)] shadow-2xl w-full max-w-lg animate-slide-up overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
              Edit Shortcuts
            </h2>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              {visibleCount} visible
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] transition-colors"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Shortcut list */}
        <div className="px-3 pb-2 max-h-[50vh] overflow-y-auto">
          {config.order.map((id, idx) => {
            const shortcut = shortcutMap[id];
            if (!shortcut) return null;
            const visible = !config.hidden.includes(id);

            return (
              <div
                key={id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  visible ? 'bg-transparent' : 'bg-[var(--bg-input)]/50 opacity-50'
                }`}
              >
                {/* Visibility toggle */}
                <button
                  onClick={() => onToggle(id)}
                  className="p-1 rounded hover:bg-[var(--bg-input)] transition-colors flex-shrink-0"
                >
                  {visible ? (
                    <IconEye size={14} color="var(--accent)" />
                  ) : (
                    <IconEyeOff size={14} color="var(--text-secondary)" />
                  )}
                </button>

                {/* Icon + Label */}
                <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                  <shortcut.Icon size={14} color={visible ? 'var(--accent)' : 'var(--text-secondary)'} />
                </div>
                <span className="flex-1 text-xs font-bold text-[var(--text-primary)] truncate">
                  {shortcut.label}
                </span>

                {/* Reorder */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => onMove(id, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-[var(--bg-input)] transition-colors disabled:opacity-20"
                  >
                    <IconChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => onMove(id, 'down')}
                    disabled={idx === config.order.length - 1}
                    className="p-0.5 rounded hover:bg-[var(--bg-input)] transition-colors disabled:opacity-20"
                  >
                    <IconChevronDown size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
          <button
            onClick={onReset}
            className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={onClose}
            className="text-xs font-bold text-white bg-[var(--accent)] px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
