import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, Edit2, Eye, Plus, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';
import { createMission, deleteMission, getMissions, updateMission } from '../services/api';

type MissionForm = {
  title: string;
  description: string;
  targetCount: number;
  rewardXp: number;
  rewardCoins: number;
  type: 'DAILY' | 'ONETIME';
  isActive: boolean;
  activeFrom: string;
  activeTo: string;
  iconEmoji: string;
  tags: string;
  metricType: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
};

const initialForm: MissionForm = {
  title: '',
  description: '',
  targetCount: 1,
  rewardXp: 10,
  rewardCoins: 50,
  type: 'DAILY',
  isActive: true,
  activeFrom: '',
  activeTo: '',
  iconEmoji: '🎯',
  difficulty: 'EASY',
  tags: '',
  metricType: 'CUSTOM',
};

const Missions = () => {
  const [missions, setMissions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [previewMission, setPreviewMission] = useState<MissionForm>(initialForm);
  const [formData, setFormData] = useState<MissionForm>(initialForm);

  const fetchMissions = () => {
    getMissions()
      .then(res => setMissions(res.data.data || res.data || []))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  useEffect(() => {
    setPreviewMission(formData);
  }, [formData]);

  const bulkToggle = async (isActive: boolean) => {
    try {
      await Promise.all(selectedIds.map(id => updateMission(id, { isActive })));
      setSelectedIds([]);
      fetchMissions();
    } catch (err) {
      console.error(err);
      alert('Failed to update selected missions');
    }
  };

  const handleAdd = () => {
    setEditingMission(null);
    setFormData(initialForm);
    setIsModalOpen(true);
  };

  const handleEdit = (mission: any) => {
    setEditingMission(mission);
    setFormData({
      title: mission.title || '',
      description: mission.description || '',
      targetCount: mission.targetCount || 1,
      rewardXp: mission.rewardXp || 0,
      rewardCoins: mission.rewardCoins || 0,
      type: mission.type || 'DAILY',
      isActive: mission.isActive ?? true,
      activeFrom: mission.activeFrom ? String(mission.activeFrom).slice(0, 16) : '',
      activeTo: mission.activeTo ? String(mission.activeTo).slice(0, 16) : '',
      iconEmoji: mission.iconEmoji || '🎯',
      difficulty: mission.difficulty || 'EASY',
      tags: mission.tags ? mission.tags.join(', ') : '',
      metricType: mission.metricType || 'CUSTOM',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this mission?')) return;
    try {
      await deleteMission(id);
      fetchMissions();
    } catch (err) {
      console.error(err);
      alert('Failed to delete mission');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSubmit = {
        ...formData,
        targetCount: Number(formData.targetCount),
        rewardXp: Number(formData.rewardXp),
        rewardCoins: Number(formData.rewardCoins),
        activeFrom: formData.activeFrom || null,
        activeTo: formData.activeTo || null,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      if (editingMission) {
        await updateMission(editingMission.id, dataToSubmit);
      } else {
        await createMission(dataToSubmit);
      }
      setIsModalOpen(false);
      fetchMissions();
    } catch (err) {
      console.error(err);
      alert('Failed to save mission');
    }
  };

  const preview = useMemo(() => ({
    progressText: `${formData.targetCount} target`,
    rewardText: `${formData.rewardCoins} 🪙`,
  }), [formData.targetCount, formData.rewardCoins]);

  const toggleSelected = (id: number) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-bold text-orange-300">Mission Builder</div>
          <h1 className="text-3xl font-black tracking-tight">Daily mission control</h1>
          <p className="mt-2 text-sm text-white/55">Active windows, difficulty, and icon metadata are now editable.</p>
        </div>
        <button onClick={handleAdd} className="inline-flex items-center rounded-2xl bg-[#FFD700] px-4 py-3 text-sm font-black text-black transition hover:bg-yellow-300">
          <Plus size={18} className="mr-2" /> Create Mission
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button disabled={selectedIds.length === 0} onClick={() => bulkToggle(true)} className="inline-flex items-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-40">
          <ToggleRight size={16} className="mr-2" /> Bulk activate
        </button>
        <button disabled={selectedIds.length === 0} onClick={() => bulkToggle(false)} className="inline-flex items-center rounded-xl border border-blue-400/25 bg-blue-400/10 px-3 py-2 text-sm font-semibold text-blue-200 disabled:opacity-40">
          <ToggleLeft size={16} className="mr-2" /> Bulk deactivate
        </button>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#161616]">
        <div className="grid grid-cols-[44px_1.2fr_0.6fr_0.6fr_0.7fr_0.6fr_0.6fr_0.8fr_0.7fr_120px] gap-0 border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white/45">
          <div />
          <div>Title</div>
          <div>Type</div>
          <div>Target</div>
          <div>Metric</div>
          <div>Coins</div>
          <div>XP</div>
          <div>Status</div>
          <div>Difficulty</div>
          <div className="text-right">Actions</div>
        </div>
        <div className="divide-y divide-white/5">
          {missions.map(m => {
            const selected = selectedIds.includes(m.id);
            return (
              <div key={m.id} className={`grid grid-cols-[44px_1.2fr_0.6fr_0.6fr_0.7fr_0.6fr_0.6fr_0.8fr_0.7fr_120px] items-center gap-0 px-4 py-4 transition hover:bg-white/5 ${selected ? 'bg-white/5' : ''}`}>
                <div>
                  <input type="checkbox" checked={selected} onChange={() => toggleSelected(m.id)} className="h-4 w-4 accent-[#FFD700]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.iconEmoji || '🎯'}</span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{m.title}</div>
                      <div className="truncate text-xs text-white/45">{m.description}</div>
                    </div>
                  </div>
                </div>
                <div><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/75">{m.type}</span></div>
                <div className="text-white/80">{m.targetCount}</div>
                <div className="truncate text-xs text-white/60">{m.metricType || 'CUSTOM'}</div>
                <div className="font-mono text-[#FFD700]">{m.rewardCoins} 🪙</div>
                <div className="font-mono text-sky-300">{m.rewardXp} XP</div>
                <div>{m.isActive ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">Active</span> : <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/45">Inactive</span>}</div>
                <div className="text-white/75">{m.difficulty || 'EASY'}</div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPreviewMission({ ...m, activeFrom: m.activeFrom || '', activeTo: m.activeTo || '' })} className="rounded-lg border border-white/10 p-2 text-white/60 transition hover:bg-white/5 hover:text-white">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => handleEdit(m)} className="rounded-lg border border-white/10 p-2 text-sky-300 transition hover:bg-sky-400/10">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="rounded-lg border border-white/10 p-2 text-red-300 transition hover:bg-red-400/10">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {missions.length === 0 && (
            <div className="px-6 py-10 text-center text-white/45">No missions found.</div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#161616] p-5">
          <h2 className="mb-4 text-lg font-black">Mission preview</h2>
          <div className="rounded-[20px] border border-[#FFD700]/20 bg-[#1E1E1E] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{previewMission.iconEmoji || '🎯'}</span>
                <div>
                  <div className="font-bold text-white">{previewMission.title || 'Mission title'}</div>
                  <div className="text-xs text-white/45">{previewMission.difficulty} {previewMission.isActive ? 'Active' : 'Inactive'} {previewMission.tags ? `• ${previewMission.tags}` : ''}</div>
                </div>
              </div>
              <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-xs font-semibold text-[#FFD700]">{preview.rewardText}</span>
            </div>
            <p className="text-sm leading-6 text-white/60">{previewMission.description || 'Mission description appears here.'}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-white/45">
              <span>{preview.progressText}</span>
              <span>{previewMission.activeFrom || 'No start'} - {previewMission.activeTo || 'No end'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#161616] p-5">
          <h2 className="mb-4 text-lg font-black">{editingMission ? 'Edit Mission' : 'Create Mission'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Title</span>
                <input className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Icon Emoji</span>
                <input className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.iconEmoji} onChange={e => setFormData({ ...formData, iconEmoji: e.target.value })} />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Description</span>
              <input className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Target Count</span>
                <input type="number" min="1" className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.targetCount} onChange={e => setFormData({ ...formData, targetCount: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Type</span>
                <select className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as MissionForm['type'] })}>
                  <option value="DAILY">DAILY</option>
                  <option value="ONETIME">ONETIME</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Reward Coins</span>
                <input type="number" min="0" className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.rewardCoins} onChange={e => setFormData({ ...formData, rewardCoins: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Reward XP</span>
                <input type="number" min="0" className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.rewardXp} onChange={e => setFormData({ ...formData, rewardXp: Number(e.target.value) })} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Active From</span>
                <input type="datetime-local" className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.activeFrom} onChange={e => setFormData({ ...formData, activeFrom: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Active To</span>
                <input type="datetime-local" className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.activeTo} onChange={e => setFormData({ ...formData, activeTo: e.target.value })} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Tags (comma separated)</span>
                <input className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" placeholder="e.g. FEATURED, PROMO" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Difficulty</span>
                <select className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value as MissionForm['difficulty'] })}>
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Tracking Metric (Auto-updates progress)</span>
              <select className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#FFD700]/60" value={formData.metricType} onChange={e => setFormData({ ...formData, metricType: e.target.value })}>
                <option value="CUSTOM">Custom (No Auto-Track)</option>
                <option value="SCREENTIME_MIN">Screentime (Minutes)</option>
                <option value="NEWS_READ">News Cards Read</option>
                <option value="ADS_WATCHED_DISCOVER">Ads Watched (Discover Feed)</option>
                <option value="ADS_WATCHED_SHORTS">Ads Watched (Shorts Feed)</option>
                <option value="AD_WATCHED">Ads Watched (Any)</option>
                <option value="SHORTS_WATCHED">Shorts Watched</option>
                <option value="GAMES_PLAYED">Games Played</option>
                <option value="REFERRALS">Referrals</option>
                <option value="OFFERWALL">Offerwall Tasks</option>
              </select>
            </label>
            
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3">
              <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="h-4 w-4 accent-[#FFD700]" />
              <span className="text-sm text-white/80">Mission active</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/5">
                <X size={16} className="mr-1.5" /> Cancel
              </button>
              <button type="submit" className="inline-flex items-center rounded-xl bg-[#FFD700] px-4 py-2 text-sm font-black text-black hover:bg-yellow-300">
                <Check size={16} className="mr-1.5" /> Save Mission
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Missions;
