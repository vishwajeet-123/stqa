import { useEffect, useState } from 'react';
import { Edit3, Eye, Play, Plus, Search, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { TestCase, TestSuite } from '../../types.ts';

interface Props {
  onExecuteTestCase: (tc: TestCase) => void;
  onDataChanged: () => void;
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

export function TestCasesView({ onExecuteTestCase, onDataChanged }: Props) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [viewingCase, setViewingCase] = useState<TestCase | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    testCaseId: '',
    title: '',
    suiteId: '',
    module: 'Authentication',
    testScenario: '',
    preconditions: '',
    testSteps: '',
    testData: '',
    expectedResult: '',
    priority: 'High' as 'High' | 'Medium' | 'Low',
  });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (moduleFilter !== 'All') params.set('module', moduleFilter);
      if (priorityFilter !== 'All') params.set('priority', priorityFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);

      const [tcRes, suiteRes] = await Promise.all([
        apiRequest<{ testCases: TestCase[] }>(`/api/stqa/test-cases?${params.toString()}`),
        apiRequest<{ suites: TestSuite[] }>('/api/stqa/test-suites'),
      ]);
      setTestCases(tcRes.testCases);
      setSuites(suiteRes.suites);
    } catch (err: any) {
      setError(err.message || 'Failed to load test cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [moduleFilter, priorityFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      testCaseId: '',
      title: '',
      suiteId: suites[0]?._id || '',
      module: 'Authentication',
      testScenario: '',
      preconditions: 'Application running and MongoDB connected',
      testSteps: '1. Open target module\n2. Submit test input\n3. Verify expected output',
      testData: '',
      expectedResult: '',
      priority: 'High',
    });
    setShowForm(true);
  };

  const openEditModal = (tc: TestCase) => {
    setEditingId(tc._id);
    setForm({
      testCaseId: tc.testCaseId,
      title: tc.title,
      suiteId: typeof tc.suiteId === 'object' ? tc.suiteId._id : tc.suiteId,
      module: tc.module,
      testScenario: tc.testScenario,
      preconditions: tc.preconditions,
      testSteps: tc.testSteps.join('\n'),
      testData: tc.testData,
      expectedResult: tc.expectedResult,
      priority: tc.priority,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await apiRequest(`/api/stqa/test-cases/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest('/api/stqa/test-cases', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      await load();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save test case.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/stqa/test-cases/${id}`, { method: 'DELETE' });
      await load();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to delete test case.');
    }
  };

  const statusTone = (status: string) => {
    if (status === 'Passed') return 'text-emerald-700 font-semibold';
    if (status === 'Failed') return 'text-red-600 font-semibold';
    if (status === 'Blocked') return 'text-amber-700 font-semibold';
    return 'text-slate-500 font-medium';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Test Case Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create, organize, filter, and launch test cases against GroceryGo
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Test Case
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
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
            placeholder="Search TC ID, title, or scenario..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          {MODULES.map((m) => (
            <option key={m} value={m}>
              Module: {m}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="All">Priority: All</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="All">Status: All</option>
          <option value="Not Executed">Not Executed</option>
          <option value="Passed">Passed</option>
          <option value="Failed">Failed</option>
          <option value="Blocked">Blocked</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          Apply
        </button>
      </div>

      {/* Test Cases Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <tr>
              <th className="py-3 px-4 font-semibold">ID</th>
              <th className="py-3 px-4 font-semibold">Module</th>
              <th className="py-3 px-4 font-semibold">Title & Scenario</th>
              <th className="py-3 px-4 font-semibold">Priority</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Runner</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  Loading test cases from MongoDB...
                </td>
              </tr>
            ) : testCases.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No test cases match the active filters.
                </td>
              </tr>
            ) : (
              testCases.map((tc) => (
                <tr key={tc._id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {tc.testCaseId}
                  </td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{tc.module}</td>
                  <td className="py-3 px-4 max-w-md">
                    <div className="font-semibold text-slate-900">{tc.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-1">{tc.testScenario}</div>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-700">{tc.priority}</td>
                  <td className={`py-3 px-4 text-xs whitespace-nowrap ${statusTone(tc.status)}`}>
                    {tc.status}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {tc.automationKey ? 'Playwright + Manual' : 'Manual'}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onExecuteTestCase(tc)}
                        title="Execute Test Case"
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingCase(tc)}
                        title="View Details"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(tc)}
                        title="Edit Test Case"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tc._id)}
                        title="Delete Test Case"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Test Case Details Modal */}
      {viewingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {viewingCase.testCaseId} · {viewingCase.module} · Priority: {viewingCase.priority}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">{viewingCase.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingCase(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-slate-800">Test Scenario:</span>
                <p className="text-slate-600 mt-0.5">{viewingCase.testScenario}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Preconditions:</span>
                <p className="text-slate-600 mt-0.5">{viewingCase.preconditions}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Test Steps:</span>
                <ol className="list-decimal pl-5 text-slate-600 mt-1 space-y-1">
                  {viewingCase.testSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Test Data:</span>
                <p className="font-mono text-xs bg-slate-50 p-2 rounded border border-slate-200 mt-1">
                  {viewingCase.testData || 'N/A'}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Expected Result:</span>
                <p className="text-slate-600 mt-0.5">{viewingCase.expectedResult}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Latest Observed Actual Result:</span>
                <p className="text-slate-600 mt-0.5">
                  {viewingCase.actualResult || 'Not executed yet.'}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const tc = viewingCase;
                  setViewingCase(null);
                  onExecuteTestCase(tc);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                Open in Test Execution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Test Case Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? `Edit ${form.testCaseId}` : 'Create New Test Case'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Test Case ID (Optional)
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingId)}
                  value={form.testCaseId}
                  onChange={(e) => setForm({ ...form, testCaseId: e.target.value })}
                  placeholder="Auto e.g. TC-033"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Module</label>
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {MODULES.filter((m) => m !== 'All').map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Test Suite</label>
                <select
                  required
                  value={form.suiteId}
                  onChange={(e) => setForm({ ...form, suiteId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {suites.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Test Scenario</label>
              <textarea
                rows={2}
                required
                value={form.testScenario}
                onChange={(e) => setForm({ ...form, testScenario: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Preconditions
                </label>
                <textarea
                  rows={2}
                  value={form.preconditions}
                  onChange={(e) => setForm({ ...form, preconditions: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Test Data</label>
                <textarea
                  rows={2}
                  value={form.testData}
                  onChange={(e) => setForm({ ...form, testData: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Test Steps (one per line)
              </label>
              <textarea
                rows={3}
                required
                value={form.testSteps}
                onChange={(e) => setForm({ ...form, testSteps: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

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

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                {editingId ? 'Save Changes' : 'Create Test Case'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
