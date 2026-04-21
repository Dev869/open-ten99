import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WorkItem } from '../../lib/types';
import { StatusBadge } from '../../components/workitems/StatusBadge';
import { TypeTag } from '../../components/workitems/TypeTag';
import { formatCurrency, formatDate, sanitizeUrl } from '../../lib/utils';
import { updateWorkItemClientResponse } from '../../services/firestore';
import { IconCheck, IconCheckSmall } from '../../components/icons';

interface PortalDetailProps {
  workItems: WorkItem[];
}

function ApprovalBadge({ status }: { status?: 'pending' | 'approved' | 'rejected' }) {
  if (!status) return null;
  const config = {
    pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending Review' },
    approved: { bg: 'bg-[var(--color-green)]/20', text: 'text-[var(--color-green)]', label: 'Approved' },
    rejected: { bg: 'bg-[var(--color-orange)]/20', text: 'text-[var(--color-orange)]', label: 'Changes Requested' },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'approved' ? 'bg-[var(--color-green)]' : status === 'rejected' ? 'bg-[var(--color-orange)]' : 'bg-gray-400'}`} />
      {c.label}
    </span>
  );
}

export default function PortalDetail({ workItems }: PortalDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const item = workItems.find((i) => i.id === id);

  const [notes, setNotes] = useState(item?.clientNotes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!item) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center text-[var(--text-secondary)]">Work order not found.</div>
      </div>
    );
  }

  const canApprove = item.status === 'inReview' && item.clientApproval !== 'approved';

  async function handleApprove() {
    if (!item?.id) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await updateWorkItemClientResponse(item.id, {
        clientApproval: 'approved',
        clientApprovalDate: new Date(),
        ...(notes.trim() ? { clientNotes: notes.trim() } : {}),
      });
      setSuccessMsg('Work order approved! Thank you.');
    } catch {
      setErrorMsg('Failed to submit approval. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestChanges() {
    if (!item?.id) return;
    if (!notes.trim()) {
      setErrorMsg('Please add a comment explaining what changes are needed.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await updateWorkItemClientResponse(item.id, {
        clientApproval: 'rejected',
        clientApprovalDate: new Date(),
        clientNotes: notes.trim(),
      });
      setSuccessMsg('Change request submitted. We will review your feedback.');
    } catch {
      setErrorMsg('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Teal brand header */}
      <div className="bg-[var(--accent)]">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-baseline gap-1">
            <span className="text-white font-black text-xl tracking-tight leading-none">DW</span>
            <span className="text-white/70 text-[8px] font-bold tracking-[0.2em] uppercase ml-1">Tailored Systems</span>
          </div>
        </div>
      </div>
      {/* Dark section with accent stripe */}
      <div className="bg-[#1A1A2E]">
        <div className="flex h-1">
          <div className="flex-1 bg-[#E74C3C]" />
          <div className="flex-1 bg-[#E67E22]" />
          <div className="flex-1 bg-[#F1C40F]" />
          <div className="flex-1 bg-[#27AE60]" />
          <div className="flex-1 bg-[var(--accent)]" />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/portal')}
            className="text-sm text-white/60 hover:text-white mb-3"
          >
            &larr; Back
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-white">{item.subject}</h1>
              <div className="flex gap-2 mt-2 flex-wrap items-center">
                <TypeTag type={item.type} />
                <span className="text-xs text-white/60">{formatDate(item.createdAt)}</span>
                {item.clientApproval && <ApprovalBadge status={item.clientApproval} />}
              </div>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Line Items */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-5 mb-4">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Line Items
          </h2>
          <div className="space-y-3">
            {item.lineItems.map((li, i) => (
              <div key={li.id} className="flex gap-3 items-start">
                <span className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5 w-5 text-right">
                  {i + 1}.
                </span>
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-primary)]">{li.description}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {li.hours} hrs &middot; {formatCurrency(li.cost)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-5 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--text-secondary)]">Total Hours</span>
            <span className="text-sm font-semibold">{item.totalHours.toFixed(1)} hrs</span>
          </div>
          <div className="flex justify-between items-center border-t border-[var(--border)] pt-2">
            <span className="font-bold text-[var(--text-primary)]">Total Cost</span>
            <span className="text-xl font-extrabold text-[var(--accent)]">
              {formatCurrency(item.totalCost)}
            </span>
          </div>
        </div>

        {/* Approval Status (when already responded) */}
        {item.clientApproval === 'approved' && !successMsg && (
          <div className="bg-[var(--color-green)]/10 border border-[var(--color-green)]/30 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2">
              <IconCheck size={20} color="var(--color-green)" />
              <span className="text-sm font-semibold text-[var(--color-green)]">You approved this work order</span>
            </div>
            {item.clientApprovalDate && (
              <p className="text-xs text-[var(--text-secondary)] mt-1 ml-7">
                {formatDate(item.clientApprovalDate)}
              </p>
            )}
            {item.clientNotes && (
              <p className="text-sm text-[var(--text-secondary)] mt-2 ml-7">{item.clientNotes}</p>
            )}
          </div>
        )}

        {item.clientApproval === 'rejected' && !successMsg && (
          <div className="bg-[var(--color-orange)]/10 border border-[var(--color-orange)]/30 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--color-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-semibold text-[var(--color-orange)]">You requested changes</span>
            </div>
            {item.clientApprovalDate && (
              <p className="text-xs text-[var(--text-secondary)] mt-1 ml-7">
                {formatDate(item.clientApprovalDate)}
              </p>
            )}
            {item.clientNotes && (
              <p className="text-sm text-[var(--text-secondary)] mt-2 ml-7">{item.clientNotes}</p>
            )}
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="bg-[var(--color-green)]/10 border border-[var(--color-green)]/30 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2">
              <IconCheck size={20} color="var(--color-green)" />
              <span className="text-sm font-semibold text-[var(--color-green)]">{successMsg}</span>
            </div>
          </div>
        )}

        {/* Approval section */}
        {canApprove && !successMsg && (
          <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-5 mb-4">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Your Feedback
            </h2>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Add any comments or notes..."
              rows={3}
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
            />
            {errorMsg && (
              <p className="text-xs text-red-500 mt-2">{errorMsg}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-green)] text-white rounded-xl py-3 min-h-[48px] font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                <IconCheckSmall size={20} color="white" />
                {submitting ? 'Submitting...' : 'Approve'}
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-orange)] text-white rounded-xl py-3 min-h-[48px] font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {submitting ? 'Submitting...' : 'Request Changes'}
              </button>
            </div>
          </div>
        )}

        {/* PDF */}
        {item.pdfUrl && sanitizeUrl(item.pdfUrl) && (
          <a
            href={sanitizeUrl(item.pdfUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold text-center hover:bg-[var(--accent-dark)] transition-colors"
          >
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}
