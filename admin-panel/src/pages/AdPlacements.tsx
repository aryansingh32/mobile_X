import React, { useState, useEffect } from 'react';
import { getAdPlacements, createAdPlacement, updateAdPlacement, deleteAdPlacement } from '../services/api';
import { Radio, Plus, Trash2, Save, X, Zap, Eye, ToggleLeft, ToggleRight } from 'lucide-react';

interface AdPlacement {
  id: number; key: string; screen: string; adFormat: string; enabled: boolean;
  intervalMin: number; intervalMax: number; cooldownSeconds: number;
  maxPerSession: number; skipFirstNActions: number; adUnitKey: string;
  titleKey?: string; descriptionKey?: string; ctaLabelKey?: string;
  updatedAt: string;
}

const SCREENS = ['DISCOVER', 'SHORTS', 'HOME', 'WALLET', 'GAMES', 'GLOBAL', 'ARTICLE_DETAIL'];
const FORMATS = ['APP_OPEN', 'REWARDED', 'REWARDED_INTERSTITIAL', 'BANNER', 'NATIVE', 'INTERSTITIAL'];

const AdPlacements: React.FC = () => {
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<AdPlacement>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newData, setNewData] = useState({ key: '', screen: 'DISCOVER', adFormat: 'REWARDED', adUnitKey: '', intervalMin: 3, intervalMax: 6, cooldownSeconds: 45, maxPerSession: 8, skipFirstNActions: 2 });
  const [saving, setSaving] = useState(false);

  const fetchPlacements = async () => {
    try {
      const { data } = await getAdPlacements();
      setPlacements(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchPlacements(); }, []);

  const handleToggle = async (p: AdPlacement) => {
    try {
      await updateAdPlacement(p.id, { enabled: !p.enabled });
      fetchPlacements();
    } catch (e) { console.error(e); }
  };

  const handleSave = async (id: number) => {
    if ((editData.intervalMin ?? 0) > (editData.intervalMax ?? 0)) {
      alert('Interval Min must be <= Interval Max');
      return;
    }
    setSaving(true);
    try {
      await updateAdPlacement(id, editData);
      setEditId(null);
      fetchPlacements();
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to save'); }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (newData.intervalMin > newData.intervalMax) {
      alert('Interval Min must be <= Interval Max');
      return;
    }
    setSaving(true);
    try {
      await createAdPlacement(newData);
      setShowCreate(false);
      setNewData({ key: '', screen: 'DISCOVER', adFormat: 'REWARDED', adUnitKey: '', intervalMin: 3, intervalMax: 6, cooldownSeconds: 45, maxPerSession: 8, skipFirstNActions: 2 });
      fetchPlacements();
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to create'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this placement? This cannot be undone.')) return;
    try {
      await deleteAdPlacement(id);
      fetchPlacements();
    } catch (e) { console.error(e); }
  };

  const formatScreenBadge = (screen: string) => {
    const colors: Record<string, string> = {
      DISCOVER: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      SHORTS: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      HOME: 'bg-green-500/20 text-green-300 border-green-500/30',
      GLOBAL: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      WALLET: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    };
    return colors[screen] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  if (loading) return <div className="p-6 text-gray-400">Loading ad placements…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Radio className="text-yellow-400" size={28} /> Ad Placement Engine
          </h1>
          <p className="text-gray-400 text-sm mt-1">Control where and how often ads appear across the app. Works alongside AdMob dashboard caps.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg hover:bg-yellow-500/20 transition-colors">
          <Plus size={18} /> New Placement
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 bg-[#161616] border border-yellow-500/30 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Create New Placement</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Key (unique)</label>
              <input value={newData.key} onChange={e => setNewData({...newData, key: e.target.value})} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm" placeholder="discover_feed_card" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Screen</label>
              <select value={newData.screen} onChange={e => setNewData({...newData, screen: e.target.value})} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm">
                {SCREENS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Ad Format</label>
              <select value={newData.adFormat} onChange={e => setNewData({...newData, adFormat: e.target.value})} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm">
                {FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Ad Unit Key</label>
              <input value={newData.adUnitKey} onChange={e => setNewData({...newData, adUnitKey: e.target.value})} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm" placeholder="REWARDED_DISCOVER" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[['Interval Min', 'intervalMin'], ['Interval Max', 'intervalMax'], ['Cooldown (s)', 'cooldownSeconds'], ['Max/Session', 'maxPerSession']].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                <input type="number" min={0} value={(newData as any)[key]} onChange={e => setNewData({...newData, [key]: Math.max(0, parseInt(e.target.value) || 0)})} className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !newData.key || !newData.adUnitKey} className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors">
              {saving ? 'Creating…' : 'Create Placement'}
            </button>
          </div>
        </div>
      )}

      {/* Placements Table */}
      <div className="space-y-3">
        {placements.map(p => (
          <div key={p.id} className={`bg-[#161616] border rounded-xl p-4 transition-all ${p.enabled ? 'border-[#333]' : 'border-red-500/30 opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggle(p)} title={p.enabled ? 'Disable' : 'Enable'}>
                  {p.enabled ? <ToggleRight className="text-green-400" size={24} /> : <ToggleLeft className="text-red-400" size={24} />}
                </button>
                <code className="text-yellow-300 text-sm font-mono bg-yellow-500/10 px-2 py-0.5 rounded">{p.key}</code>
                <span className={`text-xs px-2 py-0.5 rounded border ${formatScreenBadge(p.screen)}`}>{p.screen}</span>
                <span className="text-xs text-gray-400 bg-[#252525] px-2 py-0.5 rounded">{p.adFormat}</span>
              </div>
              <div className="flex items-center gap-2">
                {editId === p.id ? (
                  <>
                    <button onClick={() => handleSave(p.id)} disabled={saving} className="text-green-400 hover:text-green-300"><Save size={18} /></button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(p.id); setEditData(p); }} className="text-gray-400 hover:text-yellow-300 transition-colors text-sm">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </div>

            {editId === p.id ? (
              <div className="grid grid-cols-5 gap-3">
                {[['Interval Min', 'intervalMin'], ['Interval Max', 'intervalMax'], ['Cooldown (s)', 'cooldownSeconds'], ['Max/Session', 'maxPerSession'], ['Skip First N', 'skipFirstNActions']].map(([label, key]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-400">{label}</label>
                    <input type="number" min={0} value={(editData as any)[key] ?? ''} onChange={e => setEditData({...editData, [key]: Math.max(0, parseInt(e.target.value) || 0)})} className="w-full bg-[#252525] border border-[#333] rounded px-2 py-1 text-white text-sm mt-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-6 text-xs text-gray-400">
                <span><Zap size={12} className="inline mr-1 text-yellow-400" /> Interval: {p.intervalMin}–{p.intervalMax}</span>
                <span>Cooldown: {p.cooldownSeconds}s</span>
                <span>Max/session: {p.maxPerSession}</span>
                <span>Skip first: {p.skipFirstNActions}</span>
                <span className="text-gray-500">Unit: {p.adUnitKey}</span>
              </div>
            )}
          </div>
        ))}
        {placements.length === 0 && <p className="text-gray-500 text-center py-8">No placements configured. Create one to get started.</p>}
      </div>
    </div>
  );
};

export default AdPlacements;
