import { useState, useMemo, useCallback, useEffect } from 'react';
import type { WorkItem, Client, Transaction } from '../../lib/types';
import {
  getDateRange,
  getMonthlyRevenue,
  getRevenueByClient,
  getRevenueByType,
  getAgingBuckets,
} from '../../lib/finance';
import type { DateRangePreset } from '../../lib/finance';
import { DateRangeSelector } from '../../components/finance/DateRangeSelector';
import { exportToCsv, formatDate, formatCurrency } from '../../lib/utils';
import { generateReportPdf, generateCombinedReportPdf } from '../../lib/generateReportPdf';
import type { ReportType } from '../../lib/generateReportPdf';
import { fetchTransactions } from '../../services/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import {
  RevenueExpenseTrend,
  NetIncomeTrend,
  ExpenseBreakdown,
  RevenueByClient,
  KpiRow,
} from '../../components/finance/ReportCharts';
import { AiReportInsights, AiInsightsSkeleton } from '../../components/finance/AiReportInsights';
import { IconSparkle } from '../../components/icons';

// --- Types ---

interface AiInsights {
  headline: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  trends: string;
  taxTip: string;
}

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  revenueByMonth: Array<{ month: string; amount: number }>;
  expensesByMonth: Array<{ month: string; amount: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  revenueByClient: Array<{ clientName: string; amount: number; count: number }>;
  workOrderCount: number;
  avgWorkOrderValue: number;
  topExpenseCategory: string;
  periodLabel: string;
}

interface AnalyzeReportResponse {
  summary: FinancialSummary;
  aiInsights: AiInsights;
}

// --- Sub-components ---

interface ReportCardProps {
  title: string;
  description: string;
  onExportCsv: () => void;
  onExportPdf: () => void;
  csvLoading?: boolean;
  pdfLoading?: boolean;
  pdfDisabled?: boolean;
}

