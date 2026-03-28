import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import type { WorkItem, Client, EmailTemplate } from '../lib/types';
import { WORK_ITEM_TYPE_LABELS } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import {
  subscribeEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
} from '../services/firestore';

export type EmailEditorType = 'completion' | 'invoice';

interface CompletionEmailEditorProps {
  item: WorkItem;
  client: Client;
  emailType?: EmailEditorType;
  onClose: () => void;
  onSend: () => void;
}

type EditorTab = 'templates' | 'compose' | 'html' | 'preview';
type SendState = 'idle' | 'sending' | 'sent' | 'error';

const ACCENT = '#4BA8A8';
const BG_DARK = '#1A1A2E';

function buildEmailHtml(opts: {
  emailType: EmailEditorType;
  greeting: string;
  message: string;
  closing: string;
  signoff: string;
  workOrderSubject: string;
  workOrderType: string;
  dateLabel: string;
  dateValue: string;
  bannerText: string;
  lineItems: { description: string; hours: number; cost: number }[];
  totalHours: number;
  totalCost: number;
  deductFromRetainer?: boolean;
  dueDate?: string;
  portalUrl: string;
}): string {
  const lineItemRows = opts.lineItems
    .map(
      (li, i) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#333;font-family:system-ui,-apple-system,sans-serif;">
          ${i + 1}. ${li.description || '(no description)'}
        </td>
        <td style="padding:6px 0;font-size:13px;color:#333;font-weight:500;text-align:right;white-space:nowrap;font-family:system-ui,-apple-system,sans-serif;">
          ${li.hours.toFixed(1)} hrs &mdash; ${formatCurrency(li.cost)}
        </td>
      </tr>`
    )
    .join('');

  const retainerNote = opts.deductFromRetainer
    ? `<tr><td colspan="2" style="padding:4px 16px 12px;font-size:12px;color:#E8913A;font-family:system-ui,-apple-system,sans-serif;">
        ${opts.totalHours.toFixed(1)} hours deducted from retainer
       </td></tr>`
    : '';

  const signoffHtml = opts.signoff
    .split('\n')
    .map((line) => (line.trim() ? line : '<br/>'))
    .join('<br/>');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F0;">
<tr><td align="center" style="padding:24px 16px;">

<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

  <!-- Brand header -->
  <tr>
    <td style="background:${BG_DARK};padding:24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:20px;font-weight:700;color:#FFFFFF;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0.02em;">
            TEN99
          </td>
          <td align="right" style="font-size:11px;color:rgba(255,255,255,0.5);font-family:system-ui,-apple-system,sans-serif;">
            Work Order Update
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Banner -->
  <tr>
    <td style="background:${opts.emailType === 'invoice' ? '#E8913A' : ACCENT};padding:16px 32px;text-align:center;">
      <span style="font-size:18px;font-weight:700;color:#FFFFFF;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0.02em;">
        ${opts.bannerText}
      </span>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:28px 32px;">

      <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 6px;font-family:system-ui,-apple-system,sans-serif;">
        ${opts.greeting}
      </p>
      <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 24px;font-family:system-ui,-apple-system,sans-serif;">
        ${opts.message}
      </p>

      <!-- Details card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E4DE;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <tr>
          <td colspan="2" style="background:#F9F8F5;padding:10px 16px;border-bottom:1px solid #E8E4DE;">
            <span style="font-size:11px;font-weight:700;color:#86868B;text-transform:uppercase;letter-spacing:0.08em;font-family:system-ui,-apple-system,sans-serif;">
              Order Details
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px 4px;font-size:13px;color:#86868B;font-family:system-ui,-apple-system,sans-serif;">Subject</td>
          <td style="padding:12px 16px 4px;font-size:13px;color:#333;font-weight:500;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${opts.workOrderSubject}</td>
        </tr>
        <tr>
          <td style="padding:4px 16px;font-size:13px;color:#86868B;font-family:system-ui,-apple-system,sans-serif;">Type</td>
          <td style="padding:4px 16px;font-size:13px;color:#333;font-weight:500;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${opts.workOrderType}</td>
        </tr>
        <tr>
          <td style="padding:4px 16px ${opts.dueDate ? '4px' : '12px'};font-size:13px;color:#86868B;font-family:system-ui,-apple-system,sans-serif;">${opts.dateLabel}</td>
          <td style="padding:4px 16px ${opts.dueDate ? '4px' : '12px'};font-size:13px;color:#333;font-weight:500;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${opts.dateValue}</td>
        </tr>${opts.dueDate ? `
        <tr>
          <td style="padding:4px 16px 12px;font-size:13px;color:#86868B;font-family:system-ui,-apple-system,sans-serif;">Due Date</td>
          <td style="padding:4px 16px 12px;font-size:13px;color:#E8913A;font-weight:600;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${opts.dueDate}</td>
        </tr>` : ''}
        <tr><td colspan="2" style="padding:0 16px;"><div style="border-top:1px solid #E8E4DE;"></div></td></tr>
        <tr>
          <td colspan="2" style="padding:12px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${lineItemRows}
            </table>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:0 16px;"><div style="border-top:1px solid #E8E4DE;"></div></td></tr>
        <tr>
          <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#333;font-family:system-ui,-apple-system,sans-serif;">Total</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:700;color:${ACCENT};text-align:right;font-family:system-ui,-apple-system,sans-serif;">
            ${opts.totalHours.toFixed(1)} hrs &mdash; ${formatCurrency(opts.totalCost)}
          </td>
        </tr>
        ${retainerNote}
      </table>

      <!-- CTA button -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:4px 0 24px;">
            <a href="${opts.portalUrl}" target="_blank" style="display:inline-block;background:${ACCENT};color:#FFFFFF;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;">
              View Full Details
            </a>
          </td>
        </tr>
      </table>

      <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 16px;font-family:system-ui,-apple-system,sans-serif;">
        ${opts.closing}
      </p>
      <p style="font-size:14px;line-height:1.6;color:#333;margin:0;font-family:system-ui,-apple-system,sans-serif;">
        ${signoffHtml}
      </p>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="border-top:1px solid #E8E4DE;padding:16px 32px;text-align:center;">
      <span style="font-size:11px;color:#86868B;font-family:system-ui,-apple-system,sans-serif;">
        Open TEN99
      </span>
    </td>
  </tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

export function CompletionEmailEditor({
  item,
  client,
  emailType = 'completion',
  onClose,
  onSend,
}: CompletionEmailEditorProps) {
  const isInvoice = emailType === 'invoice';

  const [tab, setTab] = useState<EditorTab>('templates');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Template library
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeEmailTemplates(setTemplates);
    return unsub;
  }, []);

  const [toEmail, setToEmail] = useState(client.email);
  const [toName, setToName] = useState(client.name);
  const [subject, setSubject] = useState(
    isInvoice
      ? `Invoice — ${item.subject}`
      : `Work Order Completed! — ${item.subject}`
  );
  const [fromEmail, setFromEmail] = useState('noreply@example.com');
  const [fromName, setFromName] = useState('Open TEN99');

  const [greeting, setGreeting] = useState(`Hello ${client.name},`);
  const [message, setMessage] = useState(
    isInvoice
      ? 'Please find your invoice details below for the completed work.'
      : 'Great news — your work order has been completed! Here are the details:'
  );
  const [closing, setClosing] = useState(
    isInvoice
      ? 'Payment is due within 30 days. Please don\'t hesitate to reach out with any questions.'
      : "If you have any questions or need follow-up work, please don't hesitate to reach out."
  );
  const [signoff, setSignoff] = useState('Best regards,\nOpen TEN99');

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dueDateFormatted = useMemo(() => {
    if (!isInvoice) return undefined;
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return due.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [isInvoice]);

  const typeName = WORK_ITEM_TYPE_LABELS[item.type];
  const portalUrl = `https://openchanges.web.app/portal/${item.id}`;

  // Build HTML from current form values
  const generatedHtml = useMemo(
    () =>
      buildEmailHtml({
        emailType,
        greeting,
        message,
        closing,
        signoff,
        workOrderSubject: item.subject,
        workOrderType: typeName,
        dateLabel: isInvoice ? 'Invoice Date' : 'Completed',
        dateValue: todayFormatted,
        bannerText: isInvoice ? 'Invoice' : 'Work Order Completed!',
        lineItems: item.lineItems.map((li) => ({
          description: li.description,
          hours: li.hours,
          cost: li.cost,
        })),
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        deductFromRetainer: item.deductFromRetainer,
        dueDate: dueDateFormatted,
        portalUrl,
      }),
    [emailType, greeting, message, closing, signoff, item, typeName, todayFormatted, dueDateFormatted, portalUrl, isInvoice]
  );

  // Allow full HTML override
  const [htmlOverride, setHtmlOverride] = useState<string | null>(null);
  const currentHtml = htmlOverride ?? generatedHtml;

  // When switching to HTML tab for the first time, seed with generated
  function handleTabChange(newTab: EditorTab) {
    if (newTab === 'html' && htmlOverride === null) {
      setHtmlOverride(generatedHtml);
    }
    setTab(newTab);
  }

  function loadTemplate(tpl: EmailTemplate) {
    setActiveTemplateId(tpl.id ?? null);
    setSubject(tpl.subject);
    if (tpl.greeting) setGreeting(tpl.greeting);
    if (tpl.message) setMessage(tpl.message);
    if (tpl.closing) setClosing(tpl.closing);
    if (tpl.signoff) setSignoff(tpl.signoff);
    if (tpl.fromEmail) setFromEmail(tpl.fromEmail);
    if (tpl.fromName) setFromName(tpl.fromName);
    setHtmlOverride(tpl.html);
    setTab('compose');
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const id = await saveEmailTemplate({
        id: activeTemplateId ?? undefined,
        name: templateName.trim(),
        subject,
        html: currentHtml,
        greeting,
        message,
        closing,
        signoff,
        fromEmail,
        fromName,
      });
      setActiveTemplateId(id);
      setShowSaveDialog(false);
      setTemplateName('');
    } catch (err) {
      console.error('Save template error:', err);
    }
    setSavingTemplate(false);
  }

  async function handleDeleteTemplate(id: string) {
    await deleteEmailTemplate(id);
    if (activeTemplateId === id) setActiveTemplateId(null);
  }

  async function handleSend() {
    setSendState('sending');
    setError(null);
    try {
      const fn = httpsCallable(functions, 'sendCompletionEmail');
      await fn({
        to: toEmail,
        toName,
        subject,
        fromEmail,
        fromName,
        html: currentHtml,
      });
      setSendState('sent');
    } catch (err) {
      console.error('Send email error:', err);
      setError((err as Error).message || 'Failed to send email.');
      setSendState('error');
    }
  }

  // ── Sending state ──────────────────────────────────

  if (sendState === 'sending') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:mx-4 p-8 text-center">
          <div className="h-8 w-8 mx-auto mb-4 rounded-full border-[3px] border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Sending to {toEmail}...</p>
        </div>
      </div>
    );
  }

  // ── Sent state ─────────────────────────────────────

  if (sendState === 'sent') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:mx-4 p-8 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Email Sent!</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Completion email sent to {toEmail}
          </p>
          <button
            onClick={onSend}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] transition-colors min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────

  if (sendState === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:mx-4 p-8 text-center">
          <div className="text-4xl mb-3">✕</div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Failed to Send</h3>
          <p className="text-sm text-[var(--color-red)] mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              Close
            </button>
            <button
              onClick={() => setSendState('idle')}
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] transition-colors min-h-[44px]"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main editor ────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col sm:mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {isInvoice ? 'Invoice Email' : 'Completion Email'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          {(['templates', 'compose', 'html', 'preview'] as EditorTab[]).map((t) => {
            const labels: Record<EditorTab, string> = {
              templates: 'Templates',
              compose: 'Compose',
              html: 'Edit HTML',
              preview: 'Preview',
            };
            return (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  tab === t
                    ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Templates tab ── */}
          {tab === 'templates' && (
            <div className="p-4 space-y-4">
              {/* Start from scratch */}
              <button
                onClick={() => {
                  setActiveTemplateId(null);
                  setHtmlOverride(null);
                  setTab('compose');
                }}
                className="w-full p-4 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] text-left transition-colors"
              >
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Start from Scratch
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Use the default completion email template
                </div>
              </button>

              {/* Saved templates */}
              {templates.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                    Saved Templates
                  </h4>
                  <div className="space-y-2">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors group"
                      >
                        <button
                          onClick={() => loadTemplate(tpl)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {tpl.name}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {tpl.subject}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] mt-1">
                            Last updated {new Date(tpl.updatedAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          onClick={() => tpl.id && handleDeleteTemplate(tpl.id)}
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-red)]/60 hover:text-[var(--color-red)] hover:bg-[var(--bg-input)] transition-all text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {templates.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6">
                  No saved templates yet. Compose an email and save it as a template.
                </p>
              )}
            </div>
          )}

          {/* ── Compose tab ── */}
          {tab === 'compose' && (
            <div className="p-4 space-y-4">
              {/* To / From / Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    To (Name)
                  </label>
                  <input
                    type="text"
                    value={toName}
                    onChange={(e) => setToName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    To (Email)
                  </label>
                  <input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    From (Name)
                  </label>
                  <input
                    type="text"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    From (Email)
                  </label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              {/* Email body fields */}
              <div className="border-t border-[var(--border)] pt-4 space-y-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    Greeting
                  </label>
                  <input
                    type="text"
                    value={greeting}
                    onChange={(e) => { setGreeting(e.target.value); setHtmlOverride(null); }}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setHtmlOverride(null); }}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    Closing
                  </label>
                  <textarea
                    value={closing}
                    onChange={(e) => { setClosing(e.target.value); setHtmlOverride(null); }}
                    rows={2}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                    Sign-off
                  </label>
                  <textarea
                    value={signoff}
                    onChange={(e) => { setSignoff(e.target.value); setHtmlOverride(null); }}
                    rows={2}
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Read-only work order summary */}
              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <div className="bg-[var(--bg-input)] px-4 py-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    Work Order Details (included automatically)
                  </span>
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Subject</span>
                    <span className="font-medium text-[var(--text-primary)]">{item.subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Type</span>
                    <span className="font-medium text-[var(--text-primary)]">{typeName}</span>
                  </div>
                  {item.lineItems.map((li, i) => (
                    <div key={li.id} className="flex justify-between items-start">
                      <span className="text-[var(--text-secondary)] flex-1">
                        {i + 1}. {li.description || '(no description)'}
                      </span>
                      <span className="text-[var(--text-primary)] font-medium ml-4 whitespace-nowrap">
                        {li.hours.toFixed(1)} hrs — {formatCurrency(li.cost)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border)] pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-[var(--accent)]">
                      {item.totalHours.toFixed(1)} hrs — {formatCurrency(item.totalCost)}
                    </span>
                  </div>
                </div>
              </div>

              {htmlOverride !== null && (
                <p className="text-xs text-[var(--color-orange)]">
                  HTML was manually edited. Compose changes will regenerate the template.
                </p>
              )}
            </div>
          )}

          {/* ── HTML tab ── */}
          {tab === 'html' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
                  HTML Source
                </label>
                <button
                  onClick={() => setHtmlOverride(null)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Reset to Generated
                </button>
              </div>
              <textarea
                value={currentHtml}
                onChange={(e) => setHtmlOverride(e.target.value)}
                spellCheck={false}
                className="w-full h-[55vh] px-3 py-2 bg-[var(--bg-input)] rounded-lg text-xs text-[var(--text-primary)] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] leading-relaxed"
              />
            </div>
          )}

          {/* ── Preview tab ── */}
          {tab === 'preview' && (
            <div className="bg-[#F5F5F0]">
              <iframe
                srcDoc={currentHtml}
                title="Email Preview"
                className="w-full border-0"
                style={{ height: '65vh' }}
                sandbox="allow-same-origin"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="py-3 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          {tab !== 'templates' && (
            <button
              onClick={() => {
                setTemplateName(
                  activeTemplateId
                    ? templates.find((t) => t.id === activeTemplateId)?.name ?? ''
                    : ''
                );
                setShowSaveDialog(true);
              }}
              className="py-3 px-5 rounded-xl border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors min-h-[44px]"
            >
              Save Template
            </button>
          )}
          <div className="flex-1" />
          {tab !== 'templates' && (
            <button
              onClick={handleSend}
              disabled={!toEmail}
              className="py-3 px-8 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all min-h-[44px]"
            >
              Send Email
            </button>
          )}
        </div>

        {/* Save Template Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-2xl">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg p-5 w-80">
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">
                {activeTemplateId ? 'Update Template' : 'Save as Template'}
              </h4>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                autoFocus
                className="w-full px-3 py-2 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || savingTemplate}
                  className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
                >
                  {savingTemplate ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
