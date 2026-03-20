import { useState, useEffect } from 'react';
import type { AppSettings } from '../../lib/types';
import { updateSettings } from '../../services/firestore';
import { IconMail, IconLightbulb, IconBook, IconDocument, IconLock } from '../../components/icons';
import { BrandIcon } from '../../components/Brand';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useIntegration } from '../../hooks/useFirestore';
import { useToast } from '../../hooks/useToast';

interface SettingsProps {
  settings: AppSettings;
  userId: string;
}

const colorPresets = [
  '#4BA8A8', '#27AE60', '#E74C3C', '#E67E22', '#8E44AD', '#2C3E50',
];

type ThemeMode = 'light' | 'dark' | 'system';

function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem('oc-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return 'system';
}

function applyThemeMode(mode: ThemeMode) {
  if (mode === 'system') {
    localStorage.removeItem('oc-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
  } else {
    localStorage.setItem('oc-theme', mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
}

const WEBHOOK_URL = 'https://us-central1-openchanges.cloudfunctions.net/onGitHubWebhook';

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function Settings({ settings, userId }: SettingsProps) {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [hourlyRate, setHourlyRate] = useState(String(settings.hourlyRate));
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemeMode);

  const { user } = useAuth();
  const { integration } = useIntegration(user?.uid);
  const { addToast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setHourlyRate(String(settings.hourlyRate));
    setAccentColor(settings.accentColor);
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    await updateSettings(userId, {
      companyName: companyName.trim(),
      hourlyRate: Number(hourlyRate) || 0,
      accentColor,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Settings
        </h1>
        <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] px-2 py-0.5 rounded-full tracking-wide">
          v1.0
        </span>
      </div>

      {/* Theme */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-5">
        <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
          Theme
        </label>
        <div className="flex gap-2 mt-2">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setThemeMode(mode); applyThemeMode(mode); }}
              className={`flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                themeMode === mode
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
          System follows your device preference.
        </p>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 space-y-5">
        {/* Company Name */}
        <div>
          <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
            Company Name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full mt-1.5 px-3 py-2.5 min-h-[44px] bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            Used in PDF headers and branding.
          </p>
        </div>

        {/* Hourly Rate */}
        <div>
          <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
            Hourly Rate
          </label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">$</span>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              step="5"
              min="0"
              className="w-full pl-7 pr-3 py-2.5 min-h-[44px] bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            Used for cost calculations and AI estimates.
          </p>
        </div>

        {/* Accent Color */}
        <div>
          <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
            Accent Color
          </label>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {colorPresets.map((color) => (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                className="w-11 h-11 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  outline: accentColor === color ? '2px solid var(--text-primary)' : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[var(--text-secondary)]">Custom:</span>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-11 h-11 rounded cursor-pointer border-0"
            />
            <span className="text-xs text-[var(--text-secondary)] font-mono">{accentColor}</span>
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 min-h-[44px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* ── Integrations ── */}
      <div className="mt-8">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Integrations
        </h2>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          {/* GitHub icon + heading */}
          <div className="flex items-center gap-2 mb-1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="text-[var(--text-primary)]" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">GitHub</h3>
          </div>

          {integration?.connected ? (
            <div className="space-y-4 mt-3">
              {/* User info */}
              <div className="flex items-center gap-3">
                {integration.avatarUrl ? (
                  <img
                    src={integration.avatarUrl}
                    alt={integration.login}
                    className="w-9 h-9 rounded-full border border-[var(--border)]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)] text-sm font-bold">
                    {integration.login.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{integration.login}</p>
                  {integration.lastSyncAt && (
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Last synced {formatRelativeTime(integration.lastSyncAt)}
                    </p>
                  )}
                </div>
              </div>

              {/* Orgs */}
              {integration.orgs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {integration.orgs.map((org) => (
                    <span
                      key={org}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border)]"
                    >
                      {org}
                    </span>
                  ))}
                </div>
              )}

              {/* Webhook URL */}
              <div>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wide mb-1">
                  Webhook URL
                </p>
                <div className="flex items-center gap-2 bg-[var(--bg-input)] rounded-lg px-3 py-2">
                  <code className="flex-1 text-[11px] text-[var(--text-secondary)] font-mono truncate">
                    {WEBHOOK_URL}
                  </code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(WEBHOOK_URL);
                      setWebhookCopied(true);
                      setTimeout(() => setWebhookCopied(false), 2000);
                    }}
                    className="text-[11px] text-[var(--accent)] font-semibold hover:underline flex-shrink-0"
                  >
                    {webhookCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      const triggerGitHubSync = httpsCallable(functions, 'triggerGitHubSync');
                      await triggerGitHubSync({});
                      addToast('GitHub sync started.', 'success');
                    } catch (err) {
                      console.error('Sync error:', err);
                      addToast('Sync failed. Please try again.', 'error');
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  disabled={syncing}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
                >
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Disconnect GitHub? This will stop syncing and remove your integration.')) return;
                    setDisconnecting(true);
                    try {
                      const disconnectGitHub = httpsCallable(functions, 'disconnectGitHub');
                      await disconnectGitHub({});
                      addToast('GitHub disconnected.', 'info');
                    } catch (err) {
                      console.error('Disconnect error:', err);
                      addToast('Failed to disconnect. Please try again.', 'error');
                    } finally {
                      setDisconnecting(false);
                    }
                  }}
                  disabled={disconnecting}
                  className="px-4 py-2.5 min-h-[44px] rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] text-sm font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Connect your GitHub account to sync repositories and track activity across your work items.
              </p>
              <button
                onClick={async () => {
                  try {
                    const getGitHubAuthUrl = httpsCallable<object, { url: string }>(functions, 'getGitHubAuthUrl');
                    const result = await getGitHubAuthUrl({});
                    window.location.href = result.data.url;
                  } catch (err) {
                    console.error('GitHub auth URL error:', err);
                    addToast('Could not start GitHub connection. Please try again.', 'error');
                  }
                }}
                className="w-full py-2.5 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] transition-colors flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                Connect GitHub
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── About & Support ── */}
      <div className="mt-10">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          About &amp; Support
        </h2>

        {/* App Info */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-5 flex items-center gap-4">
          <BrandIcon size={36} />
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Open TEN99 v1.0</p>
            <p className="text-xs text-[var(--text-secondary)]">Built by DW Tailored Systems</p>
          </div>
        </div>

        {/* Support & Feedback */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-5">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Support &amp; Feedback
          </h3>
          <div className="divide-y divide-[var(--border)]">
            <a
              href="mailto:support@dwtailored.com?subject=Open%20TEN99%20Support%20Request"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <IconMail size={18} color="var(--text-secondary)" />
              <span className="text-sm text-[var(--text-primary)]">Report an Issue</span>
            </a>
            <a
              href="mailto:support@dwtailored.com?subject=Open%20TEN99%20Feature%20Request"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <IconLightbulb size={18} color="var(--text-secondary)" />
              <span className="text-sm text-[var(--text-primary)]">Feature Request</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <IconBook size={18} color="var(--text-secondary)" />
              <span className="text-sm text-[var(--text-primary)]">Documentation</span>
            </a>
          </div>
        </div>

        {/* Legal */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-5">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Legal
          </h3>
          <div className="divide-y divide-[var(--border)]">
            <a
              href="#"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <IconDocument size={18} color="var(--text-secondary)" />
              <span className="text-sm text-[var(--text-primary)]">Terms of Service</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <IconLock size={18} color="var(--text-secondary)" />
              <span className="text-sm text-[var(--text-primary)]">Privacy Policy</span>
            </a>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] text-center mt-4">
            &copy; 2026 DW Tailored Systems. All rights reserved.
          </p>
        </div>

        {/* Credits / Attribution */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Credits
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Built with React, Firebase, and Tailwind CSS
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
            Designed and developed by Devin Wilson
          </p>
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-secondary)] text-center mt-6">
        &copy; 2026 DW Tailored Systems. All rights reserved.
      </p>
    </div>
  );
}
