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
import { cn } from '../lib/utils';
import { IconClose } from './icons';
import { Modal } from './Modal';

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

  function addTag(
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void,
  ) {
    const val = value.trim();
    if (val && !list.includes(val)) {
      setList([...list, val]);
    }
    setInput('');
  }

  function removeTag(index: number, list: string[], setList: (v: string[]) => void) {
    setList(list.filter((_, i) => i !== index));
  }

  function handleTagKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void,
  ) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(value, list, setList, setInput);
    }
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

  const labelClass = 'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5';
  const inputClass = 'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all';

  function TagList({
    items,
    onRemove,
  }: {
    items: string[];
    onRemove: (i: number) => void;
  }) {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-[var(--bg-input)] text-xs text-[var(--text-primary)] border border-[var(--border)]"
          >
            <span className="max-w-[180px] truncate">{item}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="w-4 h-4 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--color-red)] transition-colors"
              aria-label={`Remove ${item}`}
            >
              <IconClose size={10} />
            </button>
          </span>
        ))}
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditMode ? 'Edit App' : 'New App'}
      subtitle={isEditMode ? undefined : 'Track an application or service you build for a client.'}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-[2] h-11 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:bg-[var(--accent-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create App'}
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">

            {/* ── Core ── */}

            {/* Name */}
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="App name"
                className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {/* Client */}
            <div>
              <label className={labelClass}>Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform + Status — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Platform</label>
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
              <div>
                <label className={labelClass}>Status</label>
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
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>
                Description <span className="normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the app..."
                rows={2}
                className={cn(inputClass, 'h-auto py-2.5 resize-none placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {/* URL */}
            <div>
              <label className={labelClass}>
                URL <span className="normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
              />
            </div>

            {/* ── Technical ── */}

            <div className="pt-2">
              <div className="text-[9px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-[0.15em] mb-4">
                Technical Details
              </div>

              <div className="space-y-5">
                {/* Repo URLs */}
                <div>
                  <label className={labelClass}>Repo URLs</label>
                  <TagList
                    items={repoUrls}
                    onRemove={(i) => removeTag(i, repoUrls, setRepoUrls)}
                  />
                  <input
                    type="text"
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, repoUrlInput, repoUrls, setRepoUrls, setRepoUrlInput)}
                    placeholder="Paste repo URL and press Enter"
                    className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
                  />
                </div>

                {/* Tech Stack */}
                <div>
                  <label className={labelClass}>Tech Stack</label>
                  <TagList
                    items={techStack}
                    onRemove={(i) => removeTag(i, techStack, setTechStack)}
                  />
                  <input
                    type="text"
                    value={techStackInput}
                    onChange={(e) => setTechStackInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, techStackInput, techStack, setTechStack, setTechStackInput)}
                    placeholder="e.g. React, TypeScript — press Enter"
                    className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
                  />
                </div>

                {/* Hosting + Environment — side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Hosting</label>
                    <input
                      type="text"
                      value={hosting}
                      onChange={(e) => setHosting(e.target.value)}
                      placeholder="e.g. Vercel, AWS"
                      className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
                    />
                  </div>
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
                </div>

                {/* Deployment Notes */}
                <div>
                  <label className={labelClass}>
                    Deployment Notes <span className="normal-case tracking-normal font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={deploymentNotes}
                    onChange={(e) => setDeploymentNotes(e.target.value)}
                    placeholder="Deployment steps, env vars, etc."
                    rows={2}
                    className={cn(inputClass, 'h-auto py-2.5 resize-none placeholder:text-[var(--text-secondary)]')}
                  />
                </div>

                {/* Linked Credentials */}
                <div>
                  <label className={labelClass}>Linked Credentials</label>
                  <TagList
                    items={vaultCredentialIds}
                    onRemove={(i) => removeTag(i, vaultCredentialIds, setVaultCredentialIds)}
                  />
                  <input
                    type="text"
                    value={vaultCredentialInput}
                    onChange={(e) => setVaultCredentialInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, vaultCredentialInput, vaultCredentialIds, setVaultCredentialIds, setVaultCredentialInput)}
                    placeholder="Credential ID — press Enter"
                    className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
                  />
                </div>
              </div>
            </div>
          </div>
    </Modal>
  );
}
