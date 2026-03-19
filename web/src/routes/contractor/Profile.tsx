import { useState, useEffect, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../../lib/types';
import { subscribeProfile, updateProfile } from '../../services/firestore';
import { useWorkItems } from '../../hooks/useFirestore';
import { formatCurrency, formatHours } from '../../lib/utils';

interface ProfileProps {
  user: User;
  onLogout: () => void;
}

export default function Profile({ user, onLogout }: ProfileProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');

  const { workItems } = useWorkItems();

  // Subscribe to profile data
  useEffect(() => {
    setProfileLoading(true);
    const unsubscribe = subscribeProfile(user.uid, (p) => {
      setProfile(p);
      setProfileLoading(false);
    });
    return unsubscribe;
  }, [user.uid]);

  // Sync form state when profile loads or editing toggles
  useEffect(() => {
    if (editing) {
      setDisplayName(profile?.displayName ?? user.displayName ?? '');
      setPhone(profile?.phone ?? '');
      setCompany(profile?.company ?? '');
      setBio(profile?.bio ?? '');
      setWebsite(profile?.website ?? '');
      setAddress(profile?.address ?? '');
      setPhotoPreview(null);
    }
  }, [editing, profile, user.displayName]);

  // Compute stats
  const stats = useMemo(() => {
    const totalWorkOrders = workItems.length;
    const totalHours = workItems.reduce((sum, i) => sum + i.totalHours, 0);
    const totalRevenue = workItems
      .filter((i) => i.isBillable)
      .reduce((sum, i) => sum + i.totalCost, 0);
    return { totalWorkOrders, totalHours, totalRevenue };
  }, [workItems]);

  const memberSince = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'N/A';

  async function handleSave() {
    setSaving(true);
    await updateProfile(user.uid, {
      displayName: displayName.trim(),
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      bio: bio.trim() || undefined,
      website: website.trim() || undefined,
      address: address.trim() || undefined,
    });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  const resolvedDisplayName = profile?.displayName || user.displayName || 'User';
  const resolvedCompany = profile?.company;
  const resolvedPhone = profile?.phone;
  const resolvedBio = profile?.bio;
  const resolvedWebsite = profile?.website;
  const resolvedAddress = profile?.address;
  const resolvedPhotoURL = photoPreview || profile?.photoURL || user.photoURL;

  return (
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider mb-6">
        Profile
      </h1>

      {/* Profile Header */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-4">
        <div className="flex items-center gap-5">
          {/* Profile Photo */}
          <div className="flex-shrink-0 relative group">
            {resolvedPhotoURL ? (
              <img
                src={resolvedPhotoURL}
                alt=""
                className="w-20 h-20 rounded-full ring-2 ring-[var(--border)] object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-3xl">
                {resolvedDisplayName.charAt(0).toUpperCase()}
              </div>
            )}
            {editing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* Name & Email */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">
              {resolvedDisplayName}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] truncate">{user.email}</p>
            {resolvedCompany && (
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">{resolvedCompany}</p>
            )}
          </div>

          {/* Edit Toggle */}
          <button
            onClick={() => setEditing(!editing)}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] px-4 py-2 rounded-xl transition-colors flex-shrink-0 font-medium hover:bg-[var(--bg-input)]"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-[var(--text-secondary)]">
          <span>Member since {memberSince}</span>
          {resolvedPhone && <span>{resolvedPhone}</span>}
          {resolvedWebsite && (
            <a href={resolvedWebsite} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              {resolvedWebsite.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </div>

      {/* Saved toast */}
      {saved && (
        <div className="bg-[#27AE60]/10 text-[#27AE60] text-sm font-medium px-4 py-2.5 rounded-xl mb-4 text-center animate-fade-in-up">
          Profile saved successfully.
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-4 space-y-5 animate-fade-in-up">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Edit Profile
          </h2>

          {/* Two-column layout for short fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={user.email ?? ''}
                readOnly
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)]/50 rounded-xl text-sm text-[var(--text-secondary)] cursor-not-allowed border border-transparent"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
              />
            </div>

            {/* Company Name */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Your company"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
              />
            </div>

            {/* Website */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
              />
            </div>

            {/* Address */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="City, State"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
              />
            </div>
          </div>

          {/* Bio - full width */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide block mb-1.5">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A few words about yourself..."
              className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
            />
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="py-2.5 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto py-2.5 px-6 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Profile Details (when not editing) */}
      {!editing && !profileLoading && (resolvedPhone || resolvedBio || resolvedWebsite || resolvedAddress) && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-4">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
            About
          </h2>
          <div className="space-y-3">
            {resolvedBio && (
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{resolvedBio}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resolvedPhone && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Phone</span>
                  <span className="text-[var(--text-primary)]">{resolvedPhone}</span>
                </div>
              )}
              {resolvedWebsite && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Website</span>
                  <a href={resolvedWebsite} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate ml-2">
                    {resolvedWebsite.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {resolvedAddress && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Location</span>
                  <span className="text-[var(--text-primary)]">{resolvedAddress}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Stats */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
          Stats
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[var(--bg-page)] rounded-xl p-4">
            <div className="text-2xl font-extrabold text-[var(--text-primary)]">
              {stats.totalWorkOrders}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Work Orders</div>
          </div>
          <div className="bg-[var(--bg-page)] rounded-xl p-4">
            <div className="text-2xl font-extrabold text-[var(--text-primary)]">
              {formatHours(stats.totalHours)}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Hours Logged</div>
          </div>
          <div className="bg-[var(--bg-page)] rounded-xl p-4">
            <div className="text-2xl font-extrabold text-[var(--accent)]">
              {formatCurrency(stats.totalRevenue)}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Revenue</div>
          </div>
          <div className="bg-[var(--bg-page)] rounded-xl p-4">
            <div className="text-lg font-extrabold text-[var(--text-primary)]">
              {memberSince}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Member Since</div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">UID</span>
            <span className="text-[var(--text-primary)] font-mono text-xs">{user.uid}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Provider</span>
            <span className="text-[var(--text-primary)]">
              {user.providerData[0]?.providerId === 'google.com'
                ? 'Google'
                : user.providerData[0]?.providerId ?? 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Last Sign-In</span>
            <span className="text-[var(--text-primary)]">
              {user.metadata.lastSignInTime
                ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={onLogout}
        className="w-full py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
