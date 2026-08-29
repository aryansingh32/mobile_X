import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Edit3, Plus, Radio, Save, Settings, X } from 'lucide-react';
import { getConfig, updateConfig } from '../services/api';

type ConfigEntry = {
  key: string;
  value: string;
};

type ConfigCategory = {
  title: string;
  subtitle: string;
  tone: 'economy' | 'limits' | 'streaks' | 'behavior' | 'ads' | 'retention';
  keys: string[];
};

const descriptions: Record<string, string> = {
  short_watch_seconds_required: 'Seconds watched before a Short session is tracked.',
  short_watch_reward_coins: 'Coins per Short (set to 0 — coins come from ads only).',
  short_daily_cap: 'Maximum short-video watch sessions counted per user each day.',
  daily_ad_cap: 'Maximum rewarded ads credited per user each day.',
  min_withdrawal_coins: 'Minimum coins required for redemption.',
  offerwall_demo_mode: 'Set to true to expose demo offerwall tasks.',
  post_ad_lockout_ms: 'Interaction lockout after an ad closes (ms).',
  daily_bonus_coins: 'Coins awarded for daily login bonus.',
  ad_cooldown_seconds: 'Minimum seconds between rewarded ad claims.',
  coin_to_inr_rate: 'Exchange rate: coins to INR (e.g. 0.10 = 10 coins per ₹1).',
  ad_rewarded_coins: 'Coins for watching a full rewarded video ad.',
  ad_rewarded_interstitial_coins: 'Coins for rewarded interstitial ad (between shorts).',
  ad_rewarded_discover_coins: 'Coins for rewarded ad in discover feed.',
  admob_android_app_id: 'Android AdMob app ID used in the native manifest at build time.',
  admob_android_app_open_ad_unit_id: 'App open ad unit for app launch and foreground resume.',
  admob_android_rewarded_card_ad_unit_id: 'Rewarded ad unit used by opt-in card ads.',
  admob_android_rewarded_discover_ad_unit_id: 'Rewarded ad unit used specifically by Discover-feed ad cards.',
  admob_android_rewarded_interstitial_card_ad_unit_id: 'Rewarded interstitial ad unit used between cards/shorts.',
  admob_android_game_completion_ad_unit_id: 'Interstitial ad unit shown after game completion or game exit.',
  admob_android_interstitial_nav_ad_unit_id: 'Interstitial ad unit shown on tab/nav transitions.',
  admob_android_wallet_interstitial_ad_unit_id: 'Interstitial ad unit shown when switching into Wallet.',
  admob_android_native_ad_unit_id: 'Native advanced ad unit available for native feed placements.',
  admob_android_news_banner_ad_unit_id: 'Banner ad unit shown on news/article detail screens.',
  xp_per_coin_ratio: 'Coins earned per 1 XP awarded (e.g. 2 = 1 XP per 2 coins).',
  signup_bonus_coins: 'One-time coins credited the moment a new account is created.',
  streak_freeze_cost_coins: 'Coin cost to buy one streak-freeze token (auto-protects the next missed day).',
  streak_freeze_max: 'Maximum streak-freeze tokens a user can hold at once.',
  read_reward_min_seconds: 'Minimum dwell time on a Discover article before the read reward can be claimed.',
  read_reward_daily_cap: 'Maximum read-reward claims counted per user per day.',
  read_reward_xp: 'XP (not coins) awarded for a qualifying article read.',
  roulette_level_bonus_interval: 'Levels per bonus roulette spin (e.g. 5 = +1 free spin every 5 levels).',
};

