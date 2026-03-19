import { useParams, useNavigate } from 'react-router-dom';
import type { WorkItem } from '../../lib/types';
import { StatusBadge } from '../../components/StatusBadge';
import { TypeTag } from '../../components/TypeTag';
import { formatCurrency, formatDate } from '../../lib/utils';

interface PortalDetailProps {
  workItems: WorkItem[];
}

export default function PortalDetail({ workItems }: PortalDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const item = workItems.find((i) => i.id === id);

  if (!item) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-center text-[#86868B]">Work order not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Teal brand header */}
      <div className="bg-[#4BA8A8]">
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
          <div className="flex-1 bg-[#4BA8A8]" />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/portal')}
            className="text-sm text-white/60 hover:text-white mb-3"
          >
            ← Back
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-white">{item.subject}</h1>
              <div className="flex gap-2 mt-2">
                <TypeTag type={item.type} />
                <span className="text-xs text-white/60">{formatDate(item.createdAt)}</span>
              </div>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider mb-3">
            Line Items
          </h2>
          <div className="space-y-3">
            {item.lineItems.map((li, i) => (
              <div key={li.id} className="flex gap-3 items-start">
                <span className="text-xs font-semibold text-[#86868B] mt-0.5 w-5 text-right">
                  {i + 1}.
                </span>
                <div className="flex-1">
                  <div className="text-sm text-[#1A1A2E]">{li.description}</div>
                  <div className="text-xs text-[#86868B] mt-0.5">
                    {li.hours} hrs · {formatCurrency(li.cost)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[#86868B]">Total Hours</span>
            <span className="text-sm font-semibold">{item.totalHours.toFixed(1)} hrs</span>
          </div>
          <div className="flex justify-between items-center border-t border-[#F5F5F7] pt-2">
            <span className="font-bold text-[#1A1A2E]">Total Cost</span>
            <span className="text-xl font-extrabold text-[#4BA8A8]">
              {formatCurrency(item.totalCost)}
            </span>
          </div>
        </div>

        {/* PDF */}
        {item.pdfUrl && (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold text-center hover:bg-[#3A9090] transition-colors"
          >
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}
