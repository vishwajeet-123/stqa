import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { apiRequest } from '../../api.ts';

interface ApiHistoryItem {
  _id: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTimeMs: number;
  responseBody: any;
  executorName?: string;
  createdAt: string;
}

const PRESETS = [
  { label: 'Health & DB Status', method: 'GET', endpoint: '/api/health', body: '' },
  { label: 'List Stores', method: 'GET', endpoint: '/api/stores', body: '' },
  { label: 'List Products', method: 'GET', endpoint: '/api/products', body: '' },
  {
    label: 'Customer Login',
    method: 'POST',
    endpoint: '/api/auth/login',
    body: JSON.stringify({ email: 'customer@grocerygo.demo', password: 'Demo@123' }, null, 2),
  },
  { label: 'Get Current Cart', method: 'GET', endpoint: '/api/cart', body: '' },
  { label: 'Get My Orders', method: 'GET', endpoint: '/api/orders', body: '' },
];

export function ApiTestingView() {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('GET');
  const [endpoint, setEndpoint] = useState('/api/products');
  const [headersText, setHeadersText] = useState('{\n  "Content-Type": "application/json"\n}');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ApiHistoryItem | null>(null);
  const [history, setHistory] = useState<ApiHistoryItem[]>([]);

  const loadHistory = async () => {
    const res = await apiRequest<{ history: ApiHistoryItem[] }>('/api/stqa/api-test/history');
    setHistory(res.history);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      let parsedHeaders = {};
      if (headersText.trim()) {
        parsedHeaders = JSON.parse(headersText);
      }
      let parsedBody = undefined;
      if (method !== 'GET' && method !== 'DELETE' && bodyText.trim()) {
        parsedBody = JSON.parse(bodyText);
      }

      const res = await apiRequest<{ result: ApiHistoryItem }>('/api/stqa/api-test/execute', {
        method: 'POST',
        body: JSON.stringify({
          method,
          endpoint,
          headers: parsedHeaders,
          body: parsedBody,
        }),
      });
      setResult(res.result);
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to execute API request. Check JSON syntax.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">REST API Testing Workbench</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Execute live HTTP requests against authorized GroceryGo endpoints and persist response history in MongoDB
        </p>
      </div>

      {/* Preconfigured Endpoint Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setMethod(p.method as any);
              setEndpoint(p.endpoint);
              setBodyText(p.body);
              setError('');
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-lg text-xs font-medium text-slate-700"
          >
            <span className="font-mono font-bold text-emerald-700 mr-1.5">{p.method}</span>
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Request Composer + Response */}
        <div className="lg:col-span-8 space-y-5">
          <form
            onSubmit={handleSend}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-2.5">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-slate-50"
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
              <input
                type="text"
                required
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="/api/products"
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Request Headers (JSON)
                </label>
                <textarea
                  rows={5}
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Request Body (JSON)
                </label>
                <textarea
                  rows={5}
                  disabled={method === 'GET' || method === 'DELETE'}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50 disabled:opacity-50"
                />
              </div>
            </div>
          </form>

          {result && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="font-mono font-bold text-slate-900">
                  HTTP Status:{' '}
                  <span
                    className={
                      result.statusCode >= 200 && result.statusCode < 300
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }
                  >
                    {result.statusCode}
                  </span>
                </div>
                <div className="font-mono tabular-nums text-slate-600">
                  Response Time: {result.responseTimeMs} ms
                </div>
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-96">
                {typeof result.responseBody === 'string'
                  ? result.responseBody
                  : JSON.stringify(result.responseBody, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Persisted History */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            Request History ({history.length})
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-200">
            {history.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No API requests executed yet.
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => {
                    setResult(item);
                    setMethod(item.method as any);
                    setEndpoint(item.endpoint);
                  }}
                  className="w-full text-left p-3.5 hover:bg-slate-50 text-xs"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-slate-900">
                      {item.method} {item.endpoint}
                    </span>
                    <span
                      className={
                        item.statusCode < 400 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'
                      }
                    >
                      {item.statusCode}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1 tabular-nums">
                    {item.responseTimeMs}ms · {new Date(item.createdAt).toLocaleTimeString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
