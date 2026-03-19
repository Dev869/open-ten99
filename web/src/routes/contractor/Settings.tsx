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
      <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider mb-6">
        Settings
      </h1>

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
    </div>
  );
}
