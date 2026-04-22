import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../../lib/types';
import { updateSettings } from '../../services/firestore';
import { IconMail, IconLightbulb, IconBook, IconDocument, IconLock, IconBell } from '../../components/icons';
import { BrandIcon } from '../../components/layout/Brand';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useIntegration, useGitHubAccounts } from '../../hooks/useFirestore';
import { useToast } from '../../hooks/useToast';
import {
  getPushPermissionState,
  requestPushPermissionAndGetToken,
  isSafariIOSPWA,
  type PushPermissionState,
} from '../../lib/notifications';

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
  const [mileageRate, setMileageRate] = useState(String(settings.mileageRate ?? 0.70));
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Work Order Template fields
  const [invoiceFromAddress, setInvoiceFromAddress] = useState(settings.invoiceFromAddress ?? '');
  const [invoiceTerms, setInvoiceTerms] = useState(settings.invoiceTerms ?? '');
  const [invoiceNotes, setInvoiceNotes] = useState(settings.invoiceNotes ?? '');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemeMode);

  const { user } = useAuth();
  const { integration } = useIntegration(user?.uid);
  const { accounts: githubAccounts } = useGitHubAccounts(user?.uid);
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null);
  const { addToast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Postmark state
  const [postmarkLoading, setPostmarkLoading] = useState(false);
  const [postmarkError, setPostmarkError] = useState<string | null>(null);
  const [postmarkCopied, setPostmarkCopied] = useState(false);

  const baseWebhookUrl = `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/onEmailReceived`;
  const postmarkWebhookUrl = integration.postmarkToken
    ? `${baseWebhookUrl}?token=${integration.postmarkToken}`
    : '';

  const handleGenerateWebhookUrl = useCallback(async () => {
    setPostmarkLoading(true);
    setPostmarkError(null);
    try {
      const fn = httpsCallable(functions, 'onSavePostmarkSecret');
      await fn({});
      addToast('Webhook URL generated!', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate webhook URL';
      setPostmarkError(message);
      addToast(message, 'error');
    } finally {
      setPostmarkLoading(false);
    }
  }, [addToast]);

  const handleDisconnectPostmark = useCallback(async () => {
    setPostmarkLoading(true);
    setPostmarkError(null);
    try {
      const fn = httpsCallable(functions, 'onSavePostmarkSecret');
      await fn({ disconnect: true });
      addToast('Postmark disconnected', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      setPostmarkError(message);
      addToast(message, 'error');
    } finally {
      setPostmarkLoading(false);
    }
  }, [addToast]);

  const handleCopyPostmarkUrl = useCallback(() => {
    navigator.clipboard.writeText(postmarkWebhookUrl);
    setPostmarkCopied(true);
    addToast('Webhook URL copied!', 'info');
    setTimeout(() => setPostmarkCopied(false), 2000);
  }, [postmarkWebhookUrl, addToast]);

  const [pushState, setPushState] = useState<PushPermissionState>(getPushPermissionState);
  const [pushEnabled, setPushEnabled] = useState(settings.pushNotificationsEnabled ?? false);
  const [togglingPush, setTogglingPush] = useState(false);

  // True on iPhone/iPad when not installed to home screen (Safari iOS browser)
  const isIOSNotInPWA =
    /iPad|iPhone/.test(navigator.userAgent) && !isSafariIOSPWA();

  useEffect(() => {
    setCompanyName(settings.companyName);
    setHourlyRate(String(settings.hourlyRate));
    setMileageRate(String(settings.mileageRate ?? 0.70));
    setAccentColor(settings.accentColor);
    setPushEnabled(settings.pushNotificationsEnabled ?? false);
    setInvoiceFromAddress(settings.invoiceFromAddress ?? '');
    setInvoiceTerms(settings.invoiceTerms ?? '');
    setInvoiceNotes(settings.invoiceNotes ?? '');
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    await updateSettings(userId, {
      companyName: companyName.trim(),
      hourlyRate: Number(hourlyRate) || 0,
      accentColor,
      mileageRate: Number(mileageRate) || 0.70,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveTemplate() {
    setSavingTemplate(true);
    await updateSettings(userId, {
      invoiceFromAddress: invoiceFromAddress || undefined,
      invoiceTerms: invoiceTerms || undefined,
      invoiceNotes: invoiceNotes || undefined,
    });
    setSavingTemplate(false);
    setSavedTemplate(true);
    setTimeout(() => setSavedTemplate(false), 2000);
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="hidden md:block text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
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

        {/* Invoice Logo — moved to Invoice Template section */}

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

        {/* Mileage Rate */}
        <div>
          <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
            IRS Mileage Rate
          </label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">$</span>
            <input
              type="number"
              value={mileageRate}
              onChange={(e) => setMileageRate(e.target.value)}
              step="0.01"
              min="0"
              className="w-full pl-7 pr-3 py-2.5 min-h-[44px] bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            Per-mile rate for business mileage deductions (2025 IRS rate: $0.70).
          </p>
        </div>

        {/* Time Rounding */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)]">
              Round time to quarter hour
            </label>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Rounds tracked time: 1-7 min down, 8-14 min up to nearest 15 min
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.roundTimeToQuarterHour ?? false}
            onClick={() => updateSettings(userId, { roundTimeToQuarterHour: !(settings.roundTimeToQuarterHour ?? false) })}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
              (settings.roundTimeToQuarterHour ?? false) ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                (settings.roundTimeToQuarterHour ?? false) ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
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

      {/* ── Invoice Template ── */}
      <div className="mt-8">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Invoice Template
        </h2>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {/* Brand Logo */}
          <div className="p-5">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
              Brand Logo
            </label>
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              PNG or JPG, max 2MB. Shown in the invoice header.
            </p>
            <div className="flex items-center gap-3">
              {settings.pdfLogoUrl ? (
                <img
                  src={settings.pdfLogoUrl}
                  alt="Invoice logo"
                  className="h-10 max-w-[160px] object-contain rounded border border-[var(--border)] bg-white p-1"
                />
              ) : (
                <div className="h-10 px-4 flex items-center rounded border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)]">
                  No logo
                </div>
              )}
              <label className="px-3 py-2 rounded-lg bg-[var(--bg-input)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors cursor-pointer">
                Upload
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      addToast('Logo must be under 2MB', 'error');
                      return;
                    }
                    try {
                      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                      const { storage } = await import('../../lib/firebase');
                      const storageRef = ref(storage, `logos/${userId}/${file.name}`);
                      await uploadBytes(storageRef, file);
                      const url = await getDownloadURL(storageRef);
                      await updateSettings(userId, { pdfLogoUrl: url });
                      addToast('Logo uploaded', 'success');
                    } catch (err) {
                      console.error('Logo upload failed:', err);
                      addToast('Upload failed', 'error');
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              {settings.pdfLogoUrl && (
                <button
                  onClick={async () => {
                    await updateSettings(userId, { pdfLogoUrl: '' });
                    addToast('Logo removed', 'info');
                  }}
                  className="text-xs text-[var(--color-red)] hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* From Address */}
          <div className="p-5">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
              From Address
            </label>
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Your business details shown on invoices. One line per row.
            </p>
            <textarea
              value={invoiceFromAddress}
              onChange={(e) => setInvoiceFromAddress(e.target.value)}
              placeholder={'Your Name\nYour Business\nyou@example.com'}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
            />
          </div>

          {/* Terms & Conditions */}
          <div className="p-5">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
              Terms &amp; Conditions
            </label>
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Shown at the bottom of every invoice PDF. One paragraph per line.
            </p>
            <textarea
              value={invoiceTerms}
              onChange={(e) => setInvoiceTerms(e.target.value)}
              placeholder={'This invoice is subject to acceptance. Please review and confirm before work begins.\nPayment is due upon completion unless other terms have been arranged.'}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
            />
          </div>

          {/* Notes */}
          <div className="p-5">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
              Default Notes
            </label>
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Additional notes appended after terms. Good for payment instructions or disclaimers.
            </p>
            <textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="Payment via ACH or check."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
            />
          </div>

          {/* Save Template */}
          <div className="p-5">
            <button
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="w-full py-2.5 min-h-[44px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
            >
              {savingTemplate ? 'Saving...' : savedTemplate ? 'Saved!' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Push Notifications ── */}
      <div className="mt-8">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Push Notifications
        </h2>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {/* Master toggle */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <IconBell size={18} color="var(--text-primary)" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Enable Notifications</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Receive alerts on this device even when the app is closed.
            </p>

            {pushState === 'unsupported' ? (
              <div className="bg-[var(--bg-input)] rounded-lg px-4 py-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  {isIOSNotInPWA
                    ? 'Add Ten99 to your Home Screen to enable push notifications.'
                    : 'Push notifications are not supported on this browser.'}
                </p>
                {isIOSNotInPWA && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">
                    Tap the Share button in Safari, then select &ldquo;Add to Home Screen&rdquo;.
                  </p>
                )}
              </div>
            ) : pushState === 'denied' ? (
              <div className="bg-[var(--bg-input)] rounded-lg px-4 py-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  Notifications are blocked. To enable them, update your browser or device notification settings for this site.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {pushEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {pushEnabled
                      ? 'You\u2019ll receive push notifications on this device.'
                      : 'Turn on to configure which notifications you receive.'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setTogglingPush(true);
                    try {
                      if (pushEnabled) {
                        await updateSettings(userId, {
                          pushNotificationsEnabled: false,
                          fcmToken: undefined,
                        });
                        setPushEnabled(false);
                        addToast('Push notifications disabled.', 'info');
                      } else {
                        const token = await requestPushPermissionAndGetToken();
                        setPushState(getPushPermissionState());

                        if (!token) {
                          if (getPushPermissionState() === 'denied') {
                            addToast('Notification permission was denied.', 'error');
                          } else {
                            addToast('Could not enable push notifications.', 'error');
                          }
                          return;
                        }

                        await updateSettings(userId, {
                          pushNotificationsEnabled: true,
                          pushNotifyWorkOrderDue: true,
                          pushNotifyNewInboundOrder: true,
                          fcmToken: token,
                        });
                        setPushEnabled(true);
                        addToast('Push notifications enabled!', 'success');
                      }
                    } catch (err) {
                      console.error('Push toggle error:', err);
                      addToast('Something went wrong. Please try again.', 'error');
                    } finally {
                      setTogglingPush(false);
                    }
                  }}
                  disabled={togglingPush}
                  role="switch"
                  aria-checked={pushEnabled}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-50 ${
                    pushEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      pushEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Individual notification preferences — only shown when push is enabled */}
          {pushEnabled && pushState !== 'unsupported' && pushState !== 'denied' && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                Notify me about
              </p>

              {/* Work order due reminders */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Work order due reminders
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    Get reminded when a scheduled work order is approaching its due date.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.pushNotifyWorkOrderDue ?? true}
                  onClick={() => updateSettings(userId, { pushNotifyWorkOrderDue: !(settings.pushNotifyWorkOrderDue ?? true) })}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
                    (settings.pushNotifyWorkOrderDue ?? true) ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      (settings.pushNotifyWorkOrderDue ?? true) ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* New inbound work order */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    New inbound work order
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    Get notified when a new work order is created from an inbound email via Postmark.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.pushNotifyNewInboundOrder ?? true}
                  onClick={() => updateSettings(userId, { pushNotifyNewInboundOrder: !(settings.pushNotifyNewInboundOrder ?? true) })}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
                    (settings.pushNotifyNewInboundOrder ?? true) ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      (settings.pushNotifyNewInboundOrder ?? true) ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
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

          {(() => {
            const startConnect = async () => {
              try {
                const getGitHubAuthUrl = httpsCallable<object, { authUrl: string }>(functions, 'getGitHubAuthUrl');
                const result = await getGitHubAuthUrl({});
                const url = result.data.authUrl;
                try {
                  const parsed = new URL(url);
                  if (parsed.origin !== 'https://github.com') {
                    throw new Error('Unexpected redirect target');
                  }
                } catch {
                  throw new Error('Invalid GitHub auth URL');
                }
                window.location.href = url;
              } catch (err) {
                console.error('GitHub auth URL error:', err);
                addToast('Could not start GitHub connection. Please try again.', 'error');
              }
            };

            const legacyOnly =
              githubAccounts.length === 0 && !!integration.github?.connected;

            if (githubAccounts.length === 0 && !legacyOnly) {
              return (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Connect one or more GitHub accounts to sync repositories and track activity across your work orders.
                  </p>
                  <button
                    onClick={startConnect}
                    className="w-full py-2.5 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    Connect GitHub
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3 mt-3">
                {legacyOnly && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                    Your previous GitHub connection was upgraded to multi-account support. Please reconnect to enable per-account management.
                  </div>
                )}

                {githubAccounts.map((acc) => {
                  const disconnectThis = async () => {
                    if (!window.confirm(`Disconnect ${acc.login}? Repos linked under this account will stop syncing.`)) return;
                    setDisconnectingAccountId(acc.accountId);
                    try {
                      const disconnectGitHub = httpsCallable(functions, 'disconnectGitHub');
                      await disconnectGitHub({ accountId: acc.accountId });
                      addToast(`Disconnected ${acc.login}.`, 'info');
                    } catch (err) {
                      console.error('Disconnect error:', err);
                      addToast('Failed to disconnect. Please try again.', 'error');
                    } finally {
                      setDisconnectingAccountId(null);
                    }
                  };

                  return (
                    <div
                      key={acc.accountId}
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)]/40 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        {acc.avatarUrl ? (
                          <img
                            src={acc.avatarUrl}
                            alt={acc.login}
                            className="w-9 h-9 rounded-full border border-[var(--border)]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)] text-sm font-bold">
                            {(acc.login.charAt(0) || '?').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{acc.login}</p>
                          {acc.lastSyncAt && (
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              Last synced {formatRelativeTime(acc.lastSyncAt)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={disconnectThis}
                          disabled={disconnectingAccountId === acc.accountId}
                          className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] text-xs font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                        >
                          {disconnectingAccountId === acc.accountId ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                      {acc.orgs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {acc.orgs.map((org) => (
                            <span
                              key={org.login}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border)]"
                            >
                              {org.login}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Webhook URL (shared across accounts) */}
                <div>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wide mb-1">
                    Webhook URL
                  </p>
                  <div className="flex items-center gap-2 bg-[var(--bg-input)] rounded-lg px-3 py-2 min-w-0">
                    <code className="flex-1 text-[11px] text-[var(--text-secondary)] font-mono truncate min-w-0">
                      {WEBHOOK_URL}
                    </code>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(WEBHOOK_URL);
                        setWebhookCopied(true);
                        setTimeout(() => setWebhookCopied(false), 2000);
                      }}
                      className="text-[11px] text-[var(--accent)] font-semibold hover:underline flex-shrink-0 min-h-[44px] flex items-center"
                    >
                      {webhookCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  {githubAccounts.length > 0 && (
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
                  )}
                  <button
                    onClick={startConnect}
                    className="flex-1 py-2.5 min-h-[44px] rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--bg-input)] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {legacyOnly ? 'Reconnect GitHub' : 'Add another GitHub account'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Postmark Email */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mt-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <IconMail className="w-[18px] h-[18px] text-[var(--text-primary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Postmark Email</h3>
            </div>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${
              integration.postmarkConfigured
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                integration.postmarkConfigured
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`} />
              {integration.postmarkConfigured ? 'Active' : 'Not configured'}
            </span>
          </div>

          {postmarkError && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg mt-3">
              {postmarkError}
            </div>
          )}

          {integration.postmarkConfigured ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Inbound emails are forwarded as draft work orders. Copy the URL below into your Postmark server's Inbound webhook settings.
              </p>
              <div>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wide mb-1">
                  Webhook URL
                </p>
                <div className="flex items-center gap-2 bg-[var(--bg-input)] rounded-lg px-3 py-2 min-w-0">
                  <code className="flex-1 text-[11px] text-[var(--text-secondary)] font-mono truncate min-w-0">
                    {postmarkWebhookUrl}
                  </code>
                  <button
                    onClick={handleCopyPostmarkUrl}
                    className="text-[11px] text-[var(--accent)] font-semibold hover:underline flex-shrink-0 min-h-[44px] flex items-center"
                  >
                    {postmarkCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleGenerateWebhookUrl}
                  disabled={postmarkLoading}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
                >
                  {postmarkLoading ? 'Generating…' : 'Regenerate URL'}
                </button>
                <button
                  onClick={handleDisconnectPostmark}
                  disabled={postmarkLoading}
                  className="px-4 py-2.5 min-h-[44px] rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] text-sm font-semibold hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Connect Postmark to automatically create draft work orders from inbound client emails.
              </p>
              <button
                onClick={handleGenerateWebhookUrl}
                disabled={postmarkLoading}
                className="w-full py-2.5 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
              >
                {postmarkLoading ? 'Generating…' : 'Generate Webhook URL'}
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
          <BrandIcon size={40} />
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Open TEN99 v1.0</p>
            <p className="text-xs text-[var(--text-secondary)]">Open-source work order management</p>
          </div>
        </div>

        {/* Support & Feedback */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-5">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Support &amp; Feedback
          </h3>
          <div className="divide-y divide-[var(--border)]">
            <a
              href="https://github.com/open-ten99/open-ten99/issues/new?labels=bug"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              <IconMail size={18} color="var(--text-secondary)" />
              <span className="text-sm text-[var(--text-primary)]">Report an Issue</span>
            </a>
            <a
              href="https://github.com/open-ten99/open-ten99/issues/new?labels=enhancement"
              target="_blank"
              rel="noopener noreferrer"
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
            &copy; 2026 Open TEN99 Contributors. MIT License.
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
            Open-source. MIT Licensed.
          </p>
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-secondary)] text-center mt-6">
        &copy; 2026 Open TEN99 Contributors. MIT License.
      </p>
    </div>
  );
}
