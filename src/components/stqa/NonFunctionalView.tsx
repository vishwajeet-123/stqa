import { useEffect, useState } from 'react';
import { Gauge, Plus } from 'lucide-react';
import { apiRequest } from '../../api.ts';

interface NonFunctionalRecord {
  _id: string;
  category: string;
  title: string;
  metricName: string;
  measuredValue: string;
  threshold: string;
  status: 'Passed' | 'Failed' | 'Needs Review';
  observations: string;
  evidenceNote: string;
  measurementMethod: string;
  recordedByName: string;
  createdAt: string;
}

const CATEGORIES = [
  'All',
  'Performance Testing',
  'Usability Testing',
  'Security Testing',
  'Compatibility Testing',
  'Reliability Testing',
  'Database Testing',
];

export function NonFunctionalView() {
  const [records, setRecords] = useState<NonFunctionalRecord[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [benchEndpoint, setBenchEndpoint] = useState('/api/products');
  const [benchConcurrency, setBenchConcurrency] = useState(5);
  const [benchmarking, setBenchmarking] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    category: 'Usability Testing',
    title: '',
    metricName: '',
    measuredValue: '',
    threshold: '',
    status: 'Passed' as 'Passed' | 'Failed' | 'Needs Review',
    observations: '',
    evidenceNote: '',
  });

  const load = async () => {
    const q = categoryFilter !== 'All' ? `?category=${encodeURIComponent(categoryFilter)}` : '';
    const res = await apiRequest<{ records: NonFunctionalRecord[] }>(`/api/stqa/non-functional${q}`);
    setRecords(res.records);
  };

  useEffect(() => {
    load();
  }, [categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/stqa/non-functional', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({
        category: 'Usability Testing',
        title: '',
        metricName: '',
        measuredValue: '',
        threshold: '',
        status: 'Passed',
        observations: '',
        evidenceNote: '',
      });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to save observation.');
    }
  };

  const handleBenchmark = async () => {
    setError('');
    setBenchmarking(true);
    try {
      await apiRequest('/api/stqa/non-functional/benchmark', {
        method: 'POST',
        body: JSON.stringify({ endpoint: benchEndpoint, concurrency: benchConcurrency }),
      });
      await load();
    } catch (err: any) {
      setError(err.message || 'Benchmark failed.');
    } finally {
      setBenchmarking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Non-Functional Testing</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Run real HTTP latency benchmarks and document Usability, Security, Compatibility, Reliability, and Database results
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Log Observation
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Automated HTTP Latency Benchmark */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <Gauge className="w-4 h-4 text-emerald-600" />
            Automated Live HTTP Performance Benchmark
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dispatches real parallel requests against the running Express + MongoDB server and records measured latency
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={benchEndpoint}
            onChange={(e) => setBenchEndpoint(e.target.value)}
            className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
          >
            <option value="/api/products">/api/products</option>
            <option value="/api/stores">/api/stores</option>
            <option value="/api/health">/api/health</option>
            <option value="/api/stqa/overview">/api/stqa/overview</option>
          </select>
          <select
            value={benchConcurrency}
            onChange={(e) => setBenchConcurrency(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value={5}>5 concurrent reqs</option>
            <option value={10}>10 concurrent reqs</option>
            <option value={15}>15 concurrent reqs</option>
          </select>
          <button
            type="button"
            disabled={benchmarking}
            onClick={handleBenchmark}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            {benchmarking ? 'Measuring...' : 'Run Benchmark'}
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === cat
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Test Title (e.g. Mobile Cart Responsiveness)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
              <option value="Needs Review">Needs Review</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Metric Name (e.g. CLS / Viewport Overflow)"
              value={form.metricName}
              onChange={(e) => setForm({ ...form, metricName: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="Measured Value (e.g. 0px horizontal overflow)"
              value={form.measuredValue}
              onChange={(e) => setForm({ ...form, measuredValue: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="Acceptance Threshold (e.g. 0px on 375px)"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <textarea
            rows={2}
            required
            placeholder="Testing observations and measured environment details..."
            value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            placeholder="Evidence Note (Browser version, tool, or command output)"
            value={form.evidenceNote}
            onChange={(e) => setForm({ ...form, evidenceNote: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
          >
            Save Non-Functional Record
          </button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No non-functional test observations recorded yet. Run the live HTTP benchmark above or log an observation.
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((rec) => (
            <div key={rec._id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-emerald-700">{rec.category}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="text-xs text-slate-500">{rec.measurementMethod}</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{rec.title}</h3>
                </div>
                <span
                  className={`text-xs font-bold ${
                    rec.status === 'Passed'
                      ? 'text-emerald-700'
                      : rec.status === 'Failed'
                      ? 'text-red-600'
                      : 'text-amber-700'
                  }`}
                >
                  {rec.status}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500">Metric:</span>{' '}
                  <strong className="text-slate-900">{rec.metricName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Measured:</span>{' '}
                  <strong className="font-mono text-slate-900">{rec.measuredValue}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Threshold:</span>{' '}
                  <strong className="font-mono text-slate-900">{rec.threshold}</strong>
                </div>
              </div>
              <p className="text-xs text-slate-700">{rec.observations}</p>
              {rec.evidenceNote && (
                <p className="text-[11px] font-mono text-slate-500">{rec.evidenceNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