const categories: ConfigCategory[] = [
  {
    title: '💰 Economy',
    subtitle: 'Coin issuance, exchange value, and daily bonuses.',
    tone: 'economy',
    keys: [
      'ad_rewarded_coins',
      'ad_rewarded_interstitial_coins',
      'ad_rewarded_discover_coins',
      'short_watch_reward_coins',
      'daily_bonus_coins',
      'coin_to_inr_rate',
    ],
  },
  {
    title: '🎯 Limits & Caps',
    subtitle: 'Fraud-resistant earning and redemption boundaries.',
    tone: 'limits',
    keys: ['daily_ad_cap', 'ad_cooldown_seconds', 'min_withdrawal_coins', 'short_daily_cap'],
  },
  {
    title: '📡 AdMob',
    subtitle: 'Backend-managed app and ad unit IDs consumed by the mobile app.',
    tone: 'ads',
    keys: [
      'admob_android_app_id',
      'admob_android_app_open_ad_unit_id',
      'admob_android_rewarded_card_ad_unit_id',
      'admob_android_rewarded_discover_ad_unit_id',
      'admob_android_rewarded_interstitial_card_ad_unit_id',
      'admob_android_game_completion_ad_unit_id',
      'admob_android_interstitial_nav_ad_unit_id',
      'admob_android_wallet_interstitial_ad_unit_id',
      'admob_android_native_ad_unit_id',
      'admob_android_news_banner_ad_unit_id',
    ],
  },
  {
    title: '🎮 App Behavior',
    subtitle: 'Runtime behavior switches and interaction timing.',
    tone: 'behavior',
    keys: ['short_watch_seconds_required', 'offerwall_demo_mode', 'post_ad_lockout_ms', 'xp_per_coin_ratio'],
  },
  {
    title: '🛡️ Retention & Engagement',
    subtitle: 'Signup bonus, streak freezes, and the Discover read-reward. Level XP thresholds and streak-milestone bonuses now live on the Progression page; referral commission rates and tier-escalation timing live on the Referral Tree page.',
    tone: 'retention',
    keys: [
      'signup_bonus_coins',
      'streak_freeze_cost_coins',
      'streak_freeze_max',
      'read_reward_xp',
      'read_reward_min_seconds',
      'read_reward_daily_cap',
      'roulette_level_bonus_interval',
    ],
  },
];

const toneClasses = {
  economy: {
    border: 'border-emerald-400/30',
    glow: 'shadow-[0_0_40px_rgba(16,185,129,0.10)]',
    pill: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
    dot: 'bg-emerald-400',
  },
  limits: {
    border: 'border-blue-400/30',
    glow: 'shadow-[0_0_40px_rgba(74,158,255,0.10)]',
    pill: 'bg-blue-400/10 text-blue-300 border-blue-400/25',
    dot: 'bg-blue-400',
  },
  streaks: {
    border: 'border-orange-400/30',
    glow: 'shadow-[0_0_40px_rgba(255,122,26,0.12)]',
    pill: 'bg-orange-400/10 text-orange-300 border-orange-400/25',
    dot: 'bg-orange-400',
  },
  behavior: {
    border: 'border-purple-400/30',
    glow: 'shadow-[0_0_40px_rgba(168,85,247,0.10)]',
    pill: 'bg-purple-400/10 text-purple-300 border-purple-400/25',
    dot: 'bg-purple-400',
  },
  ads: {
    border: 'border-cyan-400/30',
    glow: 'shadow-[0_0_40px_rgba(34,211,238,0.10)]',
    pill: 'bg-cyan-400/10 text-cyan-200 border-cyan-400/25',
    dot: 'bg-cyan-400',
  },
  retention: {
    border: 'border-pink-400/30',
    glow: 'shadow-[0_0_40px_rgba(244,114,182,0.10)]',
    pill: 'bg-pink-400/10 text-pink-300 border-pink-400/25',
    dot: 'bg-pink-400',
  },
};

const criticalKeys = new Set([
  'ad_rewarded_coins',
  'ad_rewarded_interstitial_coins',
  'ad_rewarded_discover_coins',
  'daily_ad_cap',
  'admob_android_app_id',
  'admob_android_app_open_ad_unit_id',
  'admob_android_rewarded_card_ad_unit_id',
  'admob_android_rewarded_interstitial_card_ad_unit_id',
  'admob_android_game_completion_ad_unit_id',
  'admob_android_native_ad_unit_id',
  'admob_android_news_banner_ad_unit_id',
]);

