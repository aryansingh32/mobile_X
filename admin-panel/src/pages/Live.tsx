import React, { useState, useEffect } from 'react';
import { Radio, MapPin, Monitor, Smartphone } from 'lucide-react';
import { api } from '../services/api';

const LiveTracking = () => {
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveUsers();
    const interval = setInterval(fetchLiveUsers, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchLiveUsers = async () => {
    try {
      const { data } = await api.get('/admin/live-users');
      setLiveUsers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Loading Live Tracker...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Radio className="mr-3 text-red-500 animate-pulse" /> Live User Tracking
        </h1>
        <div className="bg-red-900/30 text-red-400 px-4 py-2 rounded-full font-mono text-sm border border-red-500/50">
          ● {liveUsers.length} ONLINE NOW
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333]">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#2A2A2A] text-gray-400">
            <tr>
              <th className="px-6 py-4 font-semibold">User</th>
              <th className="px-6 py-4 font-semibold">Current Screen</th>
              <th className="px-6 py-4 font-semibold">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {liveUsers.length > 0 ? liveUsers.map((user) => (
              <tr key={user.id} className="hover:bg-[#222] transition-colors">
                <td className="px-6 py-4 font-medium text-white flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-3 animate-pulse"></div>
                  {user.name} <span className="text-gray-500 ml-2 font-mono text-xs">#{user.id}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="bg-[#333] px-2 py-1 rounded text-xs text-blue-300 font-mono">
                    {user.currentScreen || 'APP_BACKGROUND'}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-gray-400">
                  {new Date(user.lastActiveAt).toLocaleTimeString()}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  No users active in the last 5 minutes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveTracking;
