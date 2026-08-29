import React, { useEffect, useState } from 'react';
import { Network, RefreshCw, Save, TrendingUp } from 'lucide-react';
import { getReferrals, getConfig, updateConfig } from '../services/api';

type TierRates = {
  tier1Percent: string;
  tier2Percent: string;
  tier3Percent: string;
  tier2Days: string;
  tier3Days: string;
  activeWindowDays: string;
};

const DEFAULT_RATES: TierRates = {
  tier1Percent: '10',
  tier2Percent: '15',
  tier3Percent: '20',
  tier2Days: '30',
  tier3Days: '90',
  activeWindowDays: '7',
};

const RATE_CONFIG_KEYS: Record<keyof TierRates, string> = {
  tier1Percent: 'referral_percent_tier_1',
  tier2Percent: 'referral_percent_tier_2',
  tier3Percent: 'referral_percent_tier_3',
  tier2Days: 'referral_tier2_days',
  tier3Days: 'referral_tier3_days',
  activeWindowDays: 'referral_active_window_days',
};

type ReferralStats = {
  topReferrer: string;
  usersBrought: number;
  referralBonusCoins: number;
  totalWithdrawnCoins: number;
  totalWithdrawnINR: number;
};

const Referrals = () => {
  const [data, setData] = useState<{ stats: ReferralStats, tree: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<TierRates>(DEFAULT_RATES);
  const [savingRates, setSavingRates] = useState(false);
  const [rateError, setRateError] = useState('');

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

  const fetchRates = async () => {
    try {
      const res = await getConfig();
      const rows: Array<{ key: string; value: string }> = res.data.data || [];
      const rowMap = new Map(rows.map(r => [r.key, r.value]));
      setRates({
        tier1Percent: rowMap.get(RATE_CONFIG_KEYS.tier1Percent) ?? DEFAULT_RATES.tier1Percent,
        tier2Percent: rowMap.get(RATE_CONFIG_KEYS.tier2Percent) ?? DEFAULT_RATES.tier2Percent,
        tier3Percent: rowMap.get(RATE_CONFIG_KEYS.tier3Percent) ?? DEFAULT_RATES.tier3Percent,
        tier2Days: rowMap.get(RATE_CONFIG_KEYS.tier2Days) ?? DEFAULT_RATES.tier2Days,
        tier3Days: rowMap.get(RATE_CONFIG_KEYS.tier3Days) ?? DEFAULT_RATES.tier3Days,
        activeWindowDays: rowMap.get(RATE_CONFIG_KEYS.activeWindowDays) ?? DEFAULT_RATES.activeWindowDays,
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReferrals();
    fetchRates();
  }, []);

  const saveRates = async () => {
    setSavingRates(true);
    setRateError('');
    try {
      await Promise.all(
        (Object.keys(rates) as Array<keyof TierRates>).map(field => updateConfig(RATE_CONFIG_KEYS[field], rates[field]))
      );
    } catch (err) {
      console.error(err);
      setRateError('Failed to save one or more referral settings.');
    } finally {
      setSavingRates(false);
    }
  };

  if (loading && !data) return <div className="p-6 text-white">Loading referrals...</div>;

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <Network className="mr-3 text-purple-400" /> Referral Intelligence
      </h1>

      <div className="bg-[#1A1A1A] p-5 rounded-xl border border-[#333] mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><TrendingUp size={18} className="text-purple-400" /> Tier Rates & Escalation</h2>
          <button onClick={fetchRates} className="text-gray-400 hover:text-white"><RefreshCw size={16} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          A referral starts at Tier 1 and escalates automatically (daily job) once the referred user has stayed active long
          enough — no manual promotion needed.
        </p>
        {rateError && <div className="mb-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{rateError}</div>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tier 1 Rate (%)</label>
            <input type="number" min={0} max={100} value={rates.tier1Percent} onChange={e => setRates({ ...rates, tier1Percent: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tier 2 Rate (%)</label>
            <input type="number" min={0} max={100} value={rates.tier2Percent} onChange={e => setRates({ ...rates, tier2Percent: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tier 3 Rate (%)</label>
            <input type="number" min={0} max={100} value={rates.tier3Percent} onChange={e => setRates({ ...rates, tier3Percent: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Days Active → Tier 2</label>
            <input type="number" min={1} value={rates.tier2Days} onChange={e => setRates({ ...rates, tier2Days: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Days Active → Tier 3</label>
            <input type="number" min={1} value={rates.tier3Days} onChange={e => setRates({ ...rates, tier3Days: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">"Active" Window (days)</label>
            <input type="number" min={1} value={rates.activeWindowDays} onChange={e => setRates({ ...rates, activeWindowDays: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={saveRates} disabled={savingRates} className="flex items-center gap-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
            <Save size={15} /> {savingRates ? 'Saving…' : 'Save Referral Settings'}
          </button>
        </div>
      </div>

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
