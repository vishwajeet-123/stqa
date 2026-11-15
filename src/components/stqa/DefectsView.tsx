import { useEffect, useState } from 'react';
import { MessageSquare, Plus, Search, Upload, X } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { Defect, TestCase, TestExecution } from '../../types.ts';

interface Props {
  prefillFromExecution: { tc: TestCase; execution: TestExecution } | null;
  onClearPrefill: () => void;
  onDataChanged: () => void;
}

const DEFECT_STATUSES = ['Open', 'Assigned', 'In Progress', 'Fixed', 'Retest', 'Closed', 'Reopened'];
const SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial'];
const MODULES = [
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

export function DefectsView({ prefillFromExecution, onClearPrefill, onDataChanged }: Props) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const [form, setForm] = useState({
    title: '',
    module: 'Cart',
    description: '',
    stepsToReproduce: '',
    expectedResult: '',
    actualResult: '',
    severity: 'Major',
    priority: 'High',
    assignedTo: 'Elena Rostova (Dev)',
    linkedTestCaseId: '',
    linkedExecutionId: '',
    evidenceScreenshot: '',
  });

  const load = async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (severityFilter !== 'All') params.set('severity', severityFilter);
    if (statusFilter !== 'All') params.set('status', statusFilter);

    const [defRes, tcRes] = await Promise.all([
      apiRequest<{ defects: Defect[] }>(`/api/stqa/defects?${params.toString()}`),
      apiRequest<{ testCases: TestCase[] }>('/api/stqa/test-cases'),
    ]);
    setDefects(defRes.defects);
    setTestCases(tcRes.testCases);
    if (selectedDefect) {
      const refreshed = defRes.defects.find((d) => d._id === selectedDefect._id) || null;
      setSelectedDefect(refreshed);
    }
  };

  useEffect(() => {
    load();
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    if (prefillFromExecution) {
      const { tc, execution } = prefillFromExecution;
      setForm({
        title: `${tc.testCaseId} Failure: ${tc.title}`,
        module: tc.module,
        description: `Failure observed during ${execution.executionMode} execution of ${tc.testCaseId}.`,
        stepsToReproduce: tc.testSteps.join('\n'),
        expectedResult: tc.expectedResult,
        actualResult: execution.actualResult,
        severity: tc.priority === 'High' ? 'Critical' : 'Major',
        priority: tc.priority,
        assignedTo: 'Engineering Team',
        linkedTestCaseId: tc._id,
        linkedExecutionId: execution._id,
        evidenceScreenshot: execution.evidenceScreenshot || '',
      });
      setShowForm(true);
      onClearPrefill();
    }
  }, [prefillFromExecution]);

  const handleReportDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest<{ defect: Defect }>('/api/stqa/defects', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setSelectedDefect(res.defect);
      await load();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to report defect.');
    }
  };

  const handleStatusChange = async (nextStatus: string) => {
    if (!selectedDefect) return;
    setError('');
    try {
      const res = await apiRequest<{ defect: Defect }>(
        `/api/stqa/defects/${selectedDefect._id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus, note: statusNote }),
        }
      );
      setSelectedDefect(res.defect);
      setStatusNote('');
      await load();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Could not update defect status.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDefect || !commentText.trim()) return;
    try {
      const res = await apiRequest<{ defect: Defect }>(
        `/api/stqa/defects/${selectedDefect._id}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ text: commentText }),
        }
      );
      setSelectedDefect(res.defect);
      setCommentText('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to add comment.');
    }
  };

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm({ ...form, evidenceScreenshot: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Defect & Bug Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track defects linked to failed test cases with full status audit history and retest gating
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({
              title: '',
              module: 'Cart',
              description: '',
              stepsToReproduce: '',
              expectedResult: '',
              actualResult: '',
              severity: 'Major',
              priority: 'High',
              assignedTo: 'Engineering Team',
              linkedTestCaseId: '',
              linkedExecutionId: '',
              evidenceScreenshot: '',
            });
            setShowForm(true);
          }}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Report Defect
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load();
            }}
            placeholder="Search BUG ID or title..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="All">Severity: All</option>
          {SEVERITIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="All">Status: All</option>
          {DEFECT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          Apply
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Defects Table / List */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {defects.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No defects logged yet. Defects reported from failed test runs appear here.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {defects.map((bug) => (
                <button
                  key={bug._id}
                  type="button"
                  onClick={() => {
                    setSelectedDefect(bug);
                    setError('');
                  }}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedDefect?._id === bug._id ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {bug.defectId} · {bug.module}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        bug.severity === 'Critical'
                          ? 'text-red-700'
                          : bug.severity === 'Major'
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {bug.severity} · {bug.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{bug.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Assigned: {bug.assignedTo}
                    {bug.linkedTestCaseId && ` · Linked: ${bug.linkedTestCaseId.testCaseId}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Defect Detail Panel */}
        <div className="lg:col-span-6">
          {selectedDefect ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="border-b border-slate-200 pb-4">
                <div className="text-xs font-mono text-slate-500">
                  {selectedDefect.defectId} · {selectedDefect.module} · Severity:{' '}
                  {selectedDefect.severity} · Priority: {selectedDefect.priority}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedDefect.title}</h2>
                <div className="text-xs text-slate-500 mt-1">
                  Reported by {selectedDefect.reportedByName} on{' '}
                  {new Date(selectedDefect.reportedDate).toLocaleDateString()} · Assigned to{' '}
                  <strong>{selectedDefect.assignedTo}</strong>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-800">Description</div>
                  <p className="text-slate-600 mt-0.5">{selectedDefect.description}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Steps to Reproduce</div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-600 mt-0.5">
                    {selectedDefect.stepsToReproduce}
                  </pre>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <div className="font-semibold text-emerald-900">Expected Result</div>
                    <p className="text-emerald-800 mt-0.5">{selectedDefect.expectedResult}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50/50 border border-red-200">
                    <div className="font-semibold text-red-900">Actual Result</div>
                    <p className="text-red-800 mt-0.5">{selectedDefect.actualResult}</p>
                  </div>
                </div>
                {selectedDefect.linkedTestCaseId && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    Linked Test Case:{' '}
                    <strong className="font-mono">{selectedDefect.linkedTestCaseId.testCaseId}</strong>{' '}
                    ({selectedDefect.linkedTestCaseId.status})
                  </div>
                )}
                {selectedDefect.evidenceScreenshot && (
                  <img
                    src={selectedDefect.evidenceScreenshot}
                    alt={`Defect ${selectedDefect.defectId} screenshot`}
                    className="rounded-lg border border-slate-200 max-h-56 object-contain"
                  />
                )}
              </div>

              {/* Status Workflow Transition */}
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  Update Defect Status (Current: {selectedDefect.status})
                </div>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional transition note (e.g. Fix deployed, ready for retest)..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <div className="flex flex-wrap gap-1.5">
                  {DEFECT_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={selectedDefect.status === st}
                      onClick={() => handleStatusChange(st)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        selectedDefect.status === st
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status History */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800">Status History</div>
                <div className="space-y-1.5 text-xs">
                  {selectedDefect.statusHistory.map((h, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>
                        <strong>{h.status}</strong> — {h.note || 'Updated'} ({h.changedBy})
                      </span>
                      <span className="tabular-nums text-slate-400">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Discussion ({selectedDefect.comments.length})
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedDefect.comments.map((c, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-800">
                        {c.authorName} ·{' '}
                        <span className="font-normal text-slate-500">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-0.5">{c.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a QA/dev comment..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                  >
                    Post
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Select a defect from the list to view details, update lifecycle status, or post comments.
            </div>
          )}
        </div>
      </div>

      {/* Report Defect Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleReportDefect}
            className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Report New Defect</h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Defect Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Module</label>
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {MODULES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
                <input
                  type="text"
                  value={form.assignedTo}
                  onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Link to Failed Test Case (Optional)
              </label>
              <select
                value={form.linkedTestCaseId}
                onChange={(e) => setForm({ ...form, linkedTestCaseId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">None</option>
                {testCases.map((tc) => (
                  <option key={tc._id} value={tc._id}>
                    {tc.testCaseId} — {tc.title} ({tc.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea
                rows={2}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Steps to Reproduce
              </label>
              <textarea
                rows={3}
                required
                value={form.stepsToReproduce}
                onChange={(e) => setForm({ ...form, stepsToReproduce: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Expected Result
                </label>
                <textarea
                  rows={2}
                  required
                  value={form.expectedResult}
                  onChange={(e) => setForm({ ...form, expectedResult: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Actual Result
                </label>
                <textarea
                  rows={2}
                  required
                  value={form.actualResult}
                  onChange={(e) => setForm({ ...form, actualResult: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{form.evidenceScreenshot ? 'Screenshot attached' : 'Attach Screenshot'}</span>
                <input type="file" accept="image/*" onChange={handleScreenshot} className="hidden" />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg"
              >
                Submit Defect
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
