import { useState, useEffect } from 'react';
import type { AppSettings } from '../../lib/types';
import { updateSettings } from '../../services/firestore';

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

export default function Settings({ settings, userId }: SettingsProps) {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [hourlyRate, setHourlyRate] = useState(String(settings.hourlyRate));
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemeMode);

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

      {/* ── About & Support ── */}
      <div className="mt-10">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          About &amp; Support
        </h2>

        {/* App Info */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">OpenChanges v1.0</p>
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
              href="mailto:support@dwtailored.com?subject=OpenChanges%20Support%20Request"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 4l-10 8L2 4" />
              </svg>
              <span className="text-sm text-[var(--text-primary)]">Report an Issue</span>
            </a>
            <a
              href="mailto:support@dwtailored.com?subject=OpenChanges%20Feature%20Request"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <line x1="12" y1="2" x2="12" y2="6" />
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M15.09 14A6 6 0 0 0 18 8 6 6 0 0 0 6 8a6 6 0 0 0 2.91 6" />
              </svg>
              <span className="text-sm text-[var(--text-primary)]">Feature Request</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="text-sm text-[var(--text-primary)]">Terms of Service</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
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
