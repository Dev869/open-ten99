import { useState, useEffect } from 'react';
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
} from '../services/firestore';
import type { WorkItem, Client, AppSettings, App, Team, TeamMember, TeamInvite, GitHubIntegration, GitHubActivity } from '../lib/types';

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

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeApps((a) => {
      setApps(a);
      setLoading(false);
    });
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
  const [integration, setIntegration] = useState<GitHubIntegration | null>(null);
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
