import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { Client, AppSettings } from '../lib/types';
import { createClient } from '../services/firestore';
import { updateSettings } from '../services/firestore';
import { IconUser, IconDollar, IconSun, IconPlus, IconCalendar, IconGear } from './icons';
import { BrandWordmark } from './Brand';

interface OnboardingProps {
  user: User;
  clients: Client[];
  settings: AppSettings;
  onComplete: () => void;
}

const TOTAL_STEPS = 4;

export function Onboarding({ user, clients, settings, onComplete }: OnboardingProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientError, setClientError] = useState('');
  const [clientSaving, setClientSaving] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(settings.hourlyRate || 150);
  const [rateSaving, setRateSaving] = useState(false);
  const [skippedClient, setSkippedClient] = useState(false);

  const firstName = user.displayName?.split(' ')[0] ?? 'there';

  function handleNext() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleCreateClient() {
    const name = clientName.trim();
    const email = clientEmail.trim();
    if (!name) {
      setClientError('Client name is required.');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientError('A valid email is required.');
      return;
    }
    setClientError('');
    setClientSaving(true);
    try {
      await createClient({ name, email });
      handleNext();
    } catch {
      setClientError('Failed to create client. Please try again.');
    } finally {
      setClientSaving(false);
    }
  }

  async function handleSaveRate() {
    if (!user.uid) return;
    setRateSaving(true);
    try {
      await updateSettings(user.uid, { hourlyRate });
      handleNext();
    } catch {
      // Silently continue — settings will use default
      handleNext();
    } finally {
      setRateSaving(false);
    }
  }

  function handleFinish() {
    localStorage.setItem('oc-onboarded', 'true');
    onComplete();
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i <= step ? 'var(--accent)' : 'var(--border)',
                transform: i === step ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8">
          {step === 0 && (
            <div className="animate-fade-in-up text-center">
              {/* Brand */}
              <div className="flex justify-center mb-5">
                <BrandWordmark size={40} />
              </div>
              <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mb-2">
                Welcome!
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                Hey {firstName}, glad you're here.
              </p>
              <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
                TEN99 helps you track work orders, manage clients, and get paid faster. Let's get your workspace set up in a few quick steps.
              </p>
              <button
                onClick={handleNext}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Let's get you set up
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in-up">
              {/* Client icon */}
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-5">
                <IconUser size={22} color="var(--accent)" />
              </div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)] text-center mb-1">
                Add Your First Client
              </h2>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
                Who are you doing work for? You can always add more later.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="contact@acme.com"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all"
                  />
                </div>
                {clientError && (
                  <p className="text-xs text-red-400">{clientError}</p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border)] transition-all duration-200 hover:bg-[var(--bg-page)] active:scale-[0.98]"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateClient}
                  disabled={clientSaving}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {clientSaving ? 'Saving...' : 'Add Client'}
                </button>
              </div>
              <button
                onClick={() => {
                  setSkippedClient(true);
                  handleNext();
                }}
                className="w-full mt-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-center"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in-up">
              {/* Rate icon */}
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-5">
                <IconDollar size={22} color="var(--accent)" />
              </div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)] text-center mb-1">
                Set Your Hourly Rate
              </h2>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
                This is your default rate for new work orders. You can change it anytime in Settings.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Hourly Rate (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)] font-semibold">$</span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border)] transition-all duration-200 hover:bg-[var(--bg-page)] active:scale-[0.98]"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveRate}
                  disabled={rateSaving}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {rateSaving ? 'Saving...' : 'Save Rate'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in-up text-center">
              {/* Confetti/celebration icon */}
              <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-5">
                <IconSun size={30} color="var(--accent)" />
              </div>
              <h2 className="text-2xl font-extrabold text-[var(--text-primary)] mb-2">
                You're All Set!
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
                Your workspace is ready. Here are some things you can do next.
              </p>

              {/* Quick links */}
              <div className="space-y-2 mb-8">
                <button
                  onClick={() => { handleFinish(); navigate('/dashboard/work-items'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-left hover:bg-[var(--bg-page)] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                    <IconPlus size={16} color="var(--accent)" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">Create Work Order</div>
                    <div className="text-xs text-[var(--text-secondary)]">Start tracking billable work</div>
                  </div>
                </button>

                <button
                  onClick={() => { handleFinish(); navigate('/dashboard/calendar'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-left hover:bg-[var(--bg-page)] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                    <IconCalendar size={16} color="var(--accent)" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">View Calendar</div>
                    <div className="text-xs text-[var(--text-secondary)]">See your scheduled work</div>
                  </div>
                </button>

                <button
                  onClick={() => { handleFinish(); navigate('/dashboard/settings'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-left hover:bg-[var(--bg-page)] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                    <IconGear size={16} color="var(--accent)" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">Manage Settings</div>
                    <div className="text-xs text-[var(--text-secondary)]">Customize your workspace</div>
                  </div>
                </button>
              </div>

              <button
                onClick={handleFinish}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
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
