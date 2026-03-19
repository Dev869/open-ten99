import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkItem } from '../../lib/types';
import { StatusBadge } from '../../components/StatusBadge';
import { TypeTag } from '../../components/TypeTag';
import { formatCurrency, formatDate } from '../../lib/utils';

interface PortalHomeProps {
  workItems: WorkItem[];
  clientName: string;
}

function ClientApprovalBadge({ approval }: { approval?: 'pending' | 'approved' | 'rejected' }) {
  if (!approval) return null;
  const config = {
    pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
    approved: { bg: 'bg-[#5A9A5A]/20', text: 'text-[#5A9A5A]', label: 'Approved' },
    rejected: { bg: 'bg-[#D4873E]/20', text: 'text-[#D4873E]', label: 'Changes Requested' },
  };
  const c = config[approval];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${approval === 'approved' ? 'bg-[#5A9A5A]' : approval === 'rejected' ? 'bg-[#D4873E]' : 'bg-gray-400'}`} />
      {c.label}
    </span>
  );
}

export default function PortalHome({ workItems, clientName }: PortalHomeProps) {
  const navigate = useNavigate();

  const items = useMemo(
    () => workItems.filter((i) => i.status !== 'archived'),
    [workItems]
  );

  const pending = items.filter((i) => i.status === 'inReview');
  const rest = items.filter((i) => i.status !== 'inReview');

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Teal brand header */}
      <div className="bg-[#4BA8A8]">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-2">
          <div className="flex items-baseline gap-1">
            <span className="text-white font-black text-2xl tracking-tight leading-none">DW</span>
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
          <div className="flex-1 bg-[#4BA8A8]" />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <span className="font-bold text-[10px] text-[var(--accent)] tracking-widest uppercase">
            OpenChanges
          </span>
          <h1 className="text-xl font-bold text-white mt-2">
            Welcome, {clientName}
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Review and approve your work orders below.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Pending Review */}
        {pending.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Needs Your Review ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map((item) => {
                const needsAction = !item.clientApproval || item.clientApproval === 'pending';
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/portal/${item.id}`)}
                    className="w-full bg-[var(--bg-card)] rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow border-l-4 border-[var(--accent)] relative"
                  >
                    {needsAction && (
                      <span className="absolute top-3 right-3 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]" />
                      </span>
                    )}
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)] truncate pr-4">{item.subject}</div>
                        <div className="flex gap-2 mt-1 flex-wrap items-center">
                          <TypeTag type={item.type} />
                          <span className="text-xs text-[var(--text-secondary)]">{formatDate(item.createdAt)}</span>
                          {item.clientApproval && <ClientApprovalBadge approval={item.clientApproval} />}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <StatusBadge status={item.status} />
                        <div className="text-sm font-bold text-[var(--accent)] mt-1">
                          {formatCurrency(item.totalCost)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* All Orders */}
        {rest.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              All Work Orders
            </h2>
            <div className="space-y-2">
              {rest.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/portal/${item.id}`)}
                  className="w-full bg-[var(--bg-card)] rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.subject}</div>
                      <div className="flex gap-2 mt-1 flex-wrap items-center">
                        <TypeTag type={item.type} />
                        <span className="text-xs text-[var(--text-secondary)]">{formatDate(item.createdAt)}</span>
                        {item.clientApproval && <ClientApprovalBadge approval={item.clientApproval} />}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <StatusBadge status={item.status} />
                      <div className="text-sm font-bold text-[var(--text-primary)] mt-1">
                        {formatCurrency(item.totalCost)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 opacity-40">✦</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">No work orders</div>
            <div className="text-sm text-[var(--text-secondary)] mt-1">
              There are no work orders to review at this time.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
