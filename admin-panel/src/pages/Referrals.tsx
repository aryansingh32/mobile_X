import React, { useEffect, useState } from 'react';
import { Network, RefreshCw } from 'lucide-react';
import { getReferrals } from '../services/api';

const Referrals = () => {
  const [data, setData] = useState<{ stats: any, tree: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const res = await getReferrals();
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  if (loading && !data) return <div className="p-6 text-white">Loading referrals...</div>;

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <Network className="mr-3 text-purple-400" /> Referral Intelligence
      </h1>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#333]">
          <div className="text-gray-400 text-sm mb-1">Top Referrer</div>
          <div className="text-xl font-bold text-white">{data?.stats?.topReferrer || 'N/A'}</div>
        </div>
        <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#333]">
          <div className="text-gray-400 text-sm mb-1">Users Brought</div>
          <div className="text-xl font-bold text-blue-400">{data?.stats?.usersBrought || 0}</div>
        </div>
        <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#333]">
          <div className="text-gray-400 text-sm mb-1">Referral Bonus Coins</div>
          <div className="text-xl font-bold text-green-400">{data?.stats?.referralBonusCoins || 0}</div>
        </div>
        <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#333]">
          <div className="text-gray-400 text-sm mb-1">Total Withdrawn</div>
          <div className="text-xl font-bold text-[var(--accent)]">{data?.stats?.totalWithdrawnCoins || 0} coins</div>
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl border border-[#333] flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-4 border-b border-[#333] pb-2">
          <h3 className="text-lg font-bold text-white">Visual Referral Tree</h3>
          <button 
            onClick={fetchReferrals}
            className="text-gray-400 hover:text-white flex items-center text-sm"
          >
            <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        
        <div className="font-mono text-gray-300 whitespace-pre">
          {data?.tree || 'No referral data available.'}
        </div>
        
      </div>
    </div>
  );
};

export default Referrals;
