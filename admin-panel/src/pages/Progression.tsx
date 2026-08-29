import React, { useEffect, useState } from 'react';
import { Flame, Plus, RefreshCw, Save, Star, Trash2 } from 'lucide-react';
import { getConfig, updateConfig } from '../services/api';

const DEFAULT_LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
const DEFAULT_STREAK_MILESTONES: StreakMilestone[] = [
  { day: 7, bonusCoins: 100, title: '🔥 7-Day Streak!', body: 'Amazing! You earned {coins} bonus coins!' },
  { day: 30, bonusCoins: 500, title: '🏆 30-Day Streak!', body: 'Incredible! You earned {coins} bonus coins and a special badge!' },
  { day: 100, bonusCoins: 2000, title: '💯 100-Day Streak!', body: 'Unbelievable! You earned {coins} bonus coins!' },
];

type StreakMilestone = { day: number; bonusCoins: number; title: string; body: string };

const parseJsonArray = <T,>(raw: string | undefined, fallback: T[]): T[] => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const ProgressionPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'levels' | 'streaks' | null>(null);
  const [error, setError] = useState('');
  const [levelThresholds, setLevelThresholds] = useState<number[]>(DEFAULT_LEVEL_THRESHOLDS);
  const [milestones, setMilestones] = useState<StreakMilestone[]>(DEFAULT_STREAK_MILESTONES);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getConfig();
      const rows: Array<{ key: string; value: string }> = res.data.data || [];
      const levelsRow = rows.find(r => r.key === 'level_xp_thresholds');
      const milestonesRow = rows.find(r => r.key === 'streak_milestones');
      setLevelThresholds(parseJsonArray(levelsRow?.value, DEFAULT_LEVEL_THRESHOLDS));
      setMilestones(parseJsonArray(milestonesRow?.value, DEFAULT_STREAK_MILESTONES));
    } catch (err) {
      console.error(err);
      setError('Failed to load progression config.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveLevels = async () => {
    const cleaned = [...levelThresholds].filter(n => Number.isFinite(n)).sort((a, b) => a - b);
    if (cleaned.length === 0) {
      setError('At least one level threshold is required.');
      return;
    }
    setSaving('levels');
    setError('');
    try {
      await updateConfig('level_xp_thresholds', JSON.stringify(cleaned));
      setLevelThresholds(cleaned);
    } catch {
      setError('Failed to save level thresholds.');
    } finally {
      setSaving(null);
    }
  };

  const saveMilestones = async () => {
    if (milestones.some(m => !m.day || m.bonusCoins < 0 || !m.title.trim())) {
      setError('Every streak milestone needs a day, a non-negative bonus, and a title.');
      return;
    }
    setSaving('streaks');
    setError('');
    try {
      const sorted = [...milestones].sort((a, b) => a.day - b.day);
      await updateConfig('streak_milestones', JSON.stringify(sorted));
      setMilestones(sorted);
    } catch {
      setError('Failed to save streak milestones.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Progression</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            The XP required for each level, and every streak-day milestone that pays a bonus — both used to be hardcoded in the
            backend (a fixed 10-level cap, and only days 7/30/100). Editing either here takes effect for every user immediately,
            no app deploy needed.
          </p>
        </div>
        <button onClick={fetchData} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white self-start">
          <RefreshCw size={20} />
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Level Thresholds */}
        <section className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Star size={18} className="text-yellow-400" /> Level XP Thresholds</h2>
            <span className="text-xs text-gray-500">{levelThresholds.length} levels</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Level N requires this much total XP. Add a row to raise the level cap — there is no hardcoded maximum.</p>

          <div className="space-y-2 mb-4">
            {levelThresholds.map((xp, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-16 text-sm text-gray-400 font-mono">Lv. {i + 1}</span>
                <input
                  type="number"
                  min={0}
                  value={xp}
                  onChange={e => {
                    const next = [...levelThresholds];
                    next[i] = Number(e.target.value);
                    setLevelThresholds(next);
                  }}
                  className="flex-1 bg-black/50 border border-gray-700 rounded p-2 text-white text-sm font-mono"
                />
                <span className="text-xs text-gray-500 w-16">XP</span>
                <button
                  onClick={() => setLevelThresholds(levelThresholds.filter((_, idx) => idx !== i))}
                  disabled={levelThresholds.length <= 1}
                  className="p-2 text-gray-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-gray-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            <button
              onClick={() => {
                const last = levelThresholds[levelThresholds.length - 1] ?? 0;
                const prev = levelThresholds[levelThresholds.length - 2] ?? 0;
                const step = Math.max(100, last - prev || 500);
                setLevelThresholds([...levelThresholds, last + step]);
              }}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-700 rounded-lg px-3 py-2"
            >
              <Plus size={15} /> Add Level {levelThresholds.length + 1}
            </button>
            <button
              onClick={saveLevels}
              disabled={saving === 'levels'}
              className="flex items-center gap-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Save size={15} /> {saving === 'levels' ? 'Saving…' : 'Save Levels'}
            </button>
          </div>
        </section>

        {/* Streak Milestones */}
        <section className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Flame size={18} className="text-orange-400" /> Streak Milestones</h2>
            <span className="text-xs text-gray-500">{milestones.length} milestones</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Any day count can pay a bonus, not just 7/30/100. Use <code className="text-gray-300">{'{coins}'}</code> in the body to
            interpolate the bonus amount.
          </p>

          <div className="space-y-4 mb-4">
            {milestones.map((m, i) => (
              <div key={i} className="border border-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-500 block mb-1">Day</label>
                    <input
                      type="number"
                      min={1}
                      value={m.day}
                      onChange={e => {
                        const next = [...milestones];
                        next[i] = { ...m, day: Number(e.target.value) };
                        setMilestones(next);
                      }}
                      className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-500 block mb-1">Bonus Coins</label>
                    <input
                      type="number"
                      min={0}
                      value={m.bonusCoins}
                      onChange={e => {
                        const next = [...milestones];
                        next[i] = { ...m, bonusCoins: Number(e.target.value) };
                        setMilestones(next);
                      }}
                      className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setMilestones(milestones.filter((_, idx) => idx !== i))}
                    className="self-end p-2 text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Notification Title</label>
                  <input
                    type="text"
                    value={m.title}
                    onChange={e => {
                      const next = [...milestones];
                      next[i] = { ...m, title: e.target.value };
                      setMilestones(next);
                    }}
                    className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Notification Body</label>
                  <input
                    type="text"
                    value={m.body}
                    onChange={e => {
                      const next = [...milestones];
                      next[i] = { ...m, body: e.target.value };
                      setMilestones(next);
                    }}
                    className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            <button
              onClick={() => setMilestones([...milestones, { day: 14, bonusCoins: 200, title: '🎉 New Milestone!', body: 'You earned {coins} bonus coins!' }])}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-700 rounded-lg px-3 py-2"
            >
              <Plus size={15} /> Add Milestone
            </button>
            <button
              onClick={saveMilestones}
              disabled={saving === 'streaks'}
              className="flex items-center gap-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Save size={15} /> {saving === 'streaks' ? 'Saving…' : 'Save Milestones'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProgressionPage;
