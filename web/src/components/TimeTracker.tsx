import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { IconPlay, IconPause, IconStop, IconClose } from './icons';
import type { Client } from '../lib/types';

interface TimeTrackerProps {
  clients: Client[];
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function TimeTracker({ clients }: TimeTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId);

  // Timer interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handlePlayPause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setElapsedSeconds(0);
  }, []);

  // Collapsed pill button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30',
          'flex items-center gap-2 min-h-[48px] px-5 rounded-full shadow-lg',
          'bg-[var(--accent)] text-white font-semibold text-sm',
          'hover-lift cursor-pointer transition-all duration-200',
          isRunning && 'animate-pulse'
        )}
      >
        {isRunning ? (
          <>
            <IconPause size={16} />
            <span className="font-mono text-xs">{formatTime(elapsedSeconds)}</span>
          </>
        ) : (
          <>
            <IconPlay size={16} />
            <span>Track</span>
          </>
        )}
      </button>
    );
  }

  // Expanded card
  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-30 sm:w-80',
        'bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-2xl',
        'animate-scale-in'
      )}
    >
      {/* Header with minimize button */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Time Tracker
        </span>
        <button
          onClick={() => setIsExpanded(false)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-input)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <IconClose size={14} />
        </button>
      </div>

      {/* Timer display */}
      <div className="px-5 py-4 text-center">
        <div
          className={cn(
            'text-3xl font-bold text-[var(--text-primary)] font-mono tracking-wide transition-all duration-300',
            isRunning && 'text-[var(--accent)]'
          )}
          style={isRunning ? { textShadow: '0 0 20px rgba(75, 168, 168, 0.3)' } : undefined}
        >
          {formatTime(elapsedSeconds)}
        </div>
        <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
          {selectedClient
            ? `${selectedClient.name}${description ? ' \u2022 ' + description : ''}`
            : 'No task selected'}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-5 pb-4">
        <button
          onClick={handlePlayPause}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-md',
            isRunning
              ? 'bg-[var(--color-red)] hover:brightness-110 text-white'
              : 'bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white'
          )}
        >
          {isRunning ? (
            <IconPause size={18} />
          ) : (
            <IconPlay size={18} />
          )}
        </button>
        {(isRunning || elapsedSeconds > 0) && (
          <button
            onClick={handleStop}
            className="w-10 h-10 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--bg-input)] transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <IconStop size={16} />
          </button>
        )}
      </div>

      {/* Task selector (when stopped) */}
      {!isRunning && (
        <div className="border-t border-[var(--border)] px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}
