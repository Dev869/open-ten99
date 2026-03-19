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

export default function Settings({ settings, userId }: SettingsProps) {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [hourlyRate, setHourlyRate] = useState(String(settings.hourlyRate));
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider mb-6">
        Settings
      </h1>

      <div className="bg-white rounded-xl border border-[#E5E5EA] p-5 space-y-5">
        {/* Company Name */}
        <div>
          <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
            Company Name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full mt-1.5 px-3 py-2.5 min-h-[44px] bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
          />
          <p className="text-[10px] text-[#86868B] mt-1">
            Used in PDF headers and branding.
          </p>
        </div>

        {/* Hourly Rate */}
        <div>
          <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
            Hourly Rate
          </label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#86868B]">$</span>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              step="5"
              min="0"
              className="w-full pl-7 pr-3 py-2.5 min-h-[44px] bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>
          <p className="text-[10px] text-[#86868B] mt-1">
            Used for cost calculations and AI estimates.
          </p>
        </div>

        {/* Accent Color */}
        <div>
          <label className="text-xs text-[#86868B] uppercase font-semibold tracking-wide">
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
                  outline: accentColor === color ? '2px solid #1A1A2E' : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[#86868B]">Custom:</span>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-11 h-11 rounded cursor-pointer border-0"
            />
            <span className="text-xs text-[#86868B] font-mono">{accentColor}</span>
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 min-h-[44px] rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
