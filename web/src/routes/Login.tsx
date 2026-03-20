import { IconLayers } from '../components/icons';

interface LoginProps {
  onSignIn: () => void;
  loading?: boolean;
}

export default function Login({ onSignIn, loading }: LoginProps) {
  return (
    <div className="min-h-screen bg-[#2C2417] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center mx-auto mb-5">
            <IconLayers size={28} />
          </div>
          <h1 className="text-white font-bold text-2xl tracking-tight" style={{ fontFamily: "'Space Mono', monospace" }}>TEN99</h1>
          <p className="text-white/40 text-sm mt-2">Contractor work order management</p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="p-8">
            <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
              Sign in to manage your work orders.
            </p>

            <button
              onClick={onSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--border)] disabled:opacity-50 transition-colors border border-[var(--border)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.41l3.56-2.77.01-.55z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/30 mt-6 font-medium tracking-wide">
          DW Tailored Systems
        </p>
      </div>
    </div>
  );
}