const ConfigPage = () => {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newConfig, setNewConfig] = useState({ key: '', value: '' });
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then(res => setConfigs(res.data.data || []))
      .catch(err => {
        console.error(err);
        setError('Failed to load configuration.');
      })
      .finally(() => setLoading(false));
  }, []);

  const configMap = useMemo(() => new Map(configs.map(config => [config.key, config])), [configs]);
  const configuredKeys = new Set(configs.map(config => config.key));
  const groupedKeys = new Set(categories.flatMap(category => category.keys));
  const customConfigs = configs.filter(config => !groupedKeys.has(config.key));

  const validateConfig = (key: string, value: string) => {
    if (!/^[a-z0-9_]{2,80}$/.test(key)) return 'Keys must use lowercase letters, numbers, and underscores.';
    if (value.trim().length === 0) return 'Value cannot be empty.';
    return '';
  };

  const handleSave = async (key: string) => {
    const validationError = validateConfig(key, editValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError('');
      setSavingKey(key);
      await updateConfig(key, editValue);
      setConfigs(current => {
        const exists = current.some(config => config.key === key);
        return exists
          ? current.map(config => (config.key === key ? { ...config, value: editValue } : config))
          : [{ key, value: editValue }, ...current];
      });
      setEditingKey(null);
    } catch (err) {
      console.error(err);
      setError('Failed to update configuration. Check the value and try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = newConfig.key.trim().toLowerCase();
    const value = newConfig.value.trim();
    const validationError = validateConfig(key, value);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError('');
      setSavingKey(key);
      await updateConfig(key, value);
      setConfigs(current => [{ key, value }, ...current.filter(config => config.key !== key)]);
      setNewConfig({ key: '', value: '' });
      setAdding(false);
    } catch {
      setError('Could not add this configuration key.');
    } finally {
      setSavingKey(null);
    }
  };

  const renderConfigRow = (config: ConfigEntry, tone: ConfigCategory['tone']) => {
    const classes = toneClasses[tone];
    const isEditing = editingKey === config.key;
    const ratePreview = config.key === 'coin_to_inr_rate' && isEditing && Number.isFinite(Number(editValue))
      ? `1,000 coins ≈ ₹${(1000 * Number(editValue)).toFixed(2)}`
      : null;

    return (
      <div
        key={config.key}
        className="group rounded-2xl border border-white/10 bg-[#1E1E1E]/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FFD700]/30 hover:bg-[#252525]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${classes.dot}`} />
              <h3 className="font-mono text-sm font-semibold text-white">{config.key}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes.pill}`}>
                {tone}
              </span>
              {criticalKeys.has(config.key) && (
                <span className="inline-flex items-center rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[11px] font-bold text-yellow-200">
                  <AlertTriangle size={12} className="mr-1" /> Critical
                </span>
              )}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-white/55">{descriptions[config.key] || 'Custom runtime configuration.'}</p>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-[360px]">
            {isEditing ? (
              <div className="rounded-xl border border-[#FFD700]/30 bg-black/30 p-2">
                <input
                  autoFocus
                  value={editValue}
                  onChange={event => setEditValue(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 font-mono text-sm text-white outline-none transition focus:border-[#FFD700]/60 focus:ring-2 focus:ring-[#FFD700]/15"
                />
                {ratePreview && <p className="mt-2 text-xs font-medium text-[#FFD700]">{ratePreview}</p>}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white">
                {config.value}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
                  >
                    <X size={15} className="mr-1.5" /> Cancel
                  </button>
                  <button
                    onClick={() => handleSave(config.key)}
                    disabled={savingKey === config.key}
                    className="inline-flex items-center rounded-lg bg-[#FFD700] px-3 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60"
                  >
                    <Save size={15} className="mr-1.5" /> {savingKey === config.key ? 'Saving' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditingKey(config.key);
                    setEditValue(config.value);
                  }}
                  className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 transition hover:border-[#FFD700]/35 hover:bg-[#FFD700]/10 hover:text-[#FFD700]"
                >
                  <Edit3 size={15} className="mr-1.5" /> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A] p-6 text-white">Loading config...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 text-white">
      <div className="mb-8 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,215,0,0.18),transparent_34%),linear-gradient(135deg,#161616,#0A0A0A)] p-6 shadow-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-xs font-bold text-[#FFD700]">
              <Radio size={14} className="mr-2" /> Monetization Control
            </div>
            <h1 className="flex items-center text-3xl font-black tracking-tight text-white">
              <Settings className="mr-3 text-[#FFD700]" /> System Configuration
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Admin-controlled runtime values for rewards, caps, and app behavior. Revenue-critical settings are flagged before edits.
              Level/streak progression lives on <span className="font-semibold text-white/80">Progression</span>, referral rates on{' '}
              <span className="font-semibold text-white/80">Referral Tree</span>, roulette on <span className="font-semibold text-white/80">Roulette Config</span>.
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center justify-center rounded-2xl bg-[#FFD700] px-5 py-3 text-sm font-black text-black shadow-[0_0_28px_rgba(255,215,0,0.22)] transition hover:-translate-y-0.5 hover:bg-yellow-300"
          >
            <Plus size={17} className="mr-2" /> Add Config
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {categories.map(category => {
          const classes = toneClasses[category.tone];
          const entries = category.keys.map(key => configMap.get(key) || { key, value: configuredKeys.has(key) ? configMap.get(key)!.value : 'Not set' });

          return (
            <section key={category.title} className={`rounded-[24px] border bg-[#161616] p-5 ${classes.border} ${classes.glow}`}>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">{category.title}</h2>
                  <p className="mt-1 text-sm text-white/50">{category.subtitle}</p>
                </div>
                <span className={`self-start rounded-full border px-3 py-1 text-xs font-bold sm:self-auto ${classes.pill}`}>
                  {entries.length} settings
                </span>
              </div>
              <div className="space-y-3">
                {entries.map(entry => renderConfigRow(entry, category.tone))}
              </div>
            </section>
          );
        })}

        {customConfigs.length > 0 && (
          <section className="rounded-[24px] border border-white/10 bg-[#161616] p-5">
            <div className="mb-5">
              <h2 className="text-xl font-black text-white">Custom Configs</h2>
              <p className="mt-1 text-sm text-white/50">Additional runtime values not assigned to a default category.</p>
            </div>
            <div className="space-y-3">{customConfigs.map(entry => renderConfigRow(entry, 'behavior'))}</div>
          </section>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-[#161616] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-black text-white">Add Configuration</h2>
                <p className="mt-1 text-xs text-white/45">Use snake_case keys and string values.</p>
              </div>
              <button onClick={() => setAdding(false)} className="rounded-full p-2 text-white/45 transition hover:bg-white/10 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddConfig} className="space-y-4 p-5">
              <div>
                <label htmlFor="config-key" className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Key</label>
                <input
                  id="config-key"
                  required
                  value={newConfig.key}
                  onChange={event => setNewConfig({ ...newConfig, key: event.target.value.toLowerCase() })}
                  placeholder="example_config_key"
                  className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 font-mono text-sm text-white outline-none transition focus:border-[#FFD700]/60 focus:ring-2 focus:ring-[#FFD700]/15"
                />
              </div>
              <div>
                <label htmlFor="config-value" className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Value</label>
                <input
                  id="config-value"
                  required
                  value={newConfig.value}
                  onChange={event => setNewConfig({ ...newConfig, value: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 font-mono text-sm text-white outline-none transition focus:border-[#FFD700]/60 focus:ring-2 focus:ring-[#FFD700]/15"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAdding(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-white/55 transition hover:bg-white/5 hover:text-white">
                  Cancel
                </button>
                <button className="inline-flex items-center rounded-xl bg-[#FFD700] px-4 py-2 text-sm font-black text-black transition hover:bg-yellow-300">
                  <Check size={16} className="mr-1.5" /> Save Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPage;
