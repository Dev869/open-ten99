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

interface ReportCardProps {
  title: string;
  description: string;
  comingSoon?: boolean;
  onExportCsv: () => void;
  onExportPdf: () => void;
  csvLoading?: boolean;
  pdfLoading?: boolean;
  pdfDisabled?: boolean;
}

function ReportCard({
  title,
  description,
  comingSoon,
  onExportCsv,
  onExportPdf,
  csvLoading,
  pdfLoading,
  pdfDisabled,
}: ReportCardProps) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[var(--text-primary)] text-sm">{title}</h3>
          {comingSoon && (
            <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
              Phase 3
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onExportCsv}
          disabled={csvLoading}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {csvLoading ? 'Exporting…' : 'CSV'}
        </button>
        <button
          onClick={onExportPdf}
          disabled={pdfLoading || comingSoon || pdfDisabled}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pdfLoading ? 'Generating…' : 'PDF'}
        </button>
      </div>
    </div>
  );
}

export default function Reports({ workItems, clients }: { workItems: WorkItem[]; clients: Client[] }) {
  const now = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<DateRangePreset>('ytd');
  const range = useMemo(() => getDateRange(preset, now), [preset, now]);

  const [pdfLoading, setPdfLoading] = useState<ReportType | null>(null);
  const [csvLoading, setCsvLoading] = useState<ReportType | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);

  const [expenseTransactions, setExpenseTransactions] = useState<Transaction[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

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
        ['1–30 days past due', buckets.days1to30.toFixed(2)],
        ['31–60 days past due', buckets.days31to60.toFixed(2)],
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Reports</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Export financial data for accounting and tax purposes
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

      {/* Report cards grid */}
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
  );
}
