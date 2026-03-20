import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useToast } from '../../hooks/useToast';

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    async function handleCallback() {
      try {
        const handleGitHubCallback = httpsCallable(functions, 'handleGitHubCallback');
        await handleGitHubCallback({ code, state });
        addToast('GitHub connected successfully!', 'success');
      } catch (err) {
        console.error('GitHub OAuth callback error:', err);
        addToast('Failed to connect GitHub. Please try again.', 'error');
      } finally {
        navigate('/dashboard/settings', { replace: true });
      }
    }

    handleCallback();
  // Only run once on mount — searchParams is stable for this callback page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <p className="text-sm text-[var(--text-secondary)]">Connecting GitHub…</p>
      </div>
    </div>
  );
}
