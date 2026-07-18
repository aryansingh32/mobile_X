import React, { useState, useEffect } from 'react';
import { getDailyCapPolicies, updateDailyCapPolicy } from '../services/api';
import { Save, ShieldAlert, Zap, Layers, RefreshCw } from 'lucide-react';

interface DailyCapPolicy {
  tier: string;
  maxAdsPerDay: number;
  maxCoinsPerDay: number;
  minCooldownSeconds: number;
  updatedAt: string;
}

const DailyCapPolicies: React.FC = () => {
  const [policies, setPolicies] = useState<DailyCapPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPolicies = async () => {
    try {
      const { data } = await getDailyCapPolicies();
      setPolicies(data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleUpdate = async (tier: string, updates: Partial<DailyCapPolicy>) => {
    setSaving(tier);
    try {
      await updateDailyCapPolicy(tier, updates);
      await fetchPolicies();
    } catch (e) {
      console.error(e);
      alert('Failed to update policy');
    }
    setSaving(null);
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'HIGH_TRUST': return <ShieldAlert className="text-green-400" size={24} />;
      case 'LOW_TRUST': return <ShieldAlert className="text-red-400" size={24} />;
      case 'NEW_USER': return <Zap className="text-blue-400" size={24} />;
      default: return <Layers className="text-gray-400" size={24} />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'HIGH_TRUST': return 'border-green-500/30';
      case 'LOW_TRUST': return 'border-red-500/30';
      case 'NEW_USER': return 'border-blue-500/30';
      default: return 'border-gray-500/30';
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading daily cap policies…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="text-blue-500" size={28} /> Fraud & Cap Policies
          </h1>
          <p className="text-gray-400 text-sm mt-1">Configure global daily limits based on user trust tiers.</p>
        </div>
        <button onClick={fetchPolicies} className="flex items-center gap-2 px-4 py-2 bg-[#252525] border border-[#333] text-white rounded-lg hover:bg-[#333] transition-colors">
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((policy) => (
          <div key={policy.tier} className={`bg-[#161616] border ${getTierColor(policy.tier)} rounded-xl p-5`}>
            <div className="flex items-center gap-3 mb-6">
              {getTierIcon(policy.tier)}
              <h3 className="text-lg font-bold text-white tracking-wide">{policy.tier}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-gray-400 block mb-1">Max Ads / Day</label>
                <div className="flex">
                  <input
                    type="number"
                    value={policy.maxAdsPerDay}
                    onChange={(e) => {
                      const updated = [...policies];
                      const idx = updated.findIndex((p) => p.tier === policy.tier);
                      updated[idx].maxAdsPerDay = parseInt(e.target.value) || 0;
                      setPolicies(updated);
                    }}
                    className="w-full bg-[#252525] border border-[#333] rounded-l-lg px-3 py-2 text-white font-mono"
                  />
                  <button
                    onClick={() => handleUpdate(policy.tier, { maxAdsPerDay: policy.maxAdsPerDay })}
                    disabled={saving === policy.tier}
                    className="px-3 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-gray-400 block mb-1">Global Ad Cooldown (s)</label>
                <div className="flex">
                  <input
                    type="number"
                    value={policy.minCooldownSeconds}
                    onChange={(e) => {
                      const updated = [...policies];
                      const idx = updated.findIndex((p) => p.tier === policy.tier);
                      updated[idx].minCooldownSeconds = parseInt(e.target.value) || 0;
                      setPolicies(updated);
                    }}
                    className="w-full bg-[#252525] border border-[#333] rounded-l-lg px-3 py-2 text-white font-mono"
                  />
                  <button
                    onClick={() => handleUpdate(policy.tier, { minCooldownSeconds: policy.minCooldownSeconds })}
                    disabled={saving === policy.tier}
                    className="px-3 bg-purple-500 text-white rounded-r-lg hover:bg-purple-600 disabled:opacity-50"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Max Coins / Day (Hard Cap)</label>
                <div className="flex">
                  <input
                    type="number"
                    value={policy.maxCoinsPerDay}
                    onChange={(e) => {
                      const updated = [...policies];
                      const idx = updated.findIndex((p) => p.tier === policy.tier);
                      updated[idx].maxCoinsPerDay = parseInt(e.target.value) || 0;
                      setPolicies(updated);
                    }}
                    className="w-full bg-[#252525] border border-[#333] rounded-l-lg px-3 py-2 text-yellow-400 font-mono"
                  />
                  <button
                    onClick={() => handleUpdate(policy.tier, { maxCoinsPerDay: policy.maxCoinsPerDay })}
                    disabled={saving === policy.tier}
                    className="px-4 bg-yellow-500 text-black rounded-r-lg font-bold hover:bg-yellow-400 disabled:opacity-50"
                  >
                    <Save size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Absolute hard limit. If a user tries to earn more than this across all features, the server will block the reward.
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyCapPolicies;
