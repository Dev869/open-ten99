import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
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
          'fixed bottom-6 right-6 z-30',
          'flex items-center gap-2 min-h-[48px] px-5 rounded-full shadow-lg',
          'bg-[#4BA8A8] text-white font-semibold text-sm',
          'hover-lift cursor-pointer transition-all duration-200',
          isRunning && 'animate-pulse'
        )}
      >
        {isRunning ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
            <span className="font-mono text-xs">{formatTime(elapsedSeconds)}</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
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
        'fixed bottom-6 right-6 z-30 w-80',
        'bg-white rounded-2xl border border-[#E5E5EA] shadow-2xl',
        'animate-scale-in'
      )}
    >
      {/* Header with minimize button */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">
          Time Tracker
        </span>
        <button
          onClick={() => setIsExpanded(false)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F2F2F7] transition-colors text-[#86868B] hover:text-[#1A1A2E] cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Timer display */}
      <div className="px-5 py-4 text-center">
        <div
          className={cn(
            'text-3xl font-bold text-[#1A1A2E] font-mono tracking-wide transition-all duration-300',
            isRunning && 'text-[#4BA8A8]'
          )}
          style={isRunning ? { textShadow: '0 0 20px rgba(75, 168, 168, 0.3)' } : undefined}
        >
          {formatTime(elapsedSeconds)}
        </div>
        <div className="mt-1.5 text-xs text-[#86868B]">
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
              ? 'bg-[#E84855] hover:bg-[#D43D4A] text-white'
              : 'bg-[#4BA8A8] hover:bg-[#3D9494] text-white'
          )}
        >
          {isRunning ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>
        {(isRunning || elapsedSeconds > 0) && (
          <button
            onClick={handleStop}
            className="w-10 h-10 rounded-full border border-[#E5E5EA] flex items-center justify-center hover:bg-[#F2F2F7] transition-colors cursor-pointer text-[#86868B] hover:text-[#1A1A2E]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
      </div>

      {/* Task selector (when stopped) */}
      {!isRunning && (
        <div className="border-t border-[#E5E5EA] px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] text-sm text-[#1A1A2E] outline-none focus:border-[#4BA8A8] focus:ring-1 focus:ring-[#4BA8A8]/20 transition-colors"
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
            <label className="block text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              className="w-full h-9 px-3 rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] text-sm text-[#1A1A2E] placeholder:text-[#C7C7CC] outline-none focus:border-[#4BA8A8] focus:ring-1 focus:ring-[#4BA8A8]/20 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}
