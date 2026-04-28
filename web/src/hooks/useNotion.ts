import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { subscribeNotionIntegration } from '../services/firestore';
import type { NotionIntegration } from '../lib/types';

export interface UseNotionResult {
  notion: NotionIntegration | null;
  loading: boolean;
}

/**
 * Subscribe to the current contractor's Notion connection metadata.
 */
export function useNotion(): UseNotionResult {
  const { user } = useAuth();
  const [notion, setNotion] = useState<NotionIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotion(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeNotionIntegration(user.uid, (next) => {
      setNotion(next);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  return { notion, loading };
}