function ReportCard({
  title,
  description,
  onExportCsv,
  onExportPdf,
  csvLoading,
  pdfLoading,
  pdfDisabled,
}: ReportCardProps) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex-1">
        <h3 className="font-semibold text-[var(--text-primary)] text-sm">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onExportCsv}
          disabled={csvLoading}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {csvLoading ? 'Exporting...' : 'CSV'}
        </button>
        <button
          onClick={onExportPdf}
          disabled={pdfLoading || pdfDisabled}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pdfLoading ? 'Generating...' : 'PDF'}
        </button>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function Reports({ workItems, clients }: { workItems: WorkItem[]; clients: Client[] }) {
  const now = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<DateRangePreset>('ytd');
  const range = useMemo(() => getDateRange(preset, now), [preset, now]);

  const [pdfLoading, setPdfLoading] = useState<ReportType | null>(null);
  const [csvLoading, setCsvLoading] = useState<ReportType | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);

  const [expenseTransactions, setExpenseTransactions] = useState<Transaction[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  // AI analysis state
  const [analysisData, setAnalysisData] = useState<FinancialSummary | null>(null);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Fetch expense transactions for CSV/PDF exports
  useEffect(() => {
    let cancelled = false;
    setExpensesLoading(true);
    fetchTransactions({ type: 'expense', dateFrom: range.start, dateTo: range.end })
      .then((result) => {
        if (!cancelled) {
          setExpenseTransactions(result.transactions);
          setExpensesLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [range]);

  // Auto-fetch financial summary (no AI) when range changes
  useEffect(() => {
    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAiInsights(null); // Clear previous AI insights

    const analyzeReport = httpsCallable<
      { startDate: string; endDate: string; skipAi?: boolean },
      AnalyzeReportResponse
    >(functions, 'onAnalyzeReport');

    analyzeReport({
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
      skipAi: true,
    })
      .then((result) => {
        if (!cancelled) {
          setAnalysisData(result.data.summary);
          setAnalysisLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Report analysis failed:', err);
          setAnalysisError('Failed to load financial data.');
          setAnalysisLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [range]);

  const [aiLoading, setAiLoading] = useState(false);

  const handleAiAnalyze = useCallback(async () => {
    setAiLoading(true);
    setAnalysisError(null);

    const analyzeReport = httpsCallable<
      { startDate: string; endDate: string },
      AnalyzeReportResponse
    >(functions, 'onAnalyzeReport');

    try {
      const result = await analyzeReport({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
      setAnalysisData(result.data.summary);
      setAiInsights(result.data.aiInsights);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAnalysisError('AI analysis failed. Try again.');
    } finally {
      setAiLoading(false);
    }
  }, [range]);

  // --- Export handlers (preserved from original) ---

  const handleExportAll = useCallback(async () => {
    setCombinedLoading(true);
    try {
      await generateCombinedReportPdf(workItems, clients, range, expenseTransactions);
    } catch (err) {
      console.error('Combined PDF generation failed:', err);
    } finally {
      setCombinedLoading(false);
    }
  }, [workItems, clients, range, expenseTransactions]);

  const generateReport = useCallback(
    async (reportType: ReportType) => {
      setPdfLoading(reportType);
      try {
        await generateReportPdf(reportType, workItems, clients, range, expenseTransactions);
      } catch (err) {
        console.error('PDF generation failed:', err);
      } finally {
        setPdfLoading(null);
      }
    },
    [workItems, clients, range, expenseTransactions]
  );

  const handleCsvProfitLoss = useCallback(() => {
    setCsvLoading('profit_loss');
    const monthly = getMonthlyRevenue(workItems, 12, now);
    exportToCsv(
      `Profit_and_Loss_${preset.toUpperCase()}.csv`,
      ['Month', 'Revenue'],
      monthly.map((m) => [m.month, m.revenue.toFixed(2)])
    );
    setCsvLoading(null);
  }, [workItems, preset, now]);

  const handleCsvIncomeByClient = useCallback(() => {
    setCsvLoading('income_by_client');
    const byClient = getRevenueByClient(workItems, clients, range);
    exportToCsv(
      `Income_by_Client_${preset.toUpperCase()}.csv`,
      ['Client', 'Revenue', 'Work Orders'],
      byClient.map((c) => [c.clientName, c.revenue.toFixed(2), String(c.count)])
    );
    setCsvLoading(null);
  }, [workItems, clients, range, preset]);

  const handleCsvTaxSummary = useCallback(() => {
    setCsvLoading('tax_summary');
    const byClient = getRevenueByClient(workItems, clients, range);
    const totalRevenue = byClient.reduce((sum, c) => sum + c.revenue, 0);
    exportToCsv(
      `Tax_Summary_${preset.toUpperCase()}.csv`,
      ['Client', 'Revenue'],
      [
        ...byClient.map((c) => [c.clientName, c.revenue.toFixed(2)]),
        ['TOTAL', totalRevenue.toFixed(2)],
      ]
    );
    setCsvLoading(null);
  }, [workItems, clients, range, preset]);

  const handleCsvHoursBilling = useCallback(() => {
    setCsvLoading('hours_billing');
    const byType = getRevenueByType(workItems, range);
    exportToCsv(
      `Hours_and_Billing_${preset.toUpperCase()}.csv`,
      ['Type', 'Revenue', 'Work Orders'],
      byType.map((t) => [t.type, t.revenue.toFixed(2), String(t.count)])
    );
    setCsvLoading(null);
  }, [workItems, range, preset]);

  const handleCsvAging = useCallback(() => {
    setCsvLoading('aging');
    const buckets = getAgingBuckets(workItems, now);
    exportToCsv(
      `Aging_Report_${preset.toUpperCase()}.csv`,
      ['Bucket', 'Amount'],
      [
        ['Current (not yet due)', buckets.current.toFixed(2)],
        ['1-30 days past due', buckets.days1to30.toFixed(2)],
        ['31-60 days past due', buckets.days31to60.toFixed(2)],
        ['60+ days past due', buckets.days60plus.toFixed(2)],
      ]
    );
    setCsvLoading(null);
  }, [workItems, now, preset]);

  const handleCsvExpense = useCallback(() => {
    setCsvLoading('expense');
    exportToCsv(
      'Expense_Report.csv',
      ['Date', 'Description', 'Category', 'Amount', 'Tax Deductible'],
      expenseTransactions.map((t) => [
        formatDate(t.date),
        t.description,
        t.category,
        formatCurrency(Math.abs(t.amount)),
        t.taxDeductible ? 'Yes' : 'No',
      ])
    );
    setCsvLoading(null);
  }, [expenseTransactions]);

  const hasData = analysisData && (
    analysisData.totalRevenue > 0 ||
    analysisData.totalExpenses > 0 ||
    analysisData.workOrderCount > 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="hidden md:block">
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Reports</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Financial overview, trends, and AI-powered analysis
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <DateRangeSelector value={preset} onChange={setPreset} />
          <button
            onClick={handleExportAll}
            disabled={combinedLoading}
            className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg bg-[var(--text-primary)] text-[var(--bg-page)] hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {combinedLoading ? 'Generating...' : 'Export All (PDF)'}
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      {analysisLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
              <div className="h-3 w-16 bg-[var(--border)] rounded mb-2" />
              <div className="h-6 w-24 bg-[var(--border)] rounded" />
            </div>
          ))}
        </div>
      ) : analysisData ? (
        <KpiRow
          totalRevenue={analysisData.totalRevenue}
          totalExpenses={analysisData.totalExpenses}
          netIncome={analysisData.netIncome}
          workOrderCount={analysisData.workOrderCount}
          avgWorkOrderValue={analysisData.avgWorkOrderValue}
        />
      ) : null}

      {/* Charts Grid */}
      {analysisLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
              <div className="h-3 w-32 bg-[var(--border)] rounded mb-4" />
              <div className="h-[220px] bg-[var(--border)] rounded" />
            </div>
          ))}
        </div>
      ) : hasData && analysisData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenueExpenseTrend
            revenueByMonth={analysisData.revenueByMonth}
            expensesByMonth={analysisData.expensesByMonth}
          />
          <ExpenseBreakdown expensesByCategory={analysisData.expensesByCategory} />
          <NetIncomeTrend
            revenueByMonth={analysisData.revenueByMonth}
            expensesByMonth={analysisData.expensesByMonth}
          />
          <RevenueByClient data={analysisData.revenueByClient} />
        </div>
      ) : !analysisLoading && analysisData ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No financial data found for this period. Try a different date range or add transactions.
          </p>
        </div>
      ) : null}

      {/* AI Analysis */}
      {aiInsights ? (
        <AiReportInsights insights={aiInsights} />
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                <IconSparkle size={14} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Analysis</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Get AI-powered insights, trends, and recommendations
                </p>
              </div>
            </div>
            <button
              onClick={handleAiAnalyze}
              disabled={aiLoading || analysisLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconSparkle size={12} color="white" />
              {aiLoading ? 'Analyzing...' : 'AI Analyze'}
            </button>
          </div>
          {aiLoading && (
            <div className="mt-4">
              <AiInsightsSkeleton />
            </div>
          )}
          {analysisError && (
            <p className="text-sm text-red-500 mt-3">{analysisError}</p>
          )}
        </div>
      )}

      {/* Export Reports */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
          Export Reports
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard
            title="Profit & Loss"
            description="Revenue, expenses, and net income broken down by period."
            onExportCsv={handleCsvProfitLoss}
            onExportPdf={() => generateReport('profit_loss')}
            csvLoading={csvLoading === 'profit_loss'}
            pdfLoading={pdfLoading === 'profit_loss'}
            pdfDisabled={expensesLoading}
          />
          <ReportCard
            title="Income by Client"
            description="1099-ready revenue breakdown per client for the selected period."
            onExportCsv={handleCsvIncomeByClient}
            onExportPdf={() => generateReport('income_by_client')}
            csvLoading={csvLoading === 'income_by_client'}
            pdfLoading={pdfLoading === 'income_by_client'}
          />
          <ReportCard
            title="Tax Summary"
            description="Annual income, categorized expenses, and estimated quarterly tax obligations."
            onExportCsv={handleCsvTaxSummary}
            onExportPdf={() => generateReport('tax_summary')}
            csvLoading={csvLoading === 'tax_summary'}
            pdfLoading={pdfLoading === 'tax_summary'}
            pdfDisabled={expensesLoading}
          />
          <ReportCard
            title="Hours & Billing"
            description="Hours worked, effective hourly rate, and billable vs non-billable time."
            onExportCsv={handleCsvHoursBilling}
            onExportPdf={() => generateReport('hours_billing')}
            csvLoading={csvLoading === 'hours_billing'}
            pdfLoading={pdfLoading === 'hours_billing'}
          />
          <ReportCard
            title="Aging Report"
            description="Outstanding invoices grouped by age bucket to track overdue receivables."
            onExportCsv={handleCsvAging}
            onExportPdf={() => generateReport('aging')}
            csvLoading={csvLoading === 'aging'}
            pdfLoading={pdfLoading === 'aging'}
          />
          <ReportCard
            title="Expense Report"
            description="All expenses organized by category for reimbursement and tax deductions."
            onExportCsv={handleCsvExpense}
            onExportPdf={() => generateReport('expense')}
            csvLoading={csvLoading === 'expense'}
            pdfLoading={pdfLoading === 'expense'}
            pdfDisabled={expensesLoading}
          />
        </div>
      </div>
    </div>
  );
}
