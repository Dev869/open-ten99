import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import type { WorkItem, Client, EmailTemplate } from '../../lib/types';
import { WORK_ITEM_TYPE_LABELS } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import {
  subscribeEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
  updateInvoiceStatus,
} from '../../services/firestore';

export type EmailEditorType = 'completion' | 'invoice';

interface EmailComposerProps {
  workItems: WorkItem[];
  clients: Client[];
}

type SendState = 'idle' | 'sending' | 'sent' | 'error';

/* ── Brand colors for the email template ─────────────────── */
const TEAL = '#1A8F8F';
const HEADER_GRADIENT_START = '#1E2A3A';
const HEADER_GRADIENT_END = '#243545';
const TEAL_BORDER = '#1A9E9E';
const TEXT_DARK = '#2C2C2C';
const TEXT_MED = '#5A5550';
const TEXT_LIGHT = '#7A756E';
const BORDER_COLOR = '#E4DFDA';
const BG_SUBTLE = '#F8F6F3';
const BG_PAGE = '#F0EDEA';
const DUE_DATE_COLOR = '#B5711F';

/* ── HTML escape to prevent XSS in email content ─────────── */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Logo placeholder (hosted URL for emails) ────────────── */
// Set your hosted logo URLs here, or leave empty for text fallback
const LOGO_WIDE_URL = '';
const LOGO_ICON_URL = '';

/* ── Signature fields ────────────────────────────────────── */
interface SignatureData {
  name: string;
  title: string;
  website: string;
  websiteLabel: string;
}

const DEFAULT_SIGNATURE: SignatureData = {
  name: 'Your Name',
  title: 'Your Title',
  website: '',
  websiteLabel: '',
};

/* ── Build email HTML ────────────────────────────────────── */

