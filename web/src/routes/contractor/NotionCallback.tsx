import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callHandleNotionCallback } from '../../services/firestore';
import { useToast } from '../../hooks/useToast';

export default function NotionCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    async function handleCallback() {
      if (errorParam) {
        addToast('Notion authorization was cancelled.', 'info');
        navigate('/dashboard/settings', { replace: true });
        return;
      }
      if (!code || !state) {
        addToast('Missing Notion authorization details.', 'error');
        navigate('/dashboard/settings', { replace: true });
        return;
      }
      try {
        const result = await callHandleNotionCallback(code, state);
        addToast(
          result.workspaceName
            ? `Connected to ${result.workspaceName}!`
            : 'Notion connected!',
          'success'
        );
      } catch (err) {
        console.error('Notion OAuth callback error:', err);
        addToast('Failed to connect Notion. Please try again.', 'error');
      } finally {
        navigate('/dashboard/settings', { replace: true });
      }
    }

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <p className="text-sm text-[var(--text-secondary)]">Connecting Notion…</p>
      </div>
    </div>
  );
}
