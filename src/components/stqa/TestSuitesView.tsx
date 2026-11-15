import { useEffect, useState } from 'react';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { TestCase, TestSuite } from '../../types.ts';

export function TestSuitesView({
  onExecuteTestCase,
  onDataChanged,
}: {
  onExecuteTestCase: (tc: TestCase) => void;
  onDataChanged: () => void;
}) {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [suiteCases, setSuiteCases] = useState<TestCase[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', moduleCategory: 'Custom' });
  const [error, setError] = useState('');

  const loadSuites = async () => {
    const res = await apiRequest<{ suites: TestSuite[] }>('/api/stqa/test-suites');
    setSuites(res.suites);
  };

  useEffect(() => {
    loadSuites();
  }, []);

  const loadSuiteCases = async (suite: TestSuite) => {
    setSelectedSuite(suite);
    const res = await apiRequest<{ testCases: TestCase[] }>(
      `/api/stqa/test-cases?suiteId=${suite._id}`
    );
    setSuiteCases(res.testCases);
  };

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/stqa/test-suites', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ name: '', description: '', moduleCategory: 'Custom' });
      setShowNew(false);
      await loadSuites();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to create suite.');
    }
  };

  const handleDeleteSuite = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/api/stqa/test-suites/${id}`, { method: 'DELETE' });
      if (selectedSuite?._id === id) setSelectedSuite(null);
      await loadSuites();
    } catch (err: any) {
      setError(err.message || 'Cannot delete suite.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Test Suites & Modules</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            12 core GroceryGo testing suites plus custom user-defined suites
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Create Custom Suite
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {showNew && (
        <form
          onSubmit={handleCreateSuite}
          className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            type="text"
            required
            placeholder="Suite Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            required
            placeholder="Module Category"
            value={form.moduleCategory}
            onChange={(e) => setForm({ ...form, moduleCategory: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            required
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
          >
            Save Suite
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suites.map((suite) => (
          <div
            key={suite._id}
            onClick={() => loadSuiteCases(suite)}
            className={`p-5 rounded-xl border bg-white cursor-pointer transition-all ${
              selectedSuite?._id === suite._id
                ? 'border-emerald-600 ring-1 ring-emerald-600'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-emerald-600 shrink-0" />
                <h2 className="font-bold text-sm text-slate-900">{suite.name}</h2>
              </div>
              {suite.isCustom && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSuite(suite._id);
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{suite.description}</p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs tabular-nums">
              <span className="text-slate-600">{suite.totalCases ?? 0} Test Cases</span>
              <span className="text-emerald-700 font-medium">{suite.passedCases ?? 0} Passed</span>
              <span className="text-red-600 font-medium">{suite.failedCases ?? 0} Failed</span>
            </div>
          </div>
        ))}
      </div>

      {selectedSuite && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            Assigned Test Cases — {selectedSuite.name}
          </h3>
          {suiteCases.length === 0 ? (
            <p className="text-sm text-slate-500">
              No test cases assigned to this suite yet. Create one in Test Cases and assign it here.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {suiteCases.map((tc) => (
                <div key={tc._id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      <span className="font-mono mr-2">{tc.testCaseId}</span>
                      {tc.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Priority: {tc.priority} · Status: {tc.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onExecuteTestCase(tc)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shrink-0"
                  >
                    Execute
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
