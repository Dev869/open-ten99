import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { AppSettings } from '../lib/types';
import { createClient, updateSettings } from '../services/firestore';
import { BrandWordmark } from './Brand';
import { IconUser, IconDollar, IconPaintBrush, IconCheck } from './icons';

interface OnboardingProps {
  user: User;
  settings: AppSettings;
  onComplete: () => void;
}

const TOTAL_STEPS = 6;

const COLOR_PRESETS = [
  '#4BA8A8',
  '#27AE60',
  '#E74C3C',
  '#E67E22',
  '#8E44AD',
  '#2C3E50',
];

export function Onboarding({ user, settings, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState(
    () => user.displayName ?? ''
  );
  const [hourlyRate, setHourlyRate] = useState(settings.hourlyRate || 150);
  const [accentColor, setAccentColor] = useState(settings.accentColor || '#4BA8A8');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Status
  const [clientError, setClientError] = useState('');
  const [clientSaving, setClientSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track what was configured for the summary
  const [configured, setConfigured] = useState({
    companyName: false,
    hourlyRate: false,
    accentColor: false,
    client: false,
  });

  const goTo = useCallback((nextStep: number) => {
    if (animating) return;
    setAnimating(true);
    // Brief delay for exit animation, then switch step
    setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 150);
  }, [animating]);

  function handleNext() {
    goTo(Math.min(step + 1, TOTAL_STEPS - 1));
  }

  function handleSkip() {
    handleNext();
  }

  async function handleSaveCompanyName() {
    if (!user.uid) return;
    const trimmed = companyName.trim();
    if (trimmed) {
      setSaving(true);
      try {
        await updateSettings(user.uid, { companyName: trimmed });
        setConfigured((prev) => ({ ...prev, companyName: true }));
      } catch {
        // Continue even if save fails
      } finally {
        setSaving(false);
      }
    }
    handleNext();
  }

  async function handleSaveHourlyRate() {
    if (!user.uid) return;
    if (hourlyRate > 0) {
      setSaving(true);
      try {
        await updateSettings(user.uid, { hourlyRate });
        setConfigured((prev) => ({ ...prev, hourlyRate: true }));
      } catch {
        // Continue even if save fails
      } finally {
        setSaving(false);
      }
    }
    handleNext();
  }

  function handleSelectColor(color: string) {
    setAccentColor(color);
    // Apply immediately so the user sees the change
    document.documentElement.style.setProperty('--accent', color);
  }

  async function handleSaveAccentColor() {
    if (!user.uid) return;
    setSaving(true);
    try {
      await updateSettings(user.uid, { accentColor });
      setConfigured((prev) => ({ ...prev, accentColor: true }));
    } catch {
      // Continue even if save fails
    } finally {
      setSaving(false);
    }
    handleNext();
  }

  async function handleCreateClient() {
    const name = clientName.trim();
    const email = clientEmail.trim();
    if (!name) {
      setClientError('Client name is required.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientError('Please enter a valid email address.');
      return;
    }
    setClientError('');
    setClientSaving(true);
    try {
      await createClient({ name, email: email || '' });
      setConfigured((prev) => ({ ...prev, client: true }));
      handleNext();
    } catch {
      setClientError('Failed to create client. Please try again.');
    } finally {
      setClientSaving(false);
    }
  }

  function handleFinish() {
    localStorage.setItem('oc-onboarded', 'true');
    onComplete();
  }

  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;

  const animationClass = animating
    ? 'opacity-0 translate-y-2'
    : 'opacity-100 translate-y-0';

  return (
    <div
      className="fixed inset-0 z-[80] md:static md:z-auto flex flex-col min-h-[50vh] bg-[var(--bg-page)]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Progress bar */}
      <div className="w-full h-1 bg-[var(--border)] md:rounded-t-xl">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: 'var(--accent)',
          }}
        />
      </div>

      {/* Step indicator dots */}
      <div className="flex items-center justify-center gap-2 pt-8 pb-4">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= step ? 'var(--accent)' : 'var(--border)',
              transform: i === step ? 'scale(1.4)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div
          className={`w-full max-w-md transition-all duration-300 ease-out ${animationClass}`}
        >
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="animate-fade-in-up text-center">
              <div className="flex justify-center mb-8">
                <BrandWordmark size={36} />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                Welcome to Ten99
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mb-10 leading-relaxed max-w-sm mx-auto">
                Let's set up your workspace in a few quick steps
              </p>
              <button
                onClick={handleNext}
                className="w-full min-h-[48px] py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-90 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Get Started
              </button>
            </div>
          )}

          {/* Step 1: Company Name */}
          {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6">
                <IconUser size={26} color="var(--accent)" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
                What's your business name?
              </h1>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
                This will appear on your invoices and work orders
              </p>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your business name"
                autoFocus
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all"
              />
              <button
                onClick={handleSaveCompanyName}
                disabled={saving}
                className="w-full min-h-[48px] mt-4 py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
              <button
                onClick={handleSkip}
                className="w-full mt-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-center"
              >
                Skip
              </button>
            </div>
          )}

          {/* Step 2: Hourly Rate */}
          {step === 2 && (
            <div className="animate-fade-in-up">
              <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6">
                <IconDollar size={26} color="var(--accent)" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
                What's your hourly rate?
              </h1>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
                Used for cost estimates and invoicing
              </p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[var(--text-secondary)]">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  autoFocus
                  className="w-full min-h-[48px] pl-9 pr-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all"
                />
              </div>
              <button
                onClick={handleSaveHourlyRate}
                disabled={saving}
                className="w-full min-h-[48px] mt-4 py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
              <button
                onClick={handleSkip}
                className="w-full mt-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-center"
              >
                Skip
              </button>
            </div>
          )}

          {/* Step 3: Accent Color */}
          {step === 3 && (
            <div className="animate-fade-in-up">
              <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6">
                <IconPaintBrush size={26} color="var(--accent)" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
                Pick your brand color
              </h1>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
                This sets the accent color throughout the app
              </p>
              <div className="flex items-center justify-center gap-4 mb-8">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleSelectColor(color)}
                    className="w-12 h-12 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
                    style={{
                      backgroundColor: color,
                      outline: accentColor === color
                        ? '3px solid var(--text-primary)'
                        : '2px solid transparent',
                      outlineOffset: '3px',
                    }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              <button
                onClick={handleSaveAccentColor}
                disabled={saving}
                className="w-full min-h-[48px] py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
              <button
                onClick={handleSkip}
                className="w-full mt-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-center"
              >
                Skip
              </button>
            </div>
          )}

          {/* Step 4: Add First Client */}
          {step === 4 && (
            <div className="animate-fade-in-up">
              <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6">
                <IconUser size={26} color="var(--accent)" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
                Add your first client
              </h1>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
                You can always add more clients later
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setClientError('');
                    }}
                    placeholder="Acme Corp"
                    autoFocus
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => {
                      setClientEmail(e.target.value);
                      setClientError('');
                    }}
                    placeholder="contact@acme.com"
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all"
                  />
                </div>
                {clientError && (
                  <p className="text-xs text-red-400 mt-1">{clientError}</p>
                )}
              </div>
              <button
                onClick={handleCreateClient}
                disabled={clientSaving}
                className="w-full min-h-[48px] mt-4 py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {clientSaving ? 'Saving...' : 'Add Client'}
              </button>
              <button
                onClick={handleSkip}
                className="w-full mt-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-center"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 5: All Set */}
          {step === 5 && (
            <div className="animate-fade-in-up text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6">
                <IconCheck size={32} color="var(--accent)" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                You're all set!
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
                Your workspace is ready to go
              </p>

              {/* Summary of configured items */}
              <div className="space-y-2 mb-8 text-left">
                {configured.companyName && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <IconCheck size={14} color="var(--accent)" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        Business name
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {companyName.trim()}
                      </div>
                    </div>
                  </div>
                )}
                {configured.hourlyRate && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <IconCheck size={14} color="var(--accent)" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        Hourly rate
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        ${hourlyRate}/hr
                      </div>
                    </div>
                  </div>
                )}
                {configured.accentColor && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: accentColor }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        Brand color
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {accentColor}
                      </div>
                    </div>
                  </div>
                )}
                {configured.client && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <IconCheck size={14} color="var(--accent)" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        First client
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {clientName.trim()}
                      </div>
                    </div>
                  </div>
                )}
                {!configured.companyName &&
                  !configured.hourlyRate &&
                  !configured.accentColor &&
                  !configured.client && (
                    <p className="text-sm text-[var(--text-secondary)] text-center py-2">
                      You can customize everything from Settings anytime.
                    </p>
                  )}
              </div>

              <button
                onClick={handleFinish}
                className="w-full min-h-[48px] py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-90 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
