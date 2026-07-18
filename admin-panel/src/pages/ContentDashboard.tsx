import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, FileText, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { getNewsDashboard, getNewsSyncLogs, syncNews } from '../services/api';

const ContentDashboard = () => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, logsRes] = await Promise.all([
        getNewsDashboard(),
        getNewsSyncLogs()
      ]);
      setDashboard(dashRes.data.data);
      setSyncLogs(logsRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      await syncNews();
      await fetchData(); // Refresh data after sync
    } catch (err) {
      console.error('Failed to sync news', err);
      alert('Failed to sync news');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Loading Content Dashboard...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Activity className="mr-3 text-blue-400" /> News Dashboard
        </h1>
        <button 
          onClick={handleSyncAll}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
        >
          <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} /> 
          {syncing ? 'Syncing...' : 'Sync All Sources'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Articles</p>
              <h3 className="text-3xl font-bold text-white">{dashboard?.totalArticles || 0}</h3>
            </div>
            <FileText size={32} className="text-blue-500 opacity-50" />
          </div>
        </div>
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Sources</p>
              <h3 className="text-3xl font-bold text-white">{dashboard?.activeSources || 0}</h3>
            </div>
            <Database size={32} className="text-green-500 opacity-50" />
          </div>
        </div>
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Categories</p>
              <h3 className="text-3xl font-bold text-white">{dashboard?.totalCategories || 0}</h3>
            </div>
            <Database size={32} className="text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-white mb-4">Recent Sync Logs</h2>
      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333]">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#2A2A2A] text-gray-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Source</th>
              <th className="px-6 py-4 font-semibold">Articles Added</th>
              <th className="px-6 py-4 font-semibold">Message</th>
              <th className="px-6 py-4 font-semibold">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {syncLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No sync logs found</td>
              </tr>
            ) : syncLogs.map((log) => (
              <tr key={log.id} className="hover:bg-[#222] transition-colors">
                <td className="px-6 py-4">
                  {log.status === 'SUCCESS' ? (
                    <span className="flex items-center text-green-400"><CheckCircle size={14} className="mr-1" /> Success</span>
                  ) : log.status === 'PARTIAL' ? (
                    <span className="flex items-center text-amber-400"><AlertCircle size={14} className="mr-1" /> Partial</span>
                  ) : (
                    <span className="flex items-center text-red-400"><AlertCircle size={14} className="mr-1" /> Failed</span>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-white">{log.source?.name || `Source #${log.sourceId}`}</td>
                <td className="px-6 py-4">{log.articlesNew}</td>
                <td className="px-6 py-4 text-gray-400">{log.error || log.errorMessage || '-'}</td>
                <td className="px-6 py-4">{new Date(log.startedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContentDashboard;
