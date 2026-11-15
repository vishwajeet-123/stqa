import { useEffect, useState } from 'react';
import { AlertTriangle, Link2, Plus, X } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { RtmRow, TestCase } from '../../types.ts';

export function RtmView() {
  const [matrix, setMatrix] = useState<RtmRow[]>([]);
  const [summary, setSummary] = useState({
    totalRequirements: 0,
    mappedRequirements: 0,
    uncoveredRequirements: 0,
    passedRequirements: 0,
    mappingCoveragePercent: 0,
  });
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingReq, setEditingReq] = useState<RtmRow | null>(null);
  const [selectedTcIds, setSelectedTcIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    module: 'Authentication',
    priority: 'High',
  });

  const load = async () => {
    const [rtmRes, tcRes] = await Promise.all([
      apiRequest<{ matrix: RtmRow[]; summary: any }>('/api/stqa/rtm'),
      apiRequest<{ testCases: TestCase[] }>('/api/stqa/test-cases'),
    ]);
    setMatrix(rtmRes.matrix);
    setSummary(rtmRes.summary);
    setTestCases(tcRes.testCases);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateReq = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/stqa/rtm', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setForm({ title: '', description: '', module: 'Authentication', priority: 'High' });
    setShowNew(false);
    await load();
  };

  const handleSaveLinks = async () => {
    if (!editingReq) return;
    await apiRequest(`/api/stqa/rtm/${editingReq._id}/link`, {
      method: 'PATCH',
      body: JSON.stringify({ linkedTestCaseIds: selectedTcIds }),
    });
    setEditingReq(null);
    await load();
  };

  const uncovered = matrix.filter((r) => r.linkedTestCaseIds.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requirements Traceability Matrix (RTM)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dynamic forward & backward traceability across requirements, test cases, and defects
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Add Requirement
        </button>
      </div>

      {/* Coverage KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Requirements</div>
          <div className="text-2xl font-extrabold font-mono tabular-nums mt-1">
            {summary.totalRequirements}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Mapped Coverage</div>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-700 mt-1">
            {summary.mappingCoveragePercent}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Fully Passed Requirements</div>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-1">
            {summary.passedRequirements}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Uncovered Gaps</div>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-amber-700 mt-1">
            {summary.uncoveredRequirements}
          </div>
        </div>
      </div>

      {uncovered.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <strong>Uncovered Requirements Detected:</strong>{' '}
            {uncovered.map((u) => `${u.reqId} (${u.title})`).join(', ')} currently have no linked
            test cases. Click "Link Cases" to close traceability gaps.
          </div>
        </div>
      )}

      {showNew && (
        <form
          onSubmit={handleCreateReq}
          className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            type="text"
            required
            placeholder="Requirement Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            required
            placeholder="Module (e.g. Cart)"
            value={form.module}
            onChange={(e) => setForm({ ...form, module: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            required
            placeholder="Requirement Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
          >
            Save Requirement
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <tr>
              <th className="py-3 px-4 font-semibold">REQ ID</th>
              <th className="py-3 px-4 font-semibold">Requirement Description</th>
              <th className="py-3 px-4 font-semibold">Module</th>
              <th className="py-3 px-4 font-semibold">Linked Test Cases & Status</th>
              <th className="py-3 px-4 font-semibold">Defects</th>
              <th className="py-3 px-4 font-semibold">Coverage</th>
              <th className="py-3 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {matrix.map((row) => (
              <tr key={row._id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                  {row.reqId}
                </td>
                <td className="py-3 px-4 max-w-sm">
                  <div className="font-semibold text-slate-900">{row.title}</div>
                  <div className="text-xs text-slate-500">{row.description}</div>
                </td>
                <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{row.module}</td>
                <td className="py-3 px-4 text-xs">
                  {row.linkedTestCaseIds.length === 0 ? (
                    <span className="text-amber-700 font-medium">No test cases linked</span>
                  ) : (
                    <div className="space-y-0.5">
                      {row.linkedTestCaseIds.map((tc) => (
                        <div key={tc._id} className="font-mono text-slate-700">
                          {tc.testCaseId} ·{' '}
                          <span
                            className={
                              tc.status === 'Passed'
                                ? 'text-emerald-700'
                                : tc.status === 'Failed'
                                ? 'text-red-600'
                                : 'text-slate-500'
                            }
                          >
                            {tc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-xs font-mono">
                  {row.linkedDefects.length === 0
                    ? '—'
                    : row.linkedDefects.map((d) => `${d.defectId} (${d.status})`).join(', ')}
                </td>
                <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                  <span
                    className={
                      row.coverageStatus === 'Fully Passed'
                        ? 'text-emerald-700'
                        : row.coverageStatus === 'Failed'
                        ? 'text-red-600'
                        : row.coverageStatus === 'Uncovered'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }
                  >
                    {row.coverageStatus}
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReq(row);
                      setSelectedTcIds(row.linkedTestCaseIds.map((c) => c._id));
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link Cases
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Link Cases Modal */}
      {editingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Link Test Cases to {editingReq.reqId}: {editingReq.title}
              </h3>
              <button type="button" onClick={() => setEditingReq(null)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {testCases.map((tc) => {
                const checked = selectedTcIds.includes(tc._id);
                return (
                  <label
                    key={tc._id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedTcIds((prev) =>
                          checked ? prev.filter((id) => id !== tc._id) : [...prev, tc._id]
                        );
                      }}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span className="font-mono font-semibold text-slate-900">{tc.testCaseId}</span>
                    <span className="text-slate-700">{tc.title}</span>
                  </label>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingReq(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLinks}
                className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
              >
                Save Linkage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
