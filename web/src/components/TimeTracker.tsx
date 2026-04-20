import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { IconPlay, IconPause, IconStop, IconClock, IconChevronDown, IconClose } from './icons';
import { createTimeEntry, updateTimeEntry } from '../services/firestore';
import type { Client, App } from '../lib/types';

/* ── Persistence ─────────────────────────────────────── */

const STORAGE_KEY = 'ten99.timer.v1';
const AUTOSAVE_INTERVAL_MS = 30_000;

interface PersistedTimer {
  isRunning: boolean;
  accumulatedSeconds: number;
  lastStartedAtMs: number | null;
  firstStartedAtMs: number | null;
  clientId: string;
  appId: string;
  description: string;
  isBillable: boolean;
  workItemId?: string;
  lineItemId?: string;
  activeEntryId?: string;
}

const EMPTY_STATE: PersistedTimer = {
  isRunning: false,
  accumulatedSeconds: 0,
  lastStartedAtMs: null,
  firstStartedAtMs: null,
  clientId: '',
  appId: '',
  description: '',
  isBillable: true,
};

function loadPersisted(): PersistedTimer {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedTimer>;
    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return EMPTY_STATE;
  }
}

function savePersisted(state: PersistedTimer) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota or private mode — ignore
  }
}

function clearPersisted() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function computeElapsed(state: PersistedTimer, nowMs: number): number {
  const live = state.isRunning && state.lastStartedAtMs
    ? Math.floor((nowMs - state.lastStartedAtMs) / 1000)
    : 0;
  return Math.max(0, Math.floor(state.accumulatedSeconds) + live);
}

/* ── Shared timer state ──────────────────────────────── */

interface TimeTrackerState {
  isRunning: boolean;
  elapsedSeconds: number;
  clientId: string;
  appId: string;
  description: string;
  selectedClient: Client | undefined;
  isOpen: boolean;
  isBillable: boolean;
  clients: Client[];
  apps: App[];
  workItemId?: string;
  lineItemId?: string;
  handlePlayPause: () => void;
  handleStop: () => void;
  setClientId: (id: string) => void;
  setAppId: (id: string) => void;
  setDescription: (desc: string) => void;
  setIsBillable: (v: boolean) => void;
  setWorkItemId: (id: string | undefined) => void;
  setLineItemId: (id: string | undefined) => void;
  toggleOpen: () => void;
}

const TimeTrackerContext = createContext<TimeTrackerState | null>(null);

