import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import type { App, Client } from '../lib/types';
import { functions } from '../lib/firebase';
import { useToast } from '../hooks/useToast';

interface RepoSummary {
  fullName: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazersCount: number;
  archived: boolean;
  pushedAt: string;
  htmlUrl: string;
}

interface GitHubImportModalProps {
  clients: Client[];
  apps: App[];
  onClose: () => void;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/20 text-blue-400',
  JavaScript: 'bg-yellow-500/20 text-yellow-400',
  Python: 'bg-green-500/20 text-green-400',
  Go: 'bg-cyan-500/20 text-cyan-400',
  Rust: 'bg-orange-500/20 text-orange-400',
  Swift: 'bg-orange-500/20 text-orange-400',
  Kotlin: 'bg-purple-500/20 text-purple-400',
  Java: 'bg-red-500/20 text-red-400',
  Ruby: 'bg-red-500/20 text-red-400',
  PHP: 'bg-indigo-500/20 text-indigo-400',
  CSS: 'bg-pink-500/20 text-pink-400',
  HTML: 'bg-orange-500/20 text-orange-400',
  Shell: 'bg-gray-500/20 text-gray-400',
  Dart: 'bg-blue-500/20 text-blue-400',
};

function formatPushedAt(pushedAt: string): string {
  const date = new Date(pushedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function GitHubImportModal({ clients, apps, onClose }: GitHubImportModalProps) {
  const { addToast } = useToast();

  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeOrg, setActiveOrg] = useState<string>('all');

  const [selectedFullNames, setSelectedFullNames] = useState<Set<string>>(new Set());
  const [selectedClientId, setSelectedClientId] = useState('');

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Load repos on mount
  useEffect(() => {
    const importFn = httpsCallable<unknown, { repos: RepoSummary[] }>(functions, 'importGitHubRepos');
    importFn()
      .then((result) => {
        setRepos(result.data.repos ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load GitHub repos:', err);
        setLoadError('Failed to load repositories. Please try again.');
        setLoading(false);
      });
  }, []);

  // Derive org tabs from repo list
  const orgs = useMemo(() => {
    const seen = new Set<string>();
    for (const repo of repos) {
      const owner = repo.fullName.split('/')[0];
      seen.add(owner);
    }
    return Array.from(seen).sort();
  }, [repos]);

  const linkedFullNames = useMemo(
    () => new Set(apps.map((a) => a.githubRepo?.fullName).filter(Boolean) as string[]),
    [apps]
  );

  const filteredRepos = useMemo(() => {
    return repos.filter((repo) => {
      if (activeOrg !== 'all') {
        const owner = repo.fullName.split('/')[0];
        if (owner !== activeOrg) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !repo.name.toLowerCase().includes(q) &&
          !(repo.description ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [repos, activeOrg, search]);

  function toggleRepo(fullName: string) {
    setSelectedFullNames((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  }

  async function handleImport() {
    if (!selectedClientId || selectedFullNames.size === 0) return;
    setImporting(true);

    const toImport = repos.filter((r) => selectedFullNames.has(r.fullName));
    const linkFn = httpsCallable(functions, 'linkRepoToApp');
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < toImport.length; i++) {
      setImportProgress({ current: i + 1, total: toImport.length });
      const repo = toImport[i];
      try {
        await linkFn({ clientId: selectedClientId, repoFullName: repo.fullName });
        succeeded++;
      } catch (err) {
        console.error(`Failed to link ${repo.fullName}:`, err);
        failed++;
      }
    }

    setImporting(false);
    setImportProgress(null);

    if (failed === 0) {
      addToast(
        `Successfully imported ${succeeded} repo${succeeded !== 1 ? 's' : ''}.`,
        'success'
      );
    } else {
      addToast(
        `Imported ${succeeded} repo${succeeded !== 1 ? 's' : ''}, ${failed} failed.`,
        failed === toImport.length ? 'error' : 'info'
      );
    }

    onClose();
  }

  const canImport = selectedClientId && selectedFullNames.size > 0 && !importing;

  const inputClass =
    'w-full px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[var(--border)] flex-shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-primary)] uppercase tracking-wide">
              Import from GitHub
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Select repositories to import as apps
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">Loading repositories…</p>
            </div>
          )}

          {loadError && !loading && (
            <div className="text-center py-16">
              <p className="text-sm text-red-500">{loadError}</p>
            </div>
          )}

          {!loading && !loadError && (
            <>
              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repositories…"
                className={inputClass}
              />

              {/* Org tabs */}
              {orgs.length > 1 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveOrg('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeOrg === 'all'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    All
                  </button>
                  {orgs.map((org) => (
                    <button
                      key={org}
                      onClick={() => setActiveOrg(org)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        activeOrg === org
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {org}
                    </button>
                  ))}
                </div>
              )}

              {/* Repo list */}
              <div className="space-y-2">
                {filteredRepos.length === 0 && (
                  <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                    No repositories found.
                  </p>
                )}
                {filteredRepos.map((repo) => {
                  const isLinked = linkedFullNames.has(repo.fullName);
                  const isSelected = selectedFullNames.has(repo.fullName);

                  return (
                    <label
                      key={repo.fullName}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                        isLinked
                          ? 'border-[var(--border)] opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                          : 'border-[var(--border)] hover:bg-[var(--bg-input)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isLinked}
                        onChange={() => !isLinked && toggleRepo(repo.fullName)}
                        className="mt-0.5 accent-[var(--accent)] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[var(--text-primary)] truncate">
                            {repo.fullName}
                          </span>
                          {repo.archived && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)] flex-shrink-0">
                              Archived
                            </span>
                          )}
                          {isLinked && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 flex-shrink-0 flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Linked
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {repo.language && (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                LANGUAGE_COLORS[repo.language] ?? 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {repo.language}
                            </span>
                          )}
                          {repo.stargazersCount > 0 && (
                            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.1L6 8l-2.78 1.46.53-3.1L1.5 4.27l3.11-.45L6 1z"
                                  stroke="currentColor"
                                  strokeWidth="1"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              {repo.stargazersCount}
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-secondary)]">
                            Pushed {formatPushedAt(repo.pushedAt)}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !loadError && (
          <div className="flex items-center gap-3 p-5 border-t border-[var(--border)] flex-shrink-0">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">Select a client *</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleImport}
              disabled={!canImport}
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {importing && importProgress
                ? `Importing ${importProgress.current} of ${importProgress.total}…`
                : selectedFullNames.size > 0
                ? `Import ${selectedFullNames.size} repo${selectedFullNames.size !== 1 ? 's' : ''}`
                : 'Import repos'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
