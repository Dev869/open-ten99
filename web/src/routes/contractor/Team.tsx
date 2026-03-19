import { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type {
  AppSettings,
  TeamRole,
} from '../../lib/types';
import { TEAM_ROLE_LABELS } from '../../lib/types';
import { useTeam, useTeamMembers, useTeamInvites } from '../../hooks/useFirestore';
import {
  createTeam,
  addTeamMember,
  updateTeam,
  updateTeamMemberRole,
  removeTeamMember,
  createTeamInvite,
  deleteTeamInvite,
  updateSettings,
} from '../../services/firestore';

interface TeamProps {
  user: User;
  settings: AppSettings;
}

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: '#4BA8A8',
  admin: '#D4873E',
  member: '#8C7E6A',
  viewer: '#A89880',
};

export default function Team({ user, settings }: TeamProps) {
  // Team ID from settings
  const teamId = settings.teamId ?? '';

  // Realtime subscriptions (hooks guard against empty teamId internally)
  const { team, loading: teamLoading } = useTeam(teamId || undefined);
  const { members, loading: membersLoading } = useTeamMembers(teamId || undefined);
  const { invites, loading: invitesLoading } = useTeamInvites(teamId || undefined);

  // Create-team form
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit team name
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Role change dropdown
  const [roleDropdownMemberId, setRoleDropdownMemberId] = useState<string | null>(null);

  // Current user's role in the team
  const currentMember = useMemo(
    () => members.find((m) => m.id === user.uid),
    [members, user.uid],
  );
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';
  const canManage = isOwner || isAdmin;

  // Sort members: owner first, then by joinedAt
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
  }, [members]);

  // Pending invites only
  const pendingInvites = useMemo(
    () => invites.filter((inv) => inv.status === 'pending'),
    [invites],
  );

  // Sync edited name when team loads
  useEffect(() => {
    if (team) setEditedName(team.name);
  }, [team]);

  // --- Handlers ---

  async function handleCreateTeam() {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const newTeamId = await createTeam({
        name: teamName.trim(),
        ownerId: user.uid,
      });
      // Add current user as owner member
      await addTeamMember(newTeamId, user.uid, {
        email: user.email ?? '',
        displayName: user.displayName ?? 'Owner',
        role: 'owner',
        photoURL: user.photoURL ?? undefined,
      });
      // Persist teamId in user settings
      await updateSettings(user.uid, { teamId: newTeamId } as Partial<AppSettings>);
    } catch (err) {
      console.error('Failed to create team:', err);
    }
    setCreating(false);
  }

  async function handleSaveName() {
    if (!editedName.trim() || !teamId) return;
    setSavingName(true);
    try {
      await updateTeam(teamId, { name: editedName.trim() });
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update team name:', err);
    }
    setSavingName(false);
  }

  async function handleRoleChange(memberId: string, newRole: TeamRole) {
    if (!teamId) return;
    try {
      await updateTeamMemberRole(teamId, memberId, newRole);
    } catch (err) {
      console.error('Failed to update role:', err);
    }
    setRoleDropdownMemberId(null);
  }

  async function handleRemoveMember(memberId: string) {
    if (!teamId) return;
    try {
      await removeTeamMember(teamId, memberId);
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim() || !teamId) return;
    setSendingInvite(true);
    try {
      await createTeamInvite(teamId, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invitedBy: user.uid,
      });
      setInviteEmail('');
      setInviteRole('member');
      setShowInvite(false);
    } catch (err) {
      console.error('Failed to send invite:', err);
    }
    setSendingInvite(false);
  }

  async function handleCancelInvite(inviteId: string) {
    if (!teamId) return;
    try {
      await deleteTeamInvite(teamId, inviteId);
    } catch (err) {
      console.error('Failed to cancel invite:', err);
    }
  }

  // --- Loading state ---
  if (teamId && teamLoading) {
    return (
      <div className="flex items-center justify-center py-24 animate-fade-in-up">
        <div className="text-sm text-[var(--text-secondary)]">Loading team...</div>
      </div>
    );
  }

  // --- No Team: Create Team View ---
  if (!teamId || !team) {
    return (
      <div className="animate-fade-in-up flex items-center justify-center min-h-[60vh]">
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8 w-full max-w-md text-center">
          {/* Team Icon */}
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="text-[var(--accent)]">
              <circle cx="18" cy="10" r="5" stroke="currentColor" strokeWidth="2" />
              <path d="M8 30c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="28" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M32 28c0-3.314-1.79-6-4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 28c0-3.314 1.79-6 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider mb-2">
            Create Your Team
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Set up a team to collaborate with others on your projects.
          </p>

          <div className="space-y-4">
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
              autoFocus
              className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow min-h-[44px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTeam();
              }}
            />
            <button
              onClick={handleCreateTeam}
              disabled={!teamName.trim() || creating}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 active:scale-[0.98] transition-all min-h-[44px]"
            >
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Team Dashboard ---
  return (
    <div className="max-w-2xl animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                autoFocus
                className="px-3 py-1.5 bg-[var(--bg-input)] rounded-xl text-xl font-extrabold text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow uppercase tracking-wider"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setEditingName(false);
                    setEditedName(team.name);
                  }
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !editedName.trim()}
                className="p-2 rounded-xl text-[var(--accent)] hover:bg-[var(--bg-input)] transition-colors"
                aria-label="Save name"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9.5l4 4L15 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setEditedName(team.name);
                }}
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                aria-label="Cancel"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider truncate">
                {team.name}
              </h1>
              {canManage && (
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors flex-shrink-0"
                  aria-label="Edit team name"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M10 2l2 2L5 11H3V9L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          )}
        </div>

        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all min-h-[44px] flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Members List */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Members
        </h2>
        <div className="space-y-2">
          {membersLoading ? (
            <div className="text-sm text-[var(--text-secondary)] py-8 text-center">Loading members...</div>
          ) : (
            sortedMembers.map((member, i) => (
              <div
                key={member.id}
                className="flex items-center gap-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-4 min-h-[72px] animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              >
                {/* Avatar */}
                {member.photoURL ? (
                  <img
                    src={member.photoURL}
                    alt=""
                    className="w-11 h-11 rounded-full ring-2 object-cover flex-shrink-0"
                    style={{ ringColor: ROLE_COLORS[member.role] }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                    style={{ backgroundColor: ROLE_COLORS[member.role] }}
                  >
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name + Email */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {member.displayName}
                    {member.id === user.uid && (
                      <span className="text-xs text-[var(--text-secondary)] font-normal ml-1.5">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    {member.email}
                  </div>
                </div>

                {/* Role Badge */}
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: `${ROLE_COLORS[member.role]}15`,
                    color: ROLE_COLORS[member.role],
                  }}
                >
                  {TEAM_ROLE_LABELS[member.role]}
                </span>

                {/* Role Dropdown (owner/admin only, cannot change own role if owner) */}
                {canManage && !(isOwner && member.id === user.uid) && member.role !== 'owner' && (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() =>
                        setRoleDropdownMemberId(
                          roleDropdownMemberId === member.id ? null : member.id!,
                        )
                      }
                      className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
                      aria-label="Change role"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {roleDropdownMemberId === member.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setRoleDropdownMemberId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg py-1 min-w-[120px]">
                          {(['admin', 'member', 'viewer'] as TeamRole[]).map((role) => (
                            <button
                              key={role}
                              onClick={() => handleRoleChange(member.id!, role)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-input)] transition-colors ${
                                member.role === role
                                  ? 'font-semibold text-[var(--text-primary)]'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              {TEAM_ROLE_LABELS[role]}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Remove button (owner/admin only, can't remove self if owner) */}
                {canManage && !(isOwner && member.id === user.uid) && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id!)}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    aria-label="Remove member"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Invites */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Pending Invites
        </h2>
        {invitesLoading ? (
          <div className="text-sm text-[var(--text-secondary)] py-4 text-center">Loading invites...</div>
        ) : pendingInvites.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No pending invites</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((invite, i) => (
              <div
                key={invite.id}
                className="flex items-center gap-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-4 min-h-[60px] animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              >
                {/* Envelope icon */}
                <div className="w-9 h-9 rounded-full bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--text-secondary)]">
                    <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M1 5l7 4 7-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {invite.email}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Invited as {TEAM_ROLE_LABELS[invite.role]} &middot;{' '}
                    {invite.createdAt.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: `${ROLE_COLORS[invite.role]}15`,
                    color: ROLE_COLORS[invite.role],
                  }}
                >
                  {TEAM_ROLE_LABELS[invite.role]}
                </span>

                {canManage && (
                  <button
                    onClick={() => handleCancelInvite(invite.id!)}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    aria-label="Cancel invite"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              setShowInvite(false);
              setInviteEmail('');
              setInviteRole('member');
            }}
          />
          <div className="relative bg-[var(--bg-page)] rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-scale-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-[var(--border)]">
              <h2 className="text-lg font-extrabold text-[var(--text-primary)] uppercase tracking-wide">
                Invite Member
              </h2>
              <button
                onClick={() => {
                  setShowInvite(false);
                  setInviteEmail('');
                  setInviteRole('member');
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  autoFocus
                  placeholder="teammate@example.com"
                  className="w-full px-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow min-h-[44px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inviteEmail.trim()) handleSendInvite();
                  }}
                />
              </div>

              {/* Role Selector */}
              <div>
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-2.5">
                  Role
                </label>
                <div className="space-y-2">
                  {(['admin', 'member', 'viewer'] as TeamRole[]).map((role) => (
                    <label
                      key={role}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all min-h-[44px] ${
                        inviteRole === role
                          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          inviteRole === role
                            ? 'border-[var(--accent)]'
                            : 'border-[var(--border)]'
                        }`}
                      >
                        {inviteRole === role && (
                          <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {TEAM_ROLE_LABELS[role]}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {role === 'admin' && 'Can manage members and edit team settings'}
                          {role === 'member' && 'Can view and work on team projects'}
                          {role === 'viewer' && 'Read-only access to team projects'}
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: `${ROLE_COLORS[role]}15`,
                          color: ROLE_COLORS[role],
                        }}
                      >
                        {TEAM_ROLE_LABELS[role]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-5 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  setShowInvite(false);
                  setInviteEmail('');
                  setInviteRole('member');
                }}
                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] active:scale-[0.98] transition-all min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim() || sendingInvite}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 active:scale-[0.98] transition-all min-h-[44px]"
              >
                {sendingInvite ? (
                  'Sending...'
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M14 2l-4.5 12-2.5-5L2 6.5 14 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Send Invite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
