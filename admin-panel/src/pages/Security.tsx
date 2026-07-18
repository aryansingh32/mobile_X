import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

const SecurityLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data } = await api.get('/admin/audit');
      setLogs(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Loading Security Operations Center...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Shield className="mr-3 text-red-500" /> Security Operations Center
        </h1>
        <div className="bg-red-900/20 text-red-400 px-4 py-2 rounded flex items-center text-sm border border-red-900/50">
          <AlertTriangle size={16} className="mr-2" /> Nothing happens without logging
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333]">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#2A2A2A] text-gray-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Timestamp</th>
              <th className="px-6 py-4 font-semibold">Admin ID</th>
              <th className="px-6 py-4 font-semibold">Action</th>
              <th className="px-6 py-4 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {logs.length > 0 ? logs.map((log) => (
              <tr key={log.id} className="hover:bg-[#222] transition-colors font-mono text-xs">
                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <span className="bg-[#333] px-2 py-1 rounded">Admin #{log.adminId || 'SYS'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded font-bold ${
                    log.action.includes('ADJUST') || log.action.includes('PROCESS') 
                      ? 'text-yellow-400' 
                      : log.action.includes('ENV') ? 'text-red-400 bg-red-900/20' : 'text-blue-400'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-300">
                  {log.details}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SecurityLogs;
