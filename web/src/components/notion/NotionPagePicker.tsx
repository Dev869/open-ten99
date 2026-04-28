import { useEffect, useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { callSearchNotionPages } from '../../services/firestore';
import { IconSearch, IconNotebook } from '../icons';
import { useToast } from '../../hooks/useToast';
import type { NotionPageRef } from '../../lib/types';

interface NotionPagePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (page: NotionPageRef) => void;
  title?: string;
  subtitle?: string;
}

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Sleek, full-text search picker over the connected Notion workspace.
 * Debounced searches, keyboard nav, single click to select.
 */
export function NotionPagePicker({
  open,
  onClose,
  onSelect,
  title = 'Choose a Notion page',
  subtitle,
}: NotionPagePickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NotionPageRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  // Reset state when opened/closed
  useEffect(() => {
    if (open) {
      setQuery('');
      setError(null);
      // Trigger initial load (recently edited)
      setLoading(true);
      callSearchNotionPages('')
        .then((pages) => {
          setResults(pages);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Notion initial load failed', err);
          setError('Could not load Notion pages.');
          setLoading(false);
        });
      // Focus the search input shortly after the modal mounts
      window.setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setResults([]);
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const pages = await callSearchNotionPages(query);
        setResults(pages);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'functions/unauthenticated') {
          addToast('Notion access expired. Reconnect from Settings.', 'error');
          onClose();
        } else {
          console.error('Notion search failed', err);
          setError('Notion search failed. Try again.');
        }
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} size="md">
      <div className="flex flex-col">
        {/* Search */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
              <IconSearch size={16} />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages…"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] min-h-[12rem] overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="px-5 py-8 text-center text-sm text-[var(--text-secondary)]">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-[var(--text-secondary)]">
              No Notion pages match.
              <br />
              <span className="text-xs">
                Tip: share the page with your Ten99 integration in Notion.
              </span>
            </div>
          )}

          {results.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => {
                onSelect(page);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-[var(--bg-input)] transition-colors border-b border-[var(--border)] last:border-b-0 cursor-pointer"
            >
              <NotionIcon icon={page.icon} />
              <span className="flex-1 min-w-0 text-sm text-[var(--text-primary)] truncate">
                {page.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function NotionIcon({ icon }: { icon?: string | null }) {
  if (!icon) {
    return (
      <span className="w-6 h-6 flex items-center justify-center rounded-md bg-[var(--bg-input)] text-[var(--text-secondary)]">
        <IconNotebook size={14} />
      </span>
    );
  }
  // Emoji
  if (icon.length <= 4 && !icon.startsWith('http')) {
    return <span className="w-6 h-6 flex items-center justify-center text-base">{icon}</span>;
  }
  // Image URL
  return <img src={icon} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />;
}
