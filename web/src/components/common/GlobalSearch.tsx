import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkItem, Client } from '../../lib/types';
import { WORK_ITEM_TYPE_LABELS, WORK_ITEM_STATUS_LABELS } from '../../lib/types';
import { IconSearch, IconDocument, IconUser } from '../icons';

interface GlobalSearchProps {
  workItems: WorkItem[];
  clients: Client[];
  onClose: () => void;
}

interface SearchResult {
  id: string;
  type: 'workItem' | 'client';
  title: string;
  subtitle: string;
  route: string;
}

const MAX_RESULTS_PER_CATEGORY = 5;

export function GlobalSearch({ workItems, clients, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Build a client name lookup map
  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      if (c.id) map.set(c.id, c.name);
    }
    return map;
  }, [clients]);

  // Filter and group results
  const { workItemResults, clientResults, allResults } = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { workItemResults: [], clientResults: [], allResults: [] };

    const workItemResults: SearchResult[] = workItems
      .filter((item) => {
        const clientName = item.clientId ? (clientMap.get(item.clientId) ?? '') : '';
        return (
          item.subject.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q)
        );
      })
      .slice(0, MAX_RESULTS_PER_CATEGORY)
      .map((item) => ({
        id: item.id!,
        type: 'workItem' as const,
        title: item.subject,
        subtitle: [
          WORK_ITEM_TYPE_LABELS[item.type],
          WORK_ITEM_STATUS_LABELS[item.status],
          clientMap.get(item.clientId),
        ]
          .filter(Boolean)
          .join(' · '),
        route: `/dashboard/work-items/${item.id}`,
      }));

    const clientResults: SearchResult[] = clients
      .filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, MAX_RESULTS_PER_CATEGORY)
      .map((c) => ({
        id: c.id!,
        type: 'client' as const,
        title: c.name,
        subtitle: [c.company, c.email].filter(Boolean).join(' · '),
        route: `/dashboard/clients/${c.id}`,
      }));

    return {
      workItemResults,
      clientResults,
      allResults: [...workItemResults, ...clientResults],
    };
  }, [query, workItems, clients, clientMap]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length, query]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Navigate to selected result
  const goToResult = useCallback(
    (result: SearchResult) => {
      navigate(result.route);
      onClose();
    },
    [navigate, onClose]
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && allResults.length > 0) {
        e.preventDefault();
        goToResult(allResults[selectedIndex]);
        return;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allResults, selectedIndex, goToResult, onClose]);

  // Scroll selected result into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll('[data-result-index]');
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Track the flat index for keyboard selection
  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] sm:pt-[15vh] px-3 sm:px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative max-w-lg w-full bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          {/* Magnifying glass icon */}
          <IconSearch size={18} color="var(--text-secondary)" className="flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work orders, clients..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-base placeholder:text-[var(--text-secondary)] outline-none"
          />
          {/* Keyboard shortcut badge */}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border)] rounded-md">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </div>

        {/* Results area */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto py-2">
          {/* Empty state */}
          {query.trim() === '' && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              Start typing to search...
            </div>
          )}

          {/* No results */}
          {query.trim() !== '' && allResults.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No matches found
            </div>
          )}

          {/* Work Items category */}
          {workItemResults.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider px-4 py-2">
                Work Orders
              </div>
              {workItemResults.map((result) => {
                flatIndex++;
                const idx = flatIndex;
                return (
                  <div
                    key={result.id}
                    data-result-index={idx}
                    onClick={() => goToResult(result)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer min-h-[44px] mx-2 transition-colors ${
                      selectedIndex === idx
                        ? 'bg-[var(--bg-input)]'
                        : 'hover:bg-[var(--bg-input)]'
                    }`}
                  >
                    {/* Work item icon */}
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <IconDocument size={16} color="var(--accent)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {result.title}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {result.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Clients category */}
          {clientResults.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider px-4 py-2">
                Clients
              </div>
              {clientResults.map((result) => {
                flatIndex++;
                const idx = flatIndex;
                return (
                  <div
                    key={result.id}
                    data-result-index={idx}
                    onClick={() => goToResult(result)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer min-h-[44px] mx-2 transition-colors ${
                      selectedIndex === idx
                        ? 'bg-[var(--bg-input)]'
                        : 'hover:bg-[var(--bg-input)]'
                    }`}
                  >
                    {/* Client icon */}
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <IconUser size={16} color="var(--accent)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {result.title}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {result.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {allResults.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[var(--bg-input)] border border-[var(--border)] rounded text-[9px]">&#8593;&#8595;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[var(--bg-input)] border border-[var(--border)] rounded text-[9px]">&#9166;</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[var(--bg-input)] border border-[var(--border)] rounded text-[9px]">esc</kbd>
              close
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
