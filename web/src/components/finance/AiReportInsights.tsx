import { IconSparkle } from '../icons';

interface AiInsights {
  headline: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  trends: string;
  taxTip: string;
}

interface AiReportInsightsProps {
  insights: AiInsights;
}

export function AiReportInsights({ insights }: AiReportInsightsProps) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
          <IconSparkle size={14} />
        </div>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Analysis</h3>
      </div>

      {/* Headline */}
      <p className="text-base font-semibold text-[var(--text-primary)] leading-snug">
        {insights.headline}
      </p>

      {/* Trends */}
      {insights.trends && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-1.5">
            Trends
          </h4>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {insights.trends}
          </p>
        </div>
      )}

      {/* Highlights */}
      {insights.highlights.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-green-500 mb-1.5">
            Highlights
          </h4>
          <ul className="space-y-1.5">
            {insights.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <span className="text-green-500 mt-0.5 shrink-0">+</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Concerns */}
      {insights.concerns.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-amber-500 mb-1.5">
            Concerns
          </h4>
          <ul className="space-y-1.5">
            {insights.concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-[var(--accent)] mb-1.5">
            Recommendations
          </h4>
          <ul className="space-y-1.5">
            {insights.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <span className="text-[var(--accent)] mt-0.5 shrink-0">&rarr;</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tax Tip */}
      {insights.taxTip && (
        <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/15 rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--accent)] mb-1">
            Tax Tip
          </p>
          <p className="text-sm text-[var(--text-primary)]">{insights.taxTip}</p>
        </div>
      )}
    </div>
  );
}

export function AiInsightsSkeleton() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[var(--border)]" />
        <div className="h-4 w-24 bg-[var(--border)] rounded" />
      </div>
      <div className="h-5 w-3/4 bg-[var(--border)] rounded" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-[var(--border)] rounded" />
        <div className="h-3 w-5/6 bg-[var(--border)] rounded" />
        <div className="h-3 w-4/6 bg-[var(--border)] rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-[var(--border)] rounded" />
        <div className="h-3 w-3/4 bg-[var(--border)] rounded" />
      </div>
    </div>
  );
}
