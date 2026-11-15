import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download, FileSpreadsheet, Save } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { Defect, TestCase } from '../../types.ts';

interface ReportPreview {
  snapshot: {
    totalTestCases: number;
    passed: number;
    failed: number;
    blocked: number;
    notExecuted: number;
    executionRate: number;
    passRate: number;
    totalDefects: number;
    openDefects: number;
    severitySummary: Record<string, number>;
    moduleBreakdown: {
      module: string;
      total: number;
      passed: number;
      failed: number;
      blocked: number;
      notExecuted: number;
      defects: number;
    }[];
    executionsRecorded: number;
  };
  testCases: TestCase[];
  defects: Defect[];
}

function escapeCsv(val: any): string {
  const s = String(val ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MODULES = [
  'All',
  'Authentication',
  'Home',
  'Stores',
  'Products',
  'Cart',
  'Checkout',
  'Orders',
  'Delivery',
  'Database',
  'Security',
  'API',
  'Performance',
];

export function QaReportsView() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [title, setTitle] = useState('GroceryGo STQA Execution & Quality Summary');
  const [observations, setObservations] = useState('');
  const [qualityAssessment, setQualityAssessment] = useState('Ready for Release Review');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (moduleFilter !== 'All') params.set('module', moduleFilter);

    const [prevRes, histRes] = await Promise.all([
      apiRequest<ReportPreview>(`/api/stqa/reports/preview?${params.toString()}`),
      apiRequest<{ reports: any[] }>('/api/stqa/reports'),
    ]);
    setPreview(prevRes);
    setSavedReports(histRes.reports);
  };

  useEffect(() => {
    load();
  }, [dateFrom, dateTo, moduleFilter]);

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setSaving(true);
    setMsg('');
    try {
      await apiRequest('/api/stqa/reports', {
        method: 'POST',
        body: JSON.stringify({
          title,
          dateFrom,
          dateTo,
          moduleFilter,
          summarySnapshot: preview.snapshot,
          observations,
          qualityAssessment,
        }),
      });
      setMsg('QA Report snapshot saved in MongoDB.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!preview) return;
    const { snapshot } = preview;
    const doc = new jsPDF();
    let y = 18;

    doc.setFontSize(16);
    doc.text(title || 'GroceryGo STQA Quality Report', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Module: ${moduleFilter} | Date Range: ${
        dateFrom || 'All'
      } to ${dateTo || 'All'}`,
      14,
      y
    );
    y += 10;

    doc.setFontSize(12);
    doc.text('1. Test Execution Summary', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(
      `Total Cases: ${snapshot.totalTestCases} | Passed: ${snapshot.passed} | Failed: ${snapshot.failed} | Blocked: ${snapshot.blocked} | Not Executed: ${snapshot.notExecuted}`,
      14,
      y
    );
    y += 6;
    doc.text(
      `Execution Rate: ${snapshot.executionRate}% | Pass Rate: ${snapshot.passRate}% | Executions Logged: ${snapshot.executionsRecorded}`,
      14,
      y
    );
    y += 10;

    doc.setFontSize(12);
    doc.text('2. Defect Summary', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(
      `Total Defects: ${snapshot.totalDefects} | Open: ${snapshot.openDefects} | Critical: ${snapshot.severitySummary.Critical} | Major: ${snapshot.severitySummary.Major} | Minor: ${snapshot.severitySummary.Minor} | Trivial: ${snapshot.severitySummary.Trivial}`,
      14,
      y
    );
    y += 10;

    doc.setFontSize(12);
    doc.text('3. Module-Wise Breakdown', 14, y);
    y += 7;
    doc.setFontSize(9);
    for (const row of snapshot.moduleBreakdown) {
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
      doc.text(
        `${row.module}: Total=${row.total}, Passed=${row.passed}, Failed=${row.failed}, Blocked=${row.blocked}, NotExec=${row.notExecuted}, Defects=${row.defects}`,
        14,
        y
      );
      y += 5.5;
    }

    y += 6;
    if (y > 260) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(12);
    doc.text('4. QA Observations & Assessment', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`Assessment: ${qualityAssessment}`, 14, y);
    y += 6;
    if (observations.trim()) {
      const splitObs = doc.splitTextToSize(observations.trim(), 180);
      doc.text(splitObs, 14, y);
    }

    doc.save(`GroceryGo_STQA_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportTestCasesCsv = () => {
    if (!preview) return;
    const headers = [
      'Test Case ID',
      'Module',
      'Title',
      'Priority',
      'Status',
      'Expected Result',
      'Actual Result',
    ];
    const rows = preview.testCases.map((tc) =>
      [
        tc.testCaseId,
        tc.module,
        tc.title,
        tc.priority,
        tc.status,
        tc.expectedResult,
        tc.actualResult,
      ]
        .map(escapeCsv)
        .join(',')
    );
    downloadBlob(
      [headers.map(escapeCsv).join(','), ...rows].join('\n'),
      'grocerygo_test_cases.csv',
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportDefectsCsv = () => {
    if (!preview) return;
    const headers = [
      'Defect ID',
      'Module',
      'Title',
      'Severity',
      'Priority',
      'Status',
      'Assigned To',
      'Reported Date',
    ];
    const rows = preview.defects.map((d) =>
      [
        d.defectId,
        d.module,
        d.title,
        d.severity,
        d.priority,
        d.status,
        d.assignedTo,
        new Date(d.reportedDate).toISOString().slice(0, 10),
      ]
        .map(escapeCsv)
        .join(',')
    );
    downloadBlob(
      [headers.map(escapeCsv).join(','), ...rows].join('\n'),
      'grocerygo_defects.csv',
      'text/csv;charset=utf-8;'
    );
  };

  const snap = preview?.snapshot;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">QA Reports & Exports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dynamically generated quality reports backed strictly by stored MongoDB execution and defect records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleExportTestCasesCsv}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Test Cases CSV
          </button>
          <button
            type="button"
            onClick={handleExportDefectsCsv}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-red-600" />
            Defects CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Module Filter</label>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            {MODULES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {snap && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Total Cases</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">{snap.totalTestCases}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Passed</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {snap.passed}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Failed</div>
              <div className="text-xl font-bold font-mono tabular-nums text-red-600 mt-1">
                {snap.failed}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Blocked</div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                {snap.blocked}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Not Executed</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-600 mt-1">
                {snap.notExecuted}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Execution %</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">
                {snap.executionRate}%
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-500">Pass %</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {snap.passRate}%
              </div>
            </div>
          </div>

          {/* Module Breakdown Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-bold text-slate-900">
              Module-Wise Testing Results & Defect Distribution
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Module</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Total</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Passed</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Failed</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Blocked</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Not Exec</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Defects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums text-xs">
                {snap.moduleBreakdown.map((m) => (
                  <tr key={m.module}>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">{m.module}</td>
                    <td className="py-2.5 px-4 text-right">{m.total}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-700">{m.passed}</td>
                    <td className="py-2.5 px-4 text-right text-red-600">{m.failed}</td>
                    <td className="py-2.5 px-4 text-right text-amber-700">{m.blocked}</td>
                    <td className="py-2.5 px-4 text-right text-slate-500">{m.notExecuted}</td>
                    <td className="py-2.5 px-4 text-right font-bold">{m.defects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Save Report Form */}
          <form
            onSubmit={handleSaveReport}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h2 className="text-sm font-bold text-slate-900">
              Save QA Report Snapshot to MongoDB
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Report Title"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <select
                value={qualityAssessment}
                onChange={(e) => setQualityAssessment(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option>Ready for Release Review</option>
                <option>Conditional Pass — Minor Defects Open</option>
                <option>Hold Release — Critical Defects Pending</option>
                <option>Testing In Progress</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Testing observations, risk notes, and sign-off commentary..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Report Snapshot'}
            </button>
          </form>

          {savedReports.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Saved QA Report History</h3>
              <div className="divide-y divide-slate-200 text-xs">
                {savedReports.map((r) => (
                  <div key={r._id} className="py-2.5 flex justify-between gap-4">
                    <div>
                      <span className="font-mono font-bold text-slate-900 mr-2">{r.reportId}</span>
                      <span className="font-semibold text-slate-800">{r.title}</span>
                      <span className="text-slate-500 ml-2">({r.qualityAssessment})</span>
                    </div>
                    <div className="text-slate-500 tabular-nums shrink-0">
                      Pass {r.summarySnapshot?.passRate ?? 0}% · {r.generatedByName} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
