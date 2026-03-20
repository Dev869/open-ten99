import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type {
  App,
  Client,
  AppPlatform,
  AppStatus,
  AppEnvironment,
} from '../lib/types';
import {
  APP_PLATFORM_LABELS,
  APP_STATUS_LABELS,
  APP_ENVIRONMENT_LABELS,
} from '../lib/types';
import { createApp, updateApp } from '../services/firestore';
import { useToast } from '../hooks/useToast';

interface AppFormModalProps {
  app?: App;
  clients: Client[];
  clientId?: string;
  onClose: () => void;
}

export function AppFormModal({ app, clients, clientId, onClose }: AppFormModalProps) {
  const isEditMode = !!app;
  const { addToast } = useToast();

  const [name, setName] = useState(app?.name ?? '');
  const [selectedClientId, setSelectedClientId] = useState(app?.clientId ?? clientId ?? '');
  const [platform, setPlatform] = useState<AppPlatform>(app?.platform ?? 'web');
  const [status, setStatus] = useState<AppStatus>(app?.status ?? 'development');
  const [description, setDescription] = useState(app?.description ?? '');
  const [url, setUrl] = useState(app?.url ?? '');
  const [repoUrls, setRepoUrls] = useState<string[]>(app?.repoUrls ?? []);
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const [techStack, setTechStack] = useState<string[]>(app?.techStack ?? []);
  const [techStackInput, setTechStackInput] = useState('');
  const [hosting, setHosting] = useState(app?.hosting ?? '');
  const [environment, setEnvironment] = useState<AppEnvironment | ''>(app?.environment ?? '');
  const [deploymentNotes, setDeploymentNotes] = useState(app?.deploymentNotes ?? '');
  const [vaultCredentialIds, setVaultCredentialIds] = useState<string[]>(app?.vaultCredentialIds ?? []);
  const [vaultCredentialInput, setVaultCredentialInput] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim() && selectedClientId;

  function addRepoUrl() {
    const val = repoUrlInput.trim();
    if (val && !repoUrls.includes(val)) {
      setRepoUrls([...repoUrls, val]);
    }
    setRepoUrlInput('');
  }

  function handleRepoUrlKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRepoUrl();
    }
  }

  function removeRepoUrl(index: number) {
    setRepoUrls(repoUrls.filter((_, i) => i !== index));
  }

  function addTechStack() {
    const val = techStackInput.trim();
    if (val && !techStack.includes(val)) {
      setTechStack([...techStack, val]);
    }
    setTechStackInput('');
  }

  function handleTechStackKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTechStack();
    }
  }

  function removeTechStack(index: number) {
    setTechStack(techStack.filter((_, i) => i !== index));
  }

  function addVaultCredential() {
    const val = vaultCredentialInput.trim();
    if (val && !vaultCredentialIds.includes(val)) {
      setVaultCredentialIds([...vaultCredentialIds, val]);
    }
    setVaultCredentialInput('');
  }

  function handleVaultCredentialKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addVaultCredential();
    }
  }

  function removeVaultCredential(index: number) {
    setVaultCredentialIds(vaultCredentialIds.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        clientId: selectedClientId,
        name: name.trim(),
        platform,
        status,
        description: description.trim() || undefined,
        url: url.trim() || undefined,
        repoUrls,
        techStack: techStack.length > 0 ? techStack : undefined,
        hosting: hosting.trim() || undefined,
        environment: (environment as AppEnvironment) || undefined,
        deploymentNotes: deploymentNotes.trim() || undefined,
        vaultCredentialIds: vaultCredentialIds.length > 0 ? vaultCredentialIds : undefined,
      };

      if (isEditMode && app) {
        await updateApp({ ...app, ...payload });
      } else {
        await createApp(payload);
      }
      onClose();
    } catch (err) {
      console.error('Error saving app:', err);
      addToast('Failed to save app. Please try again.', 'error');
    }
    setSaving(false);
  }

  const inputClass =
    'w-full mt-1.5 px-3 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
  const labelClass =
    'text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-[var(--bg-page)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] uppercase tracking-wide">
            {isEditMode ? 'Edit App' : 'New App'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="App name"
              className={inputClass}
            />
          </div>

          {/* Client */}
          <div>
            <label className={labelClass}>Client *</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className={labelClass}>Platform *</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as AppPlatform)}
              className={inputClass}
            >
              {(Object.keys(APP_PLATFORM_LABELS) as AppPlatform[]).map((key) => (
                <option key={key} value={key}>
                  {APP_PLATFORM_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className={labelClass}>Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppStatus)}
              className={inputClass}
            >
              {(Object.keys(APP_STATUS_LABELS) as AppStatus[]).map((key) => (
                <option key={key} value={key}>
                  {APP_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the app..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* URL */}
          <div>
            <label className={labelClass}>URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>

          {/* Repo URLs */}
          <div>
            <label className={labelClass}>Repo URLs</label>
            {repoUrls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                {repoUrls.map((repo, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-input)] text-xs text-[var(--text-primary)] border border-[var(--border)]"
                  >
                    <span className="max-w-[180px] truncate">{repo}</span>
                    <button
                      type="button"
                      onClick={() => removeRepoUrl(i)}
                      className="text-[var(--text-secondary)] hover:text-red-500 transition-colors ml-0.5 leading-none"
                      aria-label="Remove repo URL"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={repoUrlInput}
              onChange={(e) => setRepoUrlInput(e.target.value)}
              onKeyDown={handleRepoUrlKeyDown}
              placeholder="Paste repo URL and press Enter"
              className={repoUrls.length > 0 ? inputClass : `${inputClass} mt-1.5`}
            />
          </div>

          {/* Tech Stack */}
          <div>
            <label className={labelClass}>Tech Stack</label>
            {techStack.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                {techStack.map((tech, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-input)] text-xs text-[var(--text-primary)] border border-[var(--border)]"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTechStack(i)}
                      className="text-[var(--text-secondary)] hover:text-red-500 transition-colors ml-0.5 leading-none"
                      aria-label="Remove tech"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={techStackInput}
              onChange={(e) => setTechStackInput(e.target.value)}
              onKeyDown={handleTechStackKeyDown}
              placeholder="e.g. React, TypeScript — press Enter to add"
              className={techStack.length > 0 ? inputClass : `${inputClass} mt-1.5`}
            />
          </div>

          {/* Hosting */}
          <div>
            <label className={labelClass}>Hosting</label>
            <input
              type="text"
              value={hosting}
              onChange={(e) => setHosting(e.target.value)}
              placeholder="e.g. Vercel, AWS, Firebase"
              className={inputClass}
            />
          </div>

          {/* Environment */}
          <div>
            <label className={labelClass}>Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as AppEnvironment | '')}
              className={inputClass}
            >
              <option value="">None</option>
              {(Object.keys(APP_ENVIRONMENT_LABELS) as AppEnvironment[]).map((key) => (
                <option key={key} value={key}>
                  {APP_ENVIRONMENT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {/* Deployment Notes */}
          <div>
            <label className={labelClass}>Deployment Notes</label>
            <textarea
              value={deploymentNotes}
              onChange={(e) => setDeploymentNotes(e.target.value)}
              placeholder="Deployment steps, environment variables, etc."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Linked Credentials */}
          <div>
            <label className={labelClass}>Linked Credentials</label>
            {vaultCredentialIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                {vaultCredentialIds.map((credId, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-input)] text-xs text-[var(--text-primary)] border border-[var(--border)]"
                  >
                    <span className="max-w-[180px] truncate">{credId}</span>
                    <button
                      type="button"
                      onClick={() => removeVaultCredential(i)}
                      className="text-[var(--text-secondary)] hover:text-red-500 transition-colors ml-0.5 leading-none"
                      aria-label="Remove credential"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={vaultCredentialInput}
              onChange={(e) => setVaultCredentialInput(e.target.value)}
              onKeyDown={handleVaultCredentialKeyDown}
              placeholder="Credential ID — press Enter to add"
              className={vaultCredentialIds.length > 0 ? inputClass : `${inputClass} mt-1.5`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create App'}
          </button>
        </div>
      </div>
    </div>
  );
}