export function useTimeTracker() {
  const ctx = useContext(TimeTrackerContext);
  if (!ctx) throw new Error('useTimeTracker must be used within TimeTrackerProvider');
  return ctx;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/* ── Provider ────────────────────────────────────────── */

interface TimeTrackerProviderProps {
  clients: Client[];
  apps: App[];
  children: ReactNode;
}

export function TimeTrackerProvider({ clients, apps, children }: TimeTrackerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [persisted, setPersisted] = useState<PersistedTimer>(() => loadPersisted());
  const [elapsedSeconds, setElapsedSeconds] = useState(() => computeElapsed(loadPersisted(), Date.now()));

  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;

  // Persist every state change to localStorage — survives reload & tab close
  useEffect(() => {
    savePersisted(persisted);
  }, [persisted]);

  // UI tick: recompute elapsed once per second while running
  useEffect(() => {
    if (!persisted.isRunning) return;
    const id = setInterval(() => {
      setElapsedSeconds(computeElapsed(persistedRef.current, Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [persisted.isRunning]);

  // Keep elapsed fresh when other state changes (e.g. resumed from storage)
  useEffect(() => {
    setElapsedSeconds(computeElapsed(persisted, Date.now()));
  }, [persisted]);

  const selectedClient = clients.find((c) => c.id === persisted.clientId);

  /* ── Auto-save to work order ─────────────────────────
     Creates a live TimeEntry once workItemId is set + timer has run,
     then updates durationSeconds/endedAt every AUTOSAVE_INTERVAL_MS
     and on beforeunload. Finalized on stop. */
  const autosaveInFlightRef = useRef(false);
  const autosave = useCallback(async (finalize = false) => {
    if (autosaveInFlightRef.current) return;
    const s = persistedRef.current;
    if (!s.workItemId || !s.clientId) return;
    const now = Date.now();
    const elapsed = computeElapsed(s, now);
    if (elapsed <= 0) return;

    autosaveInFlightRef.current = true;
    try {
      const startedAt = new Date(s.firstStartedAtMs ?? now - elapsed * 1000);
      const endedAt = new Date(now);

      if (!s.activeEntryId) {
        const id = await createTimeEntry({
          clientId: s.clientId,
          appId: s.appId || undefined,
          description: s.description,
          durationSeconds: elapsed,
          isBillable: s.isBillable,
          startedAt,
          endedAt,
          workItemId: s.workItemId,
          lineItemId: s.lineItemId || undefined,
        });
        setPersisted((prev) => ({ ...prev, activeEntryId: id }));
      } else {
        await updateTimeEntry(s.activeEntryId, {
          description: s.description,
          durationSeconds: elapsed,
          isBillable: s.isBillable,
          appId: s.appId || undefined,
          endedAt,
          ...(finalize ? { workItemId: s.workItemId, lineItemId: s.lineItemId || undefined } : {}),
        });
      }
    } catch (err) {
      console.error('time tracker autosave failed:', err);
    } finally {
      autosaveInFlightRef.current = false;
    }
  }, []);

  // Periodic autosave while running and attached to a work order
  useEffect(() => {
    if (!persisted.isRunning || !persisted.workItemId) return;
    const id = setInterval(() => { void autosave(); }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [persisted.isRunning, persisted.workItemId, autosave]);

  // Flush on tab hide / page unload so close-without-stop still persists progress
  useEffect(() => {
    const flush = () => { void autosave(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autosave]);

  const handlePlayPause = useCallback(() => {
    setPersisted((prev) => {
      const now = Date.now();
      if (prev.isRunning && prev.lastStartedAtMs) {
        // Pause: fold elapsed into accumulated
        const delta = Math.floor((now - prev.lastStartedAtMs) / 1000);
        return {
          ...prev,
          isRunning: false,
          accumulatedSeconds: prev.accumulatedSeconds + delta,
          lastStartedAtMs: null,
        };
      }
      // Play / resume
      return {
        ...prev,
        isRunning: true,
        lastStartedAtMs: now,
        firstStartedAtMs: prev.firstStartedAtMs ?? now,
      };
    });
  }, []);

  const handleStop = useCallback(() => {
    // Flush final update, then clear everything
    void (async () => {
      try {
        await autosave(true);
      } finally {
        setPersisted(EMPTY_STATE);
        clearPersisted();
        setElapsedSeconds(0);
        setIsOpen(false);
      }
    })();
  }, [autosave]);

  const setClientId = useCallback((id: string) => {
    setPersisted((prev) => ({
      ...prev,
      clientId: id,
      appId: '',
      workItemId: undefined,
      lineItemId: undefined,
      activeEntryId: undefined,
    }));
  }, []);

  const setAppId = useCallback((id: string) => {
    setPersisted((prev) => ({ ...prev, appId: id }));
  }, []);

  const setDescription = useCallback((desc: string) => {
    setPersisted((prev) => ({ ...prev, description: desc }));
  }, []);

  const setIsBillable = useCallback((v: boolean) => {
    setPersisted((prev) => ({ ...prev, isBillable: v }));
  }, []);

  const setWorkItemId = useCallback((id: string | undefined) => {
    setPersisted((prev) =>
      prev.workItemId === id ? prev : { ...prev, workItemId: id, activeEntryId: undefined },
    );
  }, []);

  const setLineItemId = useCallback((id: string | undefined) => {
    setPersisted((prev) =>
      prev.lineItemId === id ? prev : { ...prev, lineItemId: id },
    );
  }, []);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const { isRunning, clientId, appId, description, isBillable, workItemId, lineItemId } = persisted;

  return (
    <TimeTrackerContext.Provider value={{
      isRunning, elapsedSeconds, clientId, appId, description, selectedClient,
      isOpen, isBillable, clients, apps, workItemId, lineItemId,
      handlePlayPause, handleStop, setClientId, setAppId, setDescription, setIsBillable,
      setWorkItemId, setLineItemId, toggleOpen,
    }}>
      {children}
    </TimeTrackerContext.Provider>
  );
}

/* ── Nav button (mobile header / sidebar) ────────────── */

export function TimeTrackerNavButton() {
  const { isRunning, elapsedSeconds, toggleOpen } = useTimeTracker();

  return (
    <button
      onClick={toggleOpen}
      className={cn(
        'relative p-2 rounded-lg transition-colors cursor-pointer',
        isRunning
          ? 'text-[var(--accent)]'
          : 'text-[var(--text-primary)] hover:bg-[var(--bg-input)]'
      )}
    >
      <IconClock size={24} />
      {isRunning && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        </span>
      )}
      {!isRunning && elapsedSeconds > 0 && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--color-orange)]" />
      )}
    </button>
  );
}

/* ── Status bar / floating card ─────────────────────── */

export function TimeTrackerBar() {
  const {
    isRunning, elapsedSeconds, clientId, appId, description, selectedClient,
    isOpen, isBillable, clients, apps, handlePlayPause, handleStop, setClientId, setAppId, setDescription, setIsBillable, toggleOpen,
  } = useTimeTracker();

  const isActive = isRunning || elapsedSeconds > 0;

  // Filter apps by selected client (if any)
  const filteredApps = clientId
    ? apps.filter((a) => a.clientId === clientId)
    : apps;

  const selectedApp = apps.find((a) => a.id === appId);

  // Desktop-only: floating trigger when nothing is happening
  if (!isActive && !isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className={cn(
          'hidden md:flex fixed bottom-6 right-6 z-30',
          'items-center gap-2 h-12 px-5 rounded-full shadow-lg',
          'bg-[var(--accent)] text-white font-semibold text-sm',
          'hover-lift cursor-pointer transition-all duration-200'
        )}
      >
        <IconClock size={16} />
        <span>Track Time</span>
      </button>
    );
  }

  // Active: accent-colored status bar that glides up under the navbar
  if (isActive) {
    return (
      <div className="animate-glide-up bg-[var(--accent)] text-white flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        {/* Main bar row — tappable to expand */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
          onClick={toggleOpen}
        >
          {/* Pulsing dot when running */}
          {isRunning && (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          )}

          {/* Timer */}
          <span
            className="text-sm font-bold font-mono tracking-wide flex-shrink-0"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
          >
            {formatTime(elapsedSeconds)}
          </span>

          {/* Divider */}
          <span className="w-px h-4 bg-white/30 flex-shrink-0" />

          {/* Context */}
          <span className="flex-1 min-w-0 text-xs text-white/80 truncate">
            {selectedClient
              ? `${selectedClient.name}${selectedApp ? ' · ' + selectedApp.name : ''}${description ? ' · ' + description : ''}`
              : 'No client selected'}
            {isBillable && (
              <span className="ml-1.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">$</span>
            )}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors cursor-pointer active:scale-95"
            >
              {isRunning ? <IconPause size={12} /> : <IconPlay size={12} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleStop(); }}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors cursor-pointer active:scale-95"
            >
              <IconStop size={10} />
            </button>
            {/* Expand chevron */}
            <span className={cn('transition-transform duration-200 ml-0.5', isOpen && 'rotate-180')}>
              <IconChevronDown size={14} />
            </span>
          </div>
        </div>

        {/* Expanded detail section */}
        {isOpen && (
          <div className="border-t border-white/20 px-4 py-3 space-y-2.5 bg-black/10 animate-fade-in">
            {/* Client */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/60 w-14 flex-shrink-0">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 h-8 px-2.5 rounded-lg bg-white/15 border border-white/20 text-sm text-white outline-none focus:bg-white/20 transition-colors cursor-pointer"
              >
                <option value="" className="text-[var(--text-primary)] bg-[var(--bg-card)]">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="text-[var(--text-primary)] bg-[var(--bg-card)]">{c.name}</option>
                ))}
              </select>
            </div>

            {/* App (optional) */}
            {filteredApps.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/60 w-14 flex-shrink-0">App</label>
                <select
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-8 px-2.5 rounded-lg bg-white/15 border border-white/20 text-sm text-white outline-none focus:bg-white/20 transition-colors cursor-pointer"
                >
                  <option value="" className="text-[var(--text-primary)] bg-[var(--bg-card)]">None</option>
                  {filteredApps.map((a) => (
                    <option key={a.id} value={a.id} className="text-[var(--text-primary)] bg-[var(--bg-card)]">{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Task */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/60 w-14 flex-shrink-0">Task</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="What are you working on?"
                className="flex-1 h-8 px-2.5 rounded-lg bg-white/15 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/20 transition-colors"
              />
            </div>

            {/* Billable toggle */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/60 w-14 flex-shrink-0">Billable</label>
              <button
                type="button"
                role="switch"
                aria-checked={isBillable}
                onClick={(e) => { e.stopPropagation(); setIsBillable(!isBillable); }}
                className={cn(
                  'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                  isBillable ? 'bg-white/40' : 'bg-white/15'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition duration-200',
                    isBillable ? 'translate-x-[18px]' : 'translate-x-0.5'
                  )}
                />
              </button>
              <span className="text-xs text-white/60">{isBillable ? 'Billable hours' : 'Non-billable'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not active, open: setup card (fixed overlay)
  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] md:hidden"
        onClick={toggleOpen}
      />

      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'md:left-auto md:right-6 md:bottom-6 md:w-80 md:rounded-2xl',
          'bg-[var(--bg-card)] border-t md:border border-[var(--border)] shadow-2xl',
          'animate-fade-in-up'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mobile drag indicator */}
        <button
          className="md:hidden flex justify-center w-full pt-2.5 pb-0.5 cursor-pointer"
          onClick={toggleOpen}
          aria-label="Collapse time tracker"
        >
          <div className="w-9 h-1 rounded-full bg-[var(--border)]" />
        </button>

        {/* Desktop close button */}
        <div className="hidden md:flex items-center justify-between px-4 pt-3 pb-0">
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Track Time</span>
          <button
            onClick={toggleOpen}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors cursor-pointer"
            aria-label="Close time tracker"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Setup form */}
        <div className="px-4 py-4 md:pt-2 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {/* App (optional) */}
          {filteredApps.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                App <span className="normal-case tracking-normal font-normal text-[var(--text-secondary)]">(optional)</span>
              </label>
              <select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors"
              >
                <option value="">None</option>
                {filteredApps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Task
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors"
            />
          </div>
          {/* Billable toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Billable Hours
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={isBillable}
              onClick={() => setIsBillable(!isBillable)}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                isBillable ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--bg-card)] shadow-sm transition duration-200',
                  isBillable ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
          <button
            onClick={handlePlayPause}
            className="w-full h-10 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <IconPlay size={14} />
            Start Timer
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Legacy default export (backward compat) ─────────── */

export function TimeTracker({ clients }: { clients: Client[] }) {
  return (
    <TimeTrackerProvider clients={clients} apps={[]}>
      <TimeTrackerBar />
    </TimeTrackerProvider>
  );
}
