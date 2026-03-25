import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  subscribeWorkItems,
  subscribeClients,
  subscribeSettings,
  subscribeApps,
  subscribeTeam,
  subscribeTeamMembers,
  subscribeTeamInvites,
  subscribeIntegration,
  subscribeGitHubActivity,
  subscribeConnectedAccounts,
  subscribeReceipts,
  subscribeTimeEntries,
  subscribeMileageTrips,
  subscribeInsights,
  callGenerateInsights,
} from '../services/firestore';
import type { WorkItem, Client, AppSettings, App, Team, TeamMember, TeamInvite, IntegrationData, GitHubActivity, ConnectedAccount, Receipt, TimeEntry, MileageTrip, Insights } from '../lib/types';

/**
 * Wait for Firebase auth to be ready before subscribing to Firestore.
 * On reload, auth.currentUser is already set. On fresh login, we wait
 * for onAuthStateChanged to fire with the authenticated user.
 */
function whenAuthReady(fn: () => () => void): () => void {
  if (auth.currentUser) return fn();

  let unsub: (() => void) | null = null;
  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsubAuth();
      unsub = fn();
    }
  });

  return () => {
    unsubAuth();
    unsub?.();
  };
}

export function useWorkItems(clientId?: string) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = whenAuthReady(() =>
      subscribeWorkItems((items) => {
        setWorkItems(items);
        setLoading(false);
      }, clientId, () => setLoading(false))
    );
    return unsubscribe;
  }, [clientId]);

  return { workItems, loading };
}

export function useDiscardedWorkItems() {
  const { workItems, loading } = useWorkItems();
  const discarded = workItems.filter(item => item.discardedAt != null);
  return { discardedItems: discarded, loading };
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = whenAuthReady(() =>
      subscribeClients((c) => {
        setClients(c);
        setLoading(false);
      }, () => setLoading(false))
    );
    return unsubscribe;
  }, []);

  return { clients, loading };
}

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = whenAuthReady(() =>
      subscribeApps((a) => {
        setApps(a);
        setLoading(false);
      }, () => setLoading(false))
    );
    return unsubscribe;
  }, []);

  return { apps, loading };
}

export function useSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<AppSettings>({
    accentColor: '#4BA8A8',
    hourlyRate: 150,
    companyName: 'DW Tailored',
    sidebarOrder: undefined,
    sidebarHidden: undefined,
    mileageRate: 0.70,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeSettings(userId, (s) => {
      setSettings(s);
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, [userId]);

  return { settings, loading };
}

export function useTeam(teamId: string | undefined) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeTeam(teamId, (t) => {
      setTeam(t);
      setLoading(false);
    });
    return unsubscribe;
  }, [teamId]);

  return { team, loading };
}

export function useTeamMembers(teamId: string | undefined) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeTeamMembers(teamId, (m) => {
      setMembers(m);
      setLoading(false);
    });
    return unsubscribe;
  }, [teamId]);

  return { members, loading };
}

export function useTeamInvites(teamId: string | undefined) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeTeamInvites(teamId, (i) => {
      setInvites(i);
      setLoading(false);
    });
    return unsubscribe;
  }, [teamId]);

  return { invites, loading };
}

export function useIntegration(userId: string | undefined) {
  const [integration, setIntegration] = useState<IntegrationData>({
    github: null,
    postmarkConfigured: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeIntegration(userId, (i) => {
      setIntegration(i);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { integration, loading };
}

export function useGitHubActivity(appId: string | undefined) {
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeGitHubActivity(appId, (a) => {
      setActivities(a);
      setLoading(false);
    });
    return unsubscribe;
  }, [appId]);

  return { activities, loading };
}

export function useConnectedAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeConnectedAccounts((items) => {
        setAccounts(items);
        setLoading(false);
      }),
    );
    // Note: subscribeConnectedAccounts has its own error handler that calls
    // callback([]) — loading is set false via the callback path.
    return unsubscribe;
  }, []);

  return { accounts, loading };
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeReceipts((items) => {
        setReceipts(items);
        setLoading(false);
      }),
    );
    return unsubscribe;
  }, []);

  return { receipts, loading };
}

export function useTimeEntries() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeTimeEntries((items) => {
        setEntries(items);
        setLoading(false);
      }),
    );
    return unsubscribe;
  }, []);

  return { entries, loading };
}

export function useMileageTrips() {
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeMileageTrips((items) => {
        setTrips(items);
        setLoading(false);
      }),
    );
    return unsubscribe;
  }, []);
  return { trips, loading };
}

export function useInsights() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeInsights((data) => {
        setInsights(data);
        setLoading(false);
      }),
    );
    return unsubscribe;
  }, []);

  const isGenerating = insights?.status === 'generating';
  const lastGenerated = insights?.generatedAt ?? null;
  const errors = insights?.errors ?? [];

  const refreshInsights = async () => {
    await callGenerateInsights(true);
  };

  return { insights, loading, isGenerating, lastGenerated, errors, refreshInsights };
}
