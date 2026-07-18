import React, { useState, useEffect } from 'react';
import { getAdRewardRules, updateAdRewardRule } from '../services/api';
import { Save, RefreshCw, AlertCircle, Coins, ShieldCheck } from 'lucide-react';

interface AdRewardRule {
  id: number;
  adType: string;
  coinsAwarded: number;
  dailyCapForType: number;
  cooldownSeconds: number;
  enabled: boolean;
  requiresFullWatch: boolean;
  updatedAt: string;
}

const AdRewardRules: React.FC = () => {
  const [rules, setRules] = useState<AdRewardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      const { data } = await getAdRewardRules();
      setRules(data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleUpdate = async (adType: string, updates: Partial<AdRewardRule>) => {
    setSaving(adType);
    try {
      await updateAdRewardRule(adType, updates);
      await fetchRules();
    } catch (e) {
      console.error(e);
      alert('Failed to update rule');
    }
    setSaving(null);
  };

  if (loading) return <div className="p-6 text-gray-400">Loading reward rules…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="text-yellow-400" size={28} /> Reward Rules Engine
          </h1>
          <p className="text-gray-400 text-sm mt-1">Configure payout amounts and limits for each ad format.</p>
        </div>
        <button onClick={fetchRules} className="flex items-center gap-2 px-4 py-2 bg-[#252525] border border-[#333] text-white rounded-lg hover:bg-[#333] transition-colors">
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rules.map((rule) => (
          <div key={rule.id} className={`bg-[#161616] border ${rule.enabled ? 'border-yellow-500/30' : 'border-[#333] opacity-75'} rounded-xl p-5 relative overflow-hidden`}>
            {rule.enabled && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500"></div>}
            
            <div className="flex justify-between items-start mb-6 mt-2">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{rule.adType.replace(/_/g, ' ')}</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${rule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1 flex items-center justify-between">
                  Payout (Coins)
                  <Coins size={12} className="text-yellow-400" />
                </label>
                <div className="flex">
                  <input
                    type="number"
                    value={rule.coinsAwarded}
                    onChange={(e) => {
                      const updated = [...rules];
                      const idx = updated.findIndex((r) => r.id === rule.id);
                      updated[idx].coinsAwarded = parseInt(e.target.value) || 0;
                      setRules(updated);
                    }}
                    className="w-full bg-[#252525] border border-[#333] rounded-l-lg px-3 py-2 text-white font-mono"
                  />
                  <button
                    onClick={() => handleUpdate(rule.adType, { coinsAwarded: rule.coinsAwarded })}
                    disabled={saving === rule.adType}
                    className="px-3 bg-yellow-500 text-black rounded-r-lg font-bold hover:bg-yellow-400 disabled:opacity-50"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1 flex items-center justify-between">
                  Daily Cap (per user)
                  <ShieldCheck size={12} className="text-blue-400" />
                </label>
                <div className="flex">
                  <input
                    type="number"
                    value={rule.dailyCapForType}
                    onChange={(e) => {
                      const updated = [...rules];
                      const idx = updated.findIndex((r) => r.id === rule.id);
                      updated[idx].dailyCapForType = parseInt(e.target.value) || 0;
                      setRules(updated);
                    }}
                    className="w-full bg-[#252525] border border-[#333] rounded-l-lg px-3 py-2 text-white font-mono"
                  />
                  <button
                    onClick={() => handleUpdate(rule.adType, { dailyCapForType: rule.dailyCapForType })}
                    disabled={saving === rule.adType}
                    className="px-3 bg-blue-500 text-black rounded-r-lg font-bold hover:bg-blue-400 disabled:opacity-50"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1 flex items-center justify-between">
                  Cooldown (seconds)
                  <AlertCircle size={12} className="text-orange-400" />
                </label>
                <div className="flex">
                  <input
                    type="number"
                    value={rule.cooldownSeconds}
                    onChange={(e) => {
                      const updated = [...rules];
                      const idx = updated.findIndex((r) => r.id === rule.id);
                      updated[idx].cooldownSeconds = parseInt(e.target.value) || 0;
                      setRules(updated);
                    }}
                    className="w-full bg-[#252525] border border-[#333] rounded-l-lg px-3 py-2 text-white font-mono"
                  />
                  <button
                    onClick={() => handleUpdate(rule.adType, { cooldownSeconds: rule.cooldownSeconds })}
                    disabled={saving === rule.adType}
                    className="px-3 bg-orange-500 text-black rounded-r-lg font-bold hover:bg-orange-400 disabled:opacity-50"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#333] flex justify-between items-center">
                 <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={rule.requiresFullWatch}
                    onChange={(e) => handleUpdate(rule.adType, { requiresFullWatch: e.target.checked })}
                    className="accent-yellow-500 w-4 h-4"
                  />
                  Require Full Watch
                </label>
                
                <button
                  onClick={() => handleUpdate(rule.adType, { enabled: !rule.enabled })}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${rule.enabled ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                >
                  {rule.enabled ? 'Disable Ad Type' : 'Enable Ad Type'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdRewardRules;