function buildEmailHtml(opts: {
  emailType: EmailEditorType;
  greeting: string;
  message: string;
  closing: string;
  signature: SignatureData;
  workOrderSubject: string;
  workOrderType: string;
  dateLabel: string;
  dateValue: string;
  headerLabel: string;
  lineItems: { description: string; hours: number; cost: number }[];
  totalHours: number;
  totalCost: number;
  deductFromRetainer?: boolean;
  dueDate?: string;
}): string {
  const esc = escapeHtml;

  const lineItemRows = opts.lineItems
    .map(
      (li, i) => `
      <tr>
        <td style="padding:6px 20px;font-size:14px;color:${TEXT_DARK};font-family:system-ui,-apple-system,sans-serif;">
          ${i + 1}. ${esc(li.description) || '(no description)'}
        </td>
        <td style="padding:6px 20px;font-size:14px;color:${TEXT_DARK};font-weight:500;text-align:right;white-space:nowrap;font-family:system-ui,-apple-system,sans-serif;">
          ${li.hours.toFixed(1)} hrs &mdash; ${formatCurrency(li.cost)}
        </td>
      </tr>`
    )
    .join('');

  const retainerNote = opts.deductFromRetainer
    ? `<tr><td colspan="2" style="padding:4px 20px 12px;font-size:12px;color:${DUE_DATE_COLOR};font-family:system-ui,-apple-system,sans-serif;">
        ${opts.totalHours.toFixed(1)} hours deducted from retainer
       </td></tr>`
    : '';

  const logoWideTag = LOGO_WIDE_URL
    ? `<img src="${LOGO_WIDE_URL}" width="160" alt="Open TEN99" style="display:block;height:auto;border:0;" />`
    : `<span style="font-size:18px;font-weight:700;color:#FFFFFF;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0.03em;">Open TEN99</span>`;

  const logoIconTag = LOGO_ICON_URL
    ? `<img src="${LOGO_ICON_URL}" width="52" alt="Open TEN99" style="display:block;height:auto;border:0;" />`
    : '';

  const signatureIconCell = logoIconTag
    ? `<td style="padding-right:16px;vertical-align:top;">${logoIconTag}</td>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PAGE};">
<tr><td align="center" style="padding:24px 16px;">

<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

  <!-- Brand header -->
  <tr>
    <td style="background:linear-gradient(135deg,${HEADER_GRADIENT_START},${HEADER_GRADIENT_END});padding:24px 32px;border-bottom:3px solid ${TEAL_BORDER};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>${logoWideTag}</td>
          <td align="right" style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.75);font-family:system-ui,-apple-system,sans-serif;letter-spacing:0.04em;">
            ${opts.headerLabel}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:36px 32px 32px;">

      <p style="font-size:16px;line-height:1.5;color:${TEXT_DARK};margin:0 0 6px;font-family:system-ui,-apple-system,sans-serif;">
        ${esc(opts.greeting)}
      </p>
      <p style="font-size:16px;line-height:1.5;color:${TEXT_MED};margin:0 0 28px;font-family:system-ui,-apple-system,sans-serif;">
        ${esc(opts.message)}
      </p>

      <!-- Details card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER_COLOR};border-radius:12px;overflow:hidden;margin-bottom:28px;">
        <tr>
          <td colspan="2" style="background:${BG_SUBTLE};padding:12px 20px;border-bottom:1px solid ${BORDER_COLOR};">
            <span style="font-size:11px;font-weight:700;color:${TEXT_LIGHT};text-transform:uppercase;letter-spacing:0.08em;font-family:system-ui,-apple-system,sans-serif;">
              Order Details
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px 6px;font-size:14px;color:${TEXT_LIGHT};font-family:system-ui,-apple-system,sans-serif;">Subject</td>
          <td style="padding:16px 20px 6px;font-size:14px;color:${TEXT_DARK};font-weight:500;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${esc(opts.workOrderSubject)}</td>
        </tr>
        <tr>
          <td style="padding:6px 20px;font-size:14px;color:${TEXT_LIGHT};font-family:system-ui,-apple-system,sans-serif;">Type</td>
          <td style="padding:6px 20px;font-size:14px;color:${TEXT_DARK};font-weight:500;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${esc(opts.workOrderType)}</td>
        </tr>
        <tr>
          <td style="padding:6px 20px;font-size:14px;color:${TEXT_LIGHT};font-family:system-ui,-apple-system,sans-serif;">${opts.dateLabel}</td>
          <td style="padding:6px 20px;font-size:14px;color:${TEXT_DARK};font-weight:500;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${opts.dateValue}</td>
        </tr>${opts.dueDate ? `
        <tr>
          <td style="padding:6px 20px 16px;font-size:14px;color:${TEXT_LIGHT};font-family:system-ui,-apple-system,sans-serif;">Due Date</td>
          <td style="padding:6px 20px 16px;font-size:14px;color:${DUE_DATE_COLOR};font-weight:600;text-align:right;font-family:system-ui,-apple-system,sans-serif;">${opts.dueDate}</td>
        </tr>` : `
        <tr><td colspan="2" style="padding:0 0 10px;"></td></tr>`}
        <tr><td colspan="2" style="padding:0;"><div style="border-top:1px solid ${BORDER_COLOR};"></div></td></tr>
        <tr>
          <td colspan="2" style="padding:14px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${lineItemRows}
            </table>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:0;"><div style="border-top:1px solid ${BORDER_COLOR};"></div></td></tr>
        <tr>
          <td style="padding:16px 20px;font-size:16px;font-weight:700;color:${TEXT_DARK};background:${BG_SUBTLE};font-family:system-ui,-apple-system,sans-serif;">Total</td>
          <td style="padding:16px 20px;font-size:16px;font-weight:700;color:${TEAL};background:${BG_SUBTLE};text-align:right;font-family:system-ui,-apple-system,sans-serif;">
            ${opts.totalHours.toFixed(1)} hrs &mdash; ${formatCurrency(opts.totalCost)}
          </td>
        </tr>
        ${retainerNote}
      </table>

      <p style="font-size:16px;line-height:1.5;color:${TEXT_MED};margin:0 0 24px;font-family:system-ui,-apple-system,sans-serif;">
        ${esc(opts.closing)}
      </p>

      <!-- Signature -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER_COLOR};padding:0;margin:0;">
        <tr>
          <td style="padding:20px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                ${signatureIconCell}
                <td style="vertical-align:top;">
                  <p style="font-size:15px;font-weight:600;color:${TEXT_DARK};margin:0 0 2px;font-family:system-ui,-apple-system,sans-serif;">
                    ${esc(opts.signature.name)}
                  </p>
                  <p style="font-size:13px;color:${TEXT_LIGHT};margin:0 0 8px;font-family:system-ui,-apple-system,sans-serif;">
                    ${esc(opts.signature.title)}
                  </p>
                  <p style="font-size:13px;color:${TEXT_LIGHT};margin:0;line-height:1.6;font-family:system-ui,-apple-system,sans-serif;">
                    <a href="${esc(opts.signature.website)}" style="color:${TEAL};text-decoration:none;">${esc(opts.signature.websiteLabel)}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="border-top:1px solid ${BORDER_COLOR};padding:20px 32px;text-align:center;">
      <span style="font-size:12px;color:${TEXT_LIGHT};font-family:system-ui,-apple-system,sans-serif;">
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

/* ── Component ───────────────────────────────────────────── */

export default function EmailComposer({ workItems, clients }: EmailComposerProps) {
  const { id, type } = useParams<{ id: string; type: string }>();
  const navigate = useNavigate();

  const emailType: EmailEditorType = type === 'invoice' ? 'invoice' : 'completion';
  const isInvoice = emailType === 'invoice';

  const item = workItems.find((i) => i.id === id);
  const client = item ? clients.find((c) => c.id === item.clientId) : undefined;

  const [sendState, setSendState] = useState<SendState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Template library
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [showTemplateList, setShowTemplateList] = useState(false);

  useEffect(() => {
    const unsub = subscribeEmailTemplates(setTemplates);
    return unsub;
  }, []);

  // Compose fields
  const [toEmail, setToEmail] = useState(client?.email ?? '');
  const [toName, setToName] = useState(client?.name ?? '');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [subject, setSubject] = useState(() => {
    if (!item) return '';
    if (item.isRetainerInvoice) {
      const periodLabel = item.retainerPeriodStart
        ? item.retainerPeriodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : '';
      return `Monthly Retainer Invoice — ${periodLabel} — ${client?.name ?? ''}`;
    }
    return isInvoice
      ? `Invoice — ${item.subject}`
      : `Work Order Completed! — ${item.subject}`;
  });
  const fromEmail = 'noreply@example.com';
  const fromName = 'Open TEN99';

  const [greeting, setGreeting] = useState(`Hello ${client?.name ?? ''},`);
  const [message, setMessage] = useState(() => {
    if (!item) return '';
    if (item.isRetainerInvoice) {
      const overageNote = item.retainerOverageHours && item.retainerOverageHours > 0
        ? ` This period includes ${item.retainerOverageHours.toFixed(1)} hours of overage beyond your retainer allocation.`
        : '';
      return `Please find your monthly retainer invoice for the current billing period.${overageNote}`;
    }
    return isInvoice
      ? 'Please find your invoice details below for the completed work.'
      : 'Great news — your work order has been completed! Here are the details:';
  });
  const [closing, setClosing] = useState(
    isInvoice
      ? "Payment is due within 30 days. Please don't hesitate to reach out with any questions."
      : "If you have any questions or need follow-up work, please don't hesitate to reach out."
  );
  const [signature, setSignature] = useState<SignatureData>({ ...DEFAULT_SIGNATURE });

  // Advanced HTML mode
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [htmlOverride, setHtmlOverride] = useState<string | null>(null);

  // Mobile preview toggle
  const [showPreview, setShowPreview] = useState(false);

  const todayFormatted = useMemo(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), []);

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

  const typeName = item ? WORK_ITEM_TYPE_LABELS[item.type] : '';
  // Build HTML from current form values
  const generatedHtml = useMemo(
    () =>
      item
        ? buildEmailHtml({
            emailType,
            greeting,
            message,
            closing,
            signature,
            workOrderSubject: item.subject,
            workOrderType: typeName,
            dateLabel: isInvoice ? 'Invoice Date' : 'Completed',
            dateValue: todayFormatted,
            headerLabel: isInvoice ? 'INVOICE' : 'WORK ORDER UPDATE',
            lineItems: item.lineItems.map((li) => ({
              description: li.description,
              hours: li.hours,
              cost: li.cost,
            })),
            totalHours: item.totalHours,
            totalCost: item.totalCost,
            deductFromRetainer: item.deductFromRetainer,
            dueDate: dueDateFormatted,
          })
        : '',
    [emailType, greeting, message, closing, signature, item, typeName, todayFormatted, dueDateFormatted, isInvoice]
  );

  const currentHtml = htmlOverride ?? generatedHtml;

  const clearHtmlOverride = useCallback(() => {
    setHtmlOverride(null);
  }, []);

  function loadTemplate(tpl: EmailTemplate) {
    setActiveTemplateId(tpl.id ?? null);
    setSubject(tpl.subject);
    if (tpl.greeting) setGreeting(tpl.greeting);
    if (tpl.message) setMessage(tpl.message);
    if (tpl.closing) setClosing(tpl.closing);
    if (tpl.signoff) {
      // Migrate old signoff to new signature format
      const lines = tpl.signoff.split('\n').filter((l) => l.trim());
      setSignature({
        ...DEFAULT_SIGNATURE,
        name: lines[1] || DEFAULT_SIGNATURE.name,
        title: lines[2] || DEFAULT_SIGNATURE.title,
      });
    }
    setHtmlOverride(tpl.html);
    setShowTemplateList(false);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const savedId = await saveEmailTemplate({
        id: activeTemplateId ?? undefined,
        name: templateName.trim(),
        subject,
        html: currentHtml,
        greeting,
        message,
        closing,
        signoff: `Best regards,\n${signature.name}\n${signature.title}`,
        fromEmail,
        fromName,
      });
      setActiveTemplateId(savedId);
      setShowSaveDialog(false);
      setTemplateName('');
    } catch (err) {
      console.error('Save template error:', err);
    }
    setSavingTemplate(false);
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDeleteTemplate(templateId: string) {
    await deleteEmailTemplate(templateId);
    if (activeTemplateId === templateId) setActiveTemplateId(null);
    setConfirmDeleteId(null);
  }

  async function handleSend() {
    setSendState('sending');
    setError(null);
    try {
      const fn = httpsCallable(functions, 'sendCompletionEmail');
      await fn({
        to: toEmail,
        toName,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        subject,
        fromEmail,
        fromName,
        html: currentHtml,
      });

      if (emailType === 'invoice' && item?.id) {
        const now = new Date();
        const due = new Date(now);
        due.setDate(due.getDate() + 30);
        await updateInvoiceStatus(item.id, {
          invoiceStatus: 'sent',
          invoiceSentDate: now,
          invoiceDueDate: due,
        });
      }

      setSendState('sent');
    } catch (err) {
      console.error('Send email error:', err);
      setError((err as Error).message || 'Failed to send email.');
      setSendState('error');
    }
  }

  /* ── Not found ─────────────────────────────────────── */
  if (!item || !client) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
        >
          &larr; Back
        </button>
        <div className="text-center py-20 text-[var(--text-secondary)]">
          Work item or client not found.
        </div>
      </div>
    );
  }

  /* ── Sending state ─────────────────────────────────── */
  if (sendState === 'sending') {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-8 text-center max-w-md w-full">
          <div className="h-8 w-8 mx-auto mb-4 rounded-full border-[3px] border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Sending to {toEmail}...</p>
        </div>
      </div>
    );
  }

  /* ── Sent state ────────────────────────────────────── */
  if (sendState === 'sent') {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-8 text-center max-w-md w-full">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-green)]/15 flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Email Sent!</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {isInvoice ? 'Invoice' : 'Completion'} email sent to {toEmail}
          </p>
          <button
            onClick={() => navigate(`/dashboard/work-items/${id}`)}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] transition-colors min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────── */
  if (sendState === 'error') {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-8 text-center max-w-md w-full">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-red)]/15 flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Failed to Send</h3>
          <p className="text-sm text-[var(--color-red)] mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              Go Back
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

  /* ── Main editor ───────────────────────────────────── */
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
            aria-label="Go back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              {isInvoice ? 'Send Invoice' : 'Send Completion Email'}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {item.subject} &middot; {client.name}
            </p>
          </div>
        </div>

        {/* Mobile preview toggle */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {showPreview ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            )}
          </svg>
          <span className="text-xs font-medium">{showPreview ? 'Edit' : 'Preview'}</span>
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">
        {/* LEFT: Compose form */}
        <div className={`flex-1 min-w-0 space-y-4 ${showPreview ? 'hidden lg:block' : ''}`}>
          {/* Recipients card */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Recipients</h2>
              {/* Template picker */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplateList(!showTemplateList)}
                  className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  Templates
                  {activeTemplateId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  )}
                </button>

                {/* Template dropdown */}
                {showTemplateList && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowTemplateList(false)} />
                    <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden">
                      <div className="p-3 border-b border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                          Email Templates
                        </p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {/* Start fresh */}
                        <button
                          onClick={() => {
                            setActiveTemplateId(null);
                            clearHtmlOverride();
                            setShowTemplateList(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-[var(--bg-input)] transition-colors border-b border-[var(--border)]"
                        >
                          <div className="text-sm font-medium text-[var(--text-primary)]">Default Template</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            Start with the standard {isInvoice ? 'invoice' : 'completion'} email
                          </div>
                        </button>

                        {templates.map((tpl) => (
                          <div
                            key={tpl.id}
                            className="flex items-center hover:bg-[var(--bg-input)] transition-colors border-b border-[var(--border)] last:border-b-0 group"
                          >
                            <button
                              onClick={() => loadTemplate(tpl)}
                              className="flex-1 px-4 py-3 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[var(--text-primary)]">{tpl.name}</span>
                                {activeTemplateId === tpl.id && (
                                  <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                                {tpl.subject}
                              </div>
                            </button>
                            {confirmDeleteId === tpl.id ? (
                              <div className="flex items-center gap-1 mr-2">
                                <button
                                  onClick={() => tpl.id && handleDeleteTemplate(tpl.id)}
                                  className="px-2 py-1 rounded text-[10px] font-semibold bg-[var(--color-red)] text-white hover:brightness-110 transition-all"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(tpl.id ?? null)}
                                className="opacity-0 group-hover:opacity-100 mr-3 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-red)]/60 hover:text-[var(--color-red)] hover:bg-[var(--color-red)]/10 transition-all"
                                aria-label={`Delete template ${tpl.name}`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}

                        {templates.length === 0 && (
                          <p className="px-4 py-4 text-xs text-[var(--text-secondary)] text-center">
                            No saved templates yet
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* From (read-only) */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-input)]/50">
              <span className="text-xs text-[var(--text-secondary)] font-medium">From:</span>
              <span className="text-xs text-[var(--text-primary)]">{fromName}</span>
              <span className="text-xs text-[var(--text-secondary)]">&lt;{fromEmail}&gt;</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">To (Name)</label>
                <input
                  type="text"
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">To (Email)</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
                />
              </div>
            </div>

            {/* CC */}
            <div>
              <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">CC</label>
              <div className="flex flex-wrap gap-1.5">
                {ccEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-input)] text-xs text-[var(--text-primary)]"
                  >
                    {email}
                    <button
                      onClick={() => setCcEmails(ccEmails.filter((e) => e !== email))}
                      className="text-[var(--text-secondary)] hover:text-[var(--color-red)] ml-0.5"
                      aria-label={`Remove ${email}`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && ccInput.trim()) {
                      e.preventDefault();
                      const email = ccInput.trim().replace(/,$/, '');
                      if (email && !ccEmails.includes(email)) {
                        setCcEmails([...ccEmails, email]);
                      }
                      setCcInput('');
                    }
                  }}
                  onBlur={() => {
                    const email = ccInput.trim().replace(/,$/, '');
                    if (email && !ccEmails.includes(email)) {
                      setCcEmails([...ccEmails, email]);
                    }
                    setCcInput('');
                  }}
                  placeholder={ccEmails.length === 0 ? 'Add CC — press Enter' : ''}
                  className="flex-1 min-w-[150px] px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
              />
            </div>
          </div>

          {/* Email body card */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Email Content</h2>

            {htmlOverride !== null && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-orange)]/10 border border-[var(--color-orange)]/20">
                <svg className="w-4 h-4 text-[var(--color-orange)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-[var(--color-orange)] flex-1">
                  Custom HTML active. Compose edits will regenerate.
                </p>
                <button
                  onClick={clearHtmlOverride}
                  className="text-xs font-medium text-[var(--color-orange)] hover:underline whitespace-nowrap"
                >
                  Reset
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Greeting</label>
              <input
                type="text"
                value={greeting}
                onChange={(e) => { setGreeting(e.target.value); clearHtmlOverride(); }}
                className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); clearHtmlOverride(); }}
                rows={3}
                className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Work order summary (read-only) */}
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="bg-[var(--bg-input)]/50 px-4 py-2.5 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Order Details (auto-included)
                </span>
              </div>
              <div className="p-4 space-y-1.5 text-sm">
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
                    <span className="text-[var(--text-primary)] font-medium ml-4 whitespace-nowrap tabular-nums">
                      {li.hours.toFixed(1)} hrs — {formatCurrency(li.cost)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[var(--border)] pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-[var(--accent)] tabular-nums">
                    {item.totalHours.toFixed(1)} hrs — {formatCurrency(item.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Closing</label>
              <textarea
                value={closing}
                onChange={(e) => { setClosing(e.target.value); clearHtmlOverride(); }}
                rows={2}
                className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Signature card */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Signature</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={signature.name}
                  onChange={(e) => { setSignature({ ...signature, name: e.target.value }); clearHtmlOverride(); }}
                  className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={signature.title}
                  onChange={(e) => { setSignature({ ...signature, title: e.target.value }); clearHtmlOverride(); }}
                  className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Website URL</label>
                <input
                  type="url"
                  value={signature.website}
                  onChange={(e) => { setSignature({ ...signature, website: e.target.value }); clearHtmlOverride(); }}
                  className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">Website Label</label>
                <input
                  type="text"
                  value={signature.websiteLabel}
                  onChange={(e) => { setSignature({ ...signature, websiteLabel: e.target.value }); clearHtmlOverride(); }}
                  className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Advanced: HTML editor */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => {
                if (!showHtmlEditor && htmlOverride === null) {
                  setHtmlOverride(generatedHtml);
                }
                setShowHtmlEditor(!showHtmlEditor);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--bg-input)]/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Edit HTML (Advanced)
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${showHtmlEditor ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showHtmlEditor && (
              <div className="p-4 pt-0 space-y-2">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setHtmlOverride(generatedHtml)}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Regenerate from fields
                  </button>
                </div>
                <textarea
                  value={currentHtml}
                  onChange={(e) => setHtmlOverride(e.target.value)}
                  spellCheck={false}
                  className="w-full h-[50vh] px-3 py-2 bg-[var(--bg-input)] rounded-lg text-xs text-[var(--text-primary)] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="py-3 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
            >
              Cancel
            </button>
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
            <div className="flex-1" />
            <button
              onClick={handleSend}
              disabled={!toEmail}
              className="py-3 px-8 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all min-h-[44px] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send
            </button>
          </div>
        </div>

        {/* RIGHT: Live preview */}
        <div className={`w-full lg:w-[440px] lg:shrink-0 lg:sticky lg:top-4 ${showPreview ? '' : 'hidden lg:block'}`}>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Live Preview
              </h2>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--color-green)]" />
                <span className="text-[10px] text-[var(--text-secondary)]">Auto-updates</span>
              </div>
            </div>
            <div className="bg-[#F0EDEA]">
              <iframe
                srcDoc={currentHtml}
                title="Email Preview"
                className="w-full h-[70vh] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Template Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl p-5 w-full max-w-sm"
            role="dialog"
            aria-labelledby="save-template-title"
          >
            <h4 id="save-template-title" className="text-sm font-bold text-[var(--text-primary)] mb-3">
              {activeTemplateId ? 'Update Template' : 'Save as Template'}
            </h4>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && templateName.trim()) handleSaveTemplate();
              }}
              className="w-full px-3 py-2.5 bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] mb-3 min-h-[44px]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="flex-1 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {savingTemplate ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
