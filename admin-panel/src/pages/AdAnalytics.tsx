import React, { useState, useEffect } from 'react';
import { getAdFunnelAnalytics, getFillRateAnalytics, getRevenueEstimate } from '../services/api';
import { LineChart, BarChart2, DollarSign, Activity, RefreshCw } from 'lucide-react';

const AdAnalytics: React.FC = () => {
  const [funnel, setFunnel] = useState<any>(null);
  const [fillRate, setFillRate] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [fData, frData, rData] = await Promise.all([
        getAdFunnelAnalytics(days),
        getFillRateAnalytics(days),
        getRevenueEstimate(days),
      ]);
      setFunnel(fData.data.data);
      setFillRate(frData.data.data);
      setRevenue(rData.data.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart2 className="text-blue-400" size={28} /> Monetization Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1">Track ad performance, fill rates, and revenue estimates.</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-[#252525] border border-[#333] text-white rounded-lg px-3 py-2 text-sm"
          >
            <option value={1}>Last 24 Hours</option>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          <button onClick={fetchAnalytics} className="flex items-center gap-2 px-4 py-2 bg-[#252525] border border-[#333] text-white rounded-lg hover:bg-[#333] transition-colors">
            <RefreshCw size={18} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading analytics data...</div>
      ) : (
        <div className="space-y-6">
          {/* Revenue Cards */}
          {revenue && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#161616] border border-[#333] rounded-xl p-5">
                <div className="text-gray-400 text-sm mb-2 flex items-center gap-2"><DollarSign size={16}/> Total Payout Cost (Estimated)</div>
                <div className="text-3xl font-bold text-white">₹{revenue.payoutCostINR}</div>
                <div className="text-xs text-gray-500 mt-2">Based on {revenue.coinToInrRate} INR per coin</div>
              </div>
              <div className="bg-[#161616] border border-[#333] rounded-xl p-5">
                <div className="text-gray-400 text-sm mb-2 flex items-center gap-2"><Activity size={16}/> Total Ad Rewards Claimed</div>
                <div className="text-3xl font-bold text-yellow-400">{revenue.totalAdRewards}</div>
                <div className="text-xs text-gray-500 mt-2">Users who watched full ads</div>
              </div>
              <div className="bg-[#161616] border border-[#333] rounded-xl p-5">
                <div className="text-gray-400 text-sm mb-2 flex items-center gap-2"><LineChart size={16}/> Coins Paid Out</div>
                <div className="text-3xl font-bold text-orange-400">{revenue.totalCoinsPaidOut}</div>
                <div className="text-xs text-gray-500 mt-2">Total coins minted for ads</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fill Rates */}
            {fillRate && (
              <div className="bg-[#161616] border border-[#333] rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-[#333] pb-2">Network Fill Rates</h3>
                <div className="space-y-4">
                  {Object.entries(fillRate.byType).map(([type, data]: [string, any]) => (
                    <div key={type} className="bg-[#1A1A1A] p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-300 font-semibold">{type}</span>
                        <span className={`font-bold ${data.fillRate > 80 ? 'text-green-400' : data.fillRate > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {data.fillRate}% Fill
                        </span>
                      </div>
                      <div className="w-full bg-[#333] h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${data.fillRate}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>{data.requested} Req</span>
                        <span>{data.loaded} Loaded</span>
                        <span>{data.failed} Failed</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(fillRate.byType).length === 0 && (
                    <div className="text-gray-500 text-center py-4">No ad requests recorded in this period.</div>
                  )}
                </div>
              </div>
            )}

            {/* Funnel */}
            {funnel && (
              <div className="bg-[#161616] border border-[#333] rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-[#333] pb-2">Global Ad Funnel</h3>
                <div className="space-y-3">
                  {[
                    { key: 'REQUESTED', label: '1. Ad Requested', color: 'bg-gray-600' },
                    { key: 'LOADED', label: '2. Ad Loaded', color: 'bg-blue-500' },
                    { key: 'SHOWN', label: '3. Ad Shown', color: 'bg-purple-500' },
                    { key: 'CLICKED', label: '4. Ad Clicked', color: 'bg-pink-500' },
                    { key: 'EARNED_REWARD', label: '5. Reward Earned', color: 'bg-yellow-500' },
                  ].map((step, idx) => {
                    const max = funnel.funnel['REQUESTED'] || 1;
                    const val = funnel.funnel[step.key] || 0;
                    const pct = Math.max(2, Math.round((val / max) * 100)); // min 2% to show a sliver
                    return (
                      <div key={step.key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">{step.label}</span>
                          <span className="text-white font-bold">{val.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-[#333] h-3 rounded-full overflow-hidden">
                          <div className={`${step.color} h-full transition-all`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdAnalytics;
