import { useEffect, useState } from 'react';
import { Database, RotateCcw } from 'lucide-react';
import { apiRequest } from '../../api.ts';

export function ActivityLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [moduleFilter, setModuleFilter] = useState('All');

  const load = async () => {
    const q = moduleFilter !== 'All' ? `?module=${encodeURIComponent(moduleFilter)}` : '';
    const res = await apiRequest<{ logs: any[] }>(`/api/stqa/audit-logs${q}`);
    setLogs(res.logs);
  };

  useEffect(() => {
    load();
  }, [moduleFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity & Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Unified MongoDB audit trail across GroceryGo orders, auth events, and STQA executions
          </p>
        </div>

        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white self-start"
        >
          <option value="All">All Modules</option>
          <option>Authentication</option>
          <option>Orders</option>
          <option>Delivery</option>
          <option>Products</option>
          <option>STQA Test Cases</option>
          <option>STQA Execution</option>
          <option>STQA Defects</option>
          <option>System</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="py-3 px-4 font-semibold">Timestamp</th>
              <th className="py-3 px-4 font-semibold">Actor</th>
              <th className="py-3 px-4 font-semibold">Module</th>
              <th className="py-3 px-4 font-semibold">Action</th>
              <th className="py-3 px-4 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.map((log) => (
              <tr key={log._id} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                  {log.actorName} ({log.actorRole})
                </td>
                <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{log.module}</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                  {log.action}
                </td>
                <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StqaSettingsView({ onDataReset }: { onDataReset: () => Promise<void> }) {
  const [health, setHealth] = useState<any>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiRequest('/api/health').then(setHealth).catch(() => {});
  }, []);

  const handleReset = async () => {
    setResetting(true);
    setMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/api/stqa/reset-demo', {
        method: 'POST',
      });
      setMsg(res.message);
      setConfirmReset(false);
      await onDataReset();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">STQA Environment Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Verify MongoDB connection health and manage seeded academic demo datasets
        </p>
      </div>

      {msg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Database className="w-4 h-4 text-emerald-600" />
          MongoDB Database Status
        </div>
        {health ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500">Status:</span>{' '}
              <strong className="text-emerald-700">
                {health.database?.connected ? 'Connected' : 'Disconnected'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Database:</span>{' '}
              <strong className="font-mono text-slate-900">{health.database?.dbName}</strong>
            </div>
            <div>
              <span className="text-slate-500">Engine:</span>{' '}
              <strong className="text-slate-900">{health.database?.mode}</strong>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Checking database connectivity...</p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Reset Seeded Demo Testing Data</h2>
          <p className="text-xs text-slate-600 mt-1">
            Restores the 3 seeded stores, 18 products, 12 test suites, and 32 initial test cases back
            to <span className="font-mono">Not Executed</span> and clears demo test executions/defects.
            Non-seeded real user accounts you registered are preserved.
          </p>
        </div>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Data
          </button>
        ) : (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
            <p className="text-xs text-amber-900 font-medium">
              Confirm reset? This will restore all 32 seeded test cases to Not Executed and clear demo
              executions, defects, and seeded orders.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg"
              >
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
