import { useState, useCallback } from 'react';
import { IconSettings, IconClose, IconChevronUp, IconChevronDown, IconEye, IconEyeOff } from '../icons/Icons';

/* ── Widget definitions ────────────────────────────── */

export interface WidgetDef {
  id: string;
  label: string;
  description: string;
}

export const DASHBOARD_WIDGETS: WidgetDef[] = [
  { id: 'quick-actions', label: 'Quick Actions', description: 'Invoice, receipt, client, trip' },
  { id: 'stat-cards', label: 'Stat Cards', description: 'Hours, revenue, pending, clients' },
  { id: 'work-time', label: 'Work Time', description: 'Tracked hours with billable breakdown' },
  { id: 'weekly-hours', label: 'Weekly Hours', description: 'Area chart of daily hours' },
  { id: 'info-grid', label: 'Info Grid', description: 'Clients, pipeline, invoices, upcoming' },
  { id: 'revenue-chart', label: 'Revenue Chart', description: '6-month revenue trend' },
  { id: 'needs-attention', label: 'Needs Attention', description: 'Pending work orders' },
  { id: 'recent-completed', label: 'Recently Completed', description: 'Approved/completed items' },
];

const DEFAULT_ORDER = DASHBOARD_WIDGETS.map((w) => w.id);
const STORAGE_KEY = 'oc-dashboard-widgets';

/* ── Persistence helpers ───────────────────────────── */

interface WidgetConfig {
  order: string[];
  hidden: string[];
}

export function loadWidgetConfig(): WidgetConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WidgetConfig;
      // Ensure new widgets are included
      const knownIds = new Set(DEFAULT_ORDER);
      const storedIds = new Set(parsed.order);
      const missing = DEFAULT_ORDER.filter((id) => !storedIds.has(id));
      return {
        order: [...parsed.order.filter((id) => knownIds.has(id)), ...missing],
        hidden: parsed.hidden.filter((id) => knownIds.has(id)),
      };
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_ORDER, hidden: [] };
}

function saveWidgetConfig(config: WidgetConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ── Hook ──────────────────────────────────────────── */

export function useDashboardWidgets() {
  const [config, setConfig] = useState<WidgetConfig>(loadWidgetConfig);

  const updateConfig = useCallback((next: WidgetConfig) => {
    setConfig(next);
    saveWidgetConfig(next);
  }, []);

  const isVisible = useCallback(
    (id: string) => !config.hidden.includes(id),
    [config.hidden]
  );

  const toggleWidget = useCallback(
    (id: string) => {
      const next = config.hidden.includes(id)
        ? { ...config, hidden: config.hidden.filter((h) => h !== id) }
        : { ...config, hidden: [...config.hidden, id] };
      updateConfig(next);
    },
    [config, updateConfig]
  );

  const moveWidget = useCallback(
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
    updateConfig({ order: DEFAULT_ORDER, hidden: [] });
  }, [updateConfig]);

  return { config, isVisible, toggleWidget, moveWidget, resetToDefault };
}

/* ── Configurator Panel ────────────────────────────── */

interface WidgetConfiguratorProps {
  config: WidgetConfig;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onReset: () => void;
  onClose: () => void;
}

export function WidgetConfigurator({
  config,
  onToggle,
  onMove,
  onReset,
  onClose,
}: WidgetConfiguratorProps) {
  const widgetMap = Object.fromEntries(DASHBOARD_WIDGETS.map((w) => [w.id, w]));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
              Customize Dashboard
            </h2>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              Toggle and reorder widgets
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] transition-colors"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Widget list */}
        <div className="p-3 max-h-[60vh] overflow-y-auto">
          {config.order.map((id, idx) => {
            const widget = widgetMap[id];
            if (!widget) return null;
            const visible = !config.hidden.includes(id);

            return (
              <div
                key={id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  visible ? 'bg-transparent' : 'bg-[var(--bg-input)]/50 opacity-60'
                }`}
              >
                {/* Visibility toggle */}
                <button
                  onClick={() => onToggle(id)}
                  className="p-1 rounded hover:bg-[var(--bg-input)] transition-colors flex-shrink-0"
                  title={visible ? 'Hide widget' : 'Show widget'}
                >
                  {visible ? (
                    <IconEye size={14} color="var(--accent)" />
                  ) : (
                    <IconEyeOff size={14} color="var(--text-secondary)" />
                  )}
                </button>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{widget.label}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">{widget.description}</div>
                </div>

                {/* Reorder buttons */}
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

/* ── Trigger Button ────────────────────────────────── */

interface WidgetSettingsButtonProps {
  onClick: () => void;
}

export function WidgetSettingsButton({ onClick }: WidgetSettingsButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-xl hover:bg-[var(--bg-input)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      title="Customize dashboard"
    >
      <IconSettings size={20} />
    </button>
  );
}
