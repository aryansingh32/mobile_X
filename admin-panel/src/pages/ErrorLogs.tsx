import React, { useEffect, useState } from 'react';
import { Bug, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react';
import { getErrorLogs } from '../services/api';

type ErrorLogEntry = {
  id: number;
  userId: number | null;
  user: { id: number; name: string; email: string } | null;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  stack: string | null;
  createdAt: string;
};

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: '5xx (server faults)', value: '500' },
  { label: '4xx (client errors)', value: '400' },
];

const ErrorLogsPage = () => {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchLogs = () => {
    setLoading(true);
    getErrorLogs({
      search: search || undefined,
      userId: userId || undefined,
      statusCode: statusFilter || undefined,
      limit,
      offset,
    })
      .then((res) => {
        setLogs(res.data.data || []);
        setTotal(res.data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Bug className="text-red-400" size={24} /> Error Log</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Every server-side error a real user has hit. Users only ever see a generic "something went wrong" message
            (see utils/errorResponse.ts) — this is where the real message and stack trace end up, associated with the
            user it happened to.
          </p>
        </div>
        <button onClick={fetchLogs} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white self-start">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={applyFilters} className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search message or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/40 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
          />
        </div>
        <input
          type="number"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-32 bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Filter
        </button>
      </form>

      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl divide-y divide-gray-800/50">
        {logs.map((log) => {
          const expanded = expandedId === log.id;
          return (
            <div key={log.id} className="p-4">
              <button
                onClick={() => setExpandedId(expanded ? null : log.id)}
                className="w-full flex items-start gap-3 text-left"
              >
                <span className={`mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold flex-shrink-0 ${log.statusCode >= 500 ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                  {log.statusCode}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-1">
                    <span className="font-mono">{log.method} {log.path}</span>
                    <span>·</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                    <span>·</span>
                    {log.user ? (
                      <span className="text-gray-300">{log.user.name} ({log.user.email}) — #{log.user.id}</span>
                    ) : (
                      <span className="text-gray-600 italic">unauthenticated</span>
                    )}
                  </div>
                  <div className="text-sm text-white">{log.message}</div>
                </div>
                {log.stack && (expanded ? <ChevronUp size={16} className="text-gray-500 flex-shrink-0 mt-1" /> : <ChevronDown size={16} className="text-gray-500 flex-shrink-0 mt-1" />)}
              </button>
              {expanded && log.stack && (
                <pre className="mt-3 ml-9 p-3 bg-black/40 rounded-lg text-[11px] text-gray-400 overflow-x-auto whitespace-pre-wrap">{log.stack}</pre>
              )}
            </div>
          );
        })}
        {!loading && logs.length === 0 && (
          <div className="p-8 text-center text-gray-500">No errors recorded — either nothing has gone wrong, or this filter matches nothing.</div>
        )}
      </div>

      {total > limit && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
          <span>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1.5 bg-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1.5 bg-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorLogsPage;
