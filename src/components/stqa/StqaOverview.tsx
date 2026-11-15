import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { apiRequest } from '../../api.ts';

interface OverviewData {
  kpis: {
    totalTestCases: number;
    passedCount: number;
    failedCount: number;
    blockedCount: number;
    notExecutedCount: number;
    totalDefects: number;
    openDefects: number;
    criticalDefects: number;
    executionPercentage: number;
    passPercentage: number;
    totalSuites: number;
    totalRequirements: number;
    coveredRequirements: number;
    liveOrdersCount: number;
  };
  charts: {
    statusDistribution: { name: string; value: number; color: string }[];
    moduleExecution: {
      module: string;
      Passed: number;
      Failed: number;
      Blocked: number;
      NotExecuted: number;
    }[];
    defectsBySeverity: { severity: string; count: number }[];
    executionHistory: { date: string; Passed: number; Failed: number; Blocked: number }[];
  };
  recentExecutions: any[];
  recentActivities: any[];
}

export function StqaOverview({ refreshSignal }: { refreshSignal: number }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<OverviewData>('/api/stqa/overview');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load STQA overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshSignal]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;
  const { kpis, charts, recentActivities } = data;

  const kpiCards = [
    { label: 'Total Test Cases', value: kpis.totalTestCases, tone: 'text-slate-900' },
    { label: 'Passed Test Cases', value: kpis.passedCount, tone: 'text-emerald-700' },
    { label: 'Failed Test Cases', value: kpis.failedCount, tone: 'text-red-600' },
    { label: 'Blocked Test Cases', value: kpis.blockedCount, tone: 'text-amber-600' },
    { label: 'Not Executed', value: kpis.notExecutedCount, tone: 'text-slate-600' },
    { label: 'Total Defects', value: kpis.totalDefects, tone: 'text-slate-900' },
    { label: 'Open Defects', value: kpis.openDefects, tone: 'text-amber-700' },
    { label: 'Critical Defects', value: kpis.criticalDefects, tone: 'text-red-700' },
    { label: 'Execution Coverage', value: `${kpis.executionPercentage}%`, tone: 'text-slate-900' },
    { label: 'Overall Pass Rate', value: `${kpis.passPercentage}%`, tone: 'text-emerald-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">STQA Quality Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live metrics aggregated directly from MongoDB test cases, executions, and defects
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* 10 Dynamic KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">{card.label}</div>
            <div className={`text-2xl font-extrabold font-mono tabular-nums mt-1 ${card.tone}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Test Case Status Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.statusDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={2}
                >
                  {charts.statusDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Module-Wise Test Execution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.moduleExecution} margin={{ top: 5, right: 16, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="module" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Passed" stackId="a" fill="#10b981" />
                <Bar dataKey="Failed" stackId="a" fill="#ef4444" />
                <Bar dataKey="Blocked" stackId="a" fill="#f59e0b" />
                <Bar dataKey="NotExecuted" name="Not Executed" stackId="a" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Defects by Severity</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.defectsBySeverity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="severity" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Defects" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Test Execution History</h2>
          {charts.executionHistory.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-500 text-center px-6">
              No test executions recorded yet. Run manual or Playwright automated tests in Test Execution to populate history.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.executionHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Passed" fill="#10b981" />
                  <Bar dataKey="Failed" fill="#ef4444" />
                  <Bar dataKey="Blocked" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent Testing Activities */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Recent Testing & Store Activities</h2>
          <span className="text-xs text-slate-500 tabular-nums">
            Live Orders in DB: {kpis.liveOrdersCount} · Requirements Covered: {kpis.coveredRequirements}/{kpis.totalRequirements}
          </span>
        </div>
        <div className="divide-y divide-slate-200">
          {recentActivities.slice(0, 8).map((act) => (
            <div key={act._id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-mono font-semibold text-slate-900">{act.action}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-700">{act.details}</span>
              </div>
              <div className="text-slate-500 tabular-nums shrink-0">
                {act.actorName} ({act.actorRole}) · {new Date(act.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
