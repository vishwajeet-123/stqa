import { useEffect, useState } from 'react';
import { Bot, Bug, CheckCircle2, Play, Upload, XCircle } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { TestCase, TestExecution } from '../../types.ts';

interface Props {
  preselectedCase: TestCase | null;
  onReportDefectFromExecution: (tc: TestCase, execution: TestExecution) => void;
  onDataChanged: () => void;
}

export function TestExecutionView({
  preselectedCase,
  onReportDefectFromExecution,
  onDataChanged,
}: Props) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedId, setSelectedId] = useState<string>(preselectedCase?._id || '');
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [manualStatus, setManualStatus] = useState<'Passed' | 'Failed' | 'Blocked'>('Passed');
  const [actualResult, setActualResult] = useState('');
  const [comments, setComments] = useState('');
  const [evidenceScreenshot, setEvidenceScreenshot] = useState('');
  const [runningAuto, setRunningAuto] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [error, setError] = useState('');
  const [latestRun, setLatestRun] = useState<TestExecution | null>(null);

  const load = async () => {
    const [tcRes, exRes] = await Promise.all([
      apiRequest<{ testCases: TestCase[] }>('/api/stqa/test-cases'),
      apiRequest<{ executions: TestExecution[] }>('/api/stqa/test-executions'),
    ]);
    setTestCases(tcRes.testCases);
    setExecutions(exRes.executions);
    if (!selectedId && tcRes.testCases.length > 0) {
      setSelectedId(preselectedCase?._id || tcRes.testCases[0]._id);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (preselectedCase?._id) {
      setSelectedId(preselectedCase._id);
    }
  }, [preselectedCase]);

  const activeCase = testCases.find((t) => t._id === selectedId) || null;

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEvidenceScreenshot(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunPlaywright = async () => {
    if (!activeCase) return;
    setError('');
    setRunningAuto(true);
    setLatestRun(null);
    try {
      const res = await apiRequest<{ execution: TestExecution; testCase: TestCase }>(
        '/api/stqa/test-executions/automated',
        {
          method: 'POST',
          body: JSON.stringify({ testCaseId: activeCase._id }),
        }
      );
      setLatestRun(res.execution);
      await load();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Playwright execution failed.');
    } finally {
      setRunningAuto(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;
    setError('');
    setSavingManual(true);
    try {
      const res = await apiRequest<{ execution: TestExecution }>('/api/stqa/test-executions/manual', {
        method: 'POST',
        body: JSON.stringify({
          testCaseId: activeCase._id,
          status: manualStatus,
          actualResult,
          comments,
          evidenceScreenshot,
        }),
      });
      setLatestRun(res.execution);
      setActualResult('');
      setComments('');
      setEvidenceScreenshot('');
      await load();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to record execution.');
    } finally {
      setSavingManual(false);
    }
  };

  const caseHistory = activeCase
    ? executions.filter((ex) => {
        const eid = typeof ex.testCaseId === 'object' ? ex.testCaseId._id : ex.testCaseId;
        return eid === activeCase._id;
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Test Execution Workbench</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Execute real Playwright browser automation or record observed manual results against GroceryGo
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Test Case Selector */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            Select Test Case ({testCases.length})
          </div>
          <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-200">
            {testCases.map((tc) => (
              <button
                key={tc._id}
                type="button"
                onClick={() => {
                  setSelectedId(tc._id);
                  setLatestRun(null);
                  setError('');
                }}
                className={`w-full text-left p-3.5 transition-colors ${
                  selectedId === tc._id ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {tc.testCaseId}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      tc.status === 'Passed'
                        ? 'text-emerald-700'
                        : tc.status === 'Failed'
                        ? 'text-red-600'
                        : tc.status === 'Blocked'
                        ? 'text-amber-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {tc.status}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-800 mt-1 line-clamp-1">
                  {tc.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {tc.module} {tc.automationKey ? '· Playwright Ready' : '· Manual'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Execution Panel */}
        <div className="lg:col-span-8 space-y-6">
          {activeCase && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="text-xs font-mono text-slate-500">
                      {activeCase.testCaseId} · {activeCase.module} · Priority: {activeCase.priority}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">{activeCase.title}</h2>
                    <p className="text-sm text-slate-600 mt-1">{activeCase.testScenario}</p>
                  </div>

                  {activeCase.automationKey && (
                    <button
                      type="button"
                      disabled={runningAuto}
                      onClick={handleRunPlaywright}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Bot className="w-4 h-4 text-emerald-400" />
                      {runningAuto ? 'Running Chromium...' : 'Execute Automated Test (Playwright)'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-semibold text-slate-800 mb-1">Preconditions</div>
                    <p className="text-slate-600">{activeCase.preconditions}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-semibold text-slate-800 mb-1">Test Data</div>
                    <p className="font-mono text-slate-700">{activeCase.testData || 'Standard seeded data'}</p>
                  </div>
                </div>

                <div className="text-sm">
                  <div className="font-semibold text-slate-800 mb-1.5">Test Steps</div>
                  <ol className="list-decimal pl-5 space-y-1 text-slate-600 text-xs">
                    {activeCase.testSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs">
                  <span className="font-semibold text-emerald-900">Expected Result: </span>
                  <span className="text-emerald-800">{activeCase.expectedResult}</span>
                </div>
              </div>

              {/* Latest Execution Output (Playwright Screenshot + Logs) */}
              {latestRun && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {latestRun.status === 'Passed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <h3 className="font-bold text-slate-900">
                        Execution Result: {latestRun.status} ({latestRun.executionMode})
                      </h3>
                    </div>
                    {latestRun.status !== 'Passed' && (
                      <button
                        type="button"
                        onClick={() => onReportDefectFromExecution(activeCase, latestRun)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Bug className="w-3.5 h-3.5" />
                        Report Defect
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{latestRun.actualResult}</p>
                  {latestRun.logs?.length > 0 && (
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
                      {latestRun.logs.join('\n')}
                    </pre>
                  )}
                  {latestRun.evidenceScreenshot && (
                    <div>
                      <div className="text-xs font-semibold text-slate-600 mb-1.5">
                        Captured Browser Evidence Screenshot
                      </div>
                      <img
                        src={latestRun.evidenceScreenshot}
                        alt={`Screenshot evidence for ${activeCase.testCaseId}`}
                        className="rounded-lg border border-slate-200 max-h-72 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Manual Execution Form */}
              <form
                onSubmit={handleSaveManual}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">Record Manual Execution</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Execution Verdict
                    </label>
                    <select
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Passed">Passed</option>
                      <option value="Failed">Failed</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Attach Screenshot Evidence (Optional)
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 text-xs border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>{evidenceScreenshot ? 'Screenshot attached' : 'Upload PNG/JPG'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Observed Actual Result
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={actualResult}
                    onChange={(e) => setActualResult(e.target.value)}
                    placeholder="Describe the exact behaviour observed in GroceryGo..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Tester Comments
                  </label>
                  <input
                    type="text"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Environment notes or observations"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingManual}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                >
                  {savingManual ? 'Saving Execution...' : 'Save Manual Execution'}
                </button>
              </form>

              {/* Execution History for Selected Case */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Execution History for {activeCase.testCaseId} ({caseHistory.length})
                </h3>
                {caseHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">No executions recorded for this test case yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {caseHistory.map((ex) => (
                      <div key={ex._id} className="py-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-semibold ${
                              ex.status === 'Passed'
                                ? 'text-emerald-700'
                                : ex.status === 'Failed'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            {ex.status} · {ex.executionMode}
                          </span>
                          <span className="text-slate-500 tabular-nums">
                            {ex.executorName} · {new Date(ex.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-700">{ex.actualResult}</p>
                        {ex.status !== 'Passed' && (
                          <button
                            type="button"
                            onClick={() => onReportDefectFromExecution(activeCase, ex)}
                            className="text-red-600 hover:underline font-medium"
                          >
                            + Link New Defect Report
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
