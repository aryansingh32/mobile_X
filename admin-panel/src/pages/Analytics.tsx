import React, { useState, useEffect } from 'react';
import { LineChart, BarChart2, TrendingUp, IndianRupee } from 'lucide-react';
import { api } from '../services/api';

const Analytics = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/admin/analytics/dashboard');
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Loading Revenue Analytics...</div>;
  const chartData = data?.chartData || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <LineChart className="mr-3 text-green-400" /> Ad Revenue Analytics
      </h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="text-gray-400 mb-2 flex items-center"><IndianRupee size={16} className="mr-2"/> Total Revenue (AdMob)</div>
          <div className="text-3xl font-bold text-green-400">₹{data?.totalRevenueINR?.toLocaleString() || 0}</div>
          {data?.revenueGrowth && <div className="text-xs text-green-500 mt-2">↑ {data.revenueGrowth}% vs last month</div>}
        </div>
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="text-gray-400 mb-2 flex items-center"><TrendingUp size={16} className="mr-2"/> Outstanding Liability</div>
          <div className="text-3xl font-bold text-[var(--accent)]">{data?.totalCoinsCirculating?.toLocaleString() || 0} 🪙</div>
          <div className="text-xs text-gray-500 mt-2">Coins currently in user wallets</div>
        </div>
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="text-gray-400 mb-2 flex items-center"><BarChart2 size={16} className="mr-2"/> Total Withdrawn</div>
          <div className="text-3xl font-bold text-white">₹{data?.totalWithdrawnINR?.toLocaleString() || 0}</div>
          <div className="text-xs text-gray-500 mt-2">Paid out to users</div>
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Revenue Breakdown</h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center border border-dashed border-[#444] rounded-lg text-gray-500">
            No revenue chart data is available yet.
          </div>
        ) : <div className="h-64 flex items-end justify-between gap-2 border-b border-[#333] pb-2">
          {/* Dynamic Bars */}
          {chartData.map((h: any, i: number) => (
            <div key={i} className="w-full flex flex-col gap-1">
              <div className="bg-green-500/80 rounded-t w-full" style={{ height: `${typeof h === 'number' ? h : h?.rewarded || 0}%` }}></div>
              <div className="bg-blue-500/80 rounded-b w-full" style={{ height: `${typeof h === 'number' ? h * 0.4 : h?.interstitial || 0}%` }}></div>
            </div>
          ))}
        </div>}
        <div className="flex justify-between mt-4 text-xs text-gray-500">
          {Array.from({length: 7}).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return <span key={i}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
          })}
        </div>
        <div className="flex gap-6 mt-6">
          <div className="flex items-center text-sm text-gray-300"><div className="w-3 h-3 bg-green-500/80 rounded mr-2"></div> Rewarded Video</div>
          <div className="flex items-center text-sm text-gray-300"><div className="w-3 h-3 bg-blue-500/80 rounded mr-2"></div> Interstitial</div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
