import { useState, useEffect } from 'react';
import {
  subscribeWorkItems,
  subscribeClients,
  subscribeSettings,
} from '../services/firestore';
import type { WorkItem, Client, AppSettings } from '../lib/types';

export function useWorkItems(clientId?: string) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeWorkItems((items) => {
      setWorkItems(items);
      setLoading(false);
    }, clientId);
    return unsubscribe;
  }, [clientId]);

  return { workItems, loading };
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeClients((c) => {
      setClients(c);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { clients, loading };
}

export function useSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<AppSettings>({
    accentColor: '#4BA8A8',
    hourlyRate: 150,
    companyName: 'DW Tailored',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const unsubscribe = subscribeSettings(userId, (s) => {
      setSettings(s);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { settings, loading };
}
