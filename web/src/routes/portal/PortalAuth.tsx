import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, functions } from '../../lib/firebase';

export default function PortalAuth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('No token provided.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const verify = httpsCallable<{ token: string }, { customToken: string; workItemId?: string }>(
          functions,
          'verifyMagicLink'
        );
        const result = await verify({ token });
        await signInWithCustomToken(auth, result.data.customToken);
        const dest = result.data.workItemId
          ? `/portal/${result.data.workItemId}`
          : '/portal';
        navigate(dest, { replace: true });
      } catch (err) {
        console.error('Auth error:', err);
        setError('This link has expired or is invalid. Please request a new one from your contractor.');
        setLoading(false);
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-[#4BA8A8] flex items-center justify-center">
      {/* Brand header */}
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <span className="text-white font-black text-4xl tracking-tight leading-none">DW</span>
          <div className="text-white/80 text-[10px] font-bold tracking-[0.25em] uppercase mt-1">
            Tailored Systems
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-2xl shadow-lg overflow-hidden">
          {/* Accent stripe */}
          <div className="flex h-1">
            <div className="flex-1 bg-[#E74C3C]" />
            <div className="flex-1 bg-[#E67E22]" />
            <div className="flex-1 bg-[#F1C40F]" />
            <div className="flex-1 bg-[#27AE60]" />
            <div className="flex-1 bg-[#4BA8A8]" />
          </div>

          <div className="p-8 text-center">
            {loading && !error && (
              <>
                <h1 className="text-lg font-bold text-[var(--text-primary)] mb-2">Signing you in...</h1>
                <p className="text-sm text-[var(--text-secondary)]">Please wait while we verify your access.</p>
              </>
            )}

            {error && (
              <>
                <h1 className="text-lg font-bold text-[var(--text-primary)] mb-2">Access Error</h1>
                <p className="text-sm text-[var(--text-secondary)]">{error}</p>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-white/50 mt-4 font-medium tracking-wide">
          DW Tailored Systems
        </p>
      </div>
    </div>
  );
}
