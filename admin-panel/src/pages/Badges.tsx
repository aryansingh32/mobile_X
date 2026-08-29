import React, { useEffect, useState } from 'react';
import { Award, BarChart2, Edit, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { getBadges, createBadge, updateBadge, deleteBadge, getBadgeAnalytics } from '../services/api';

type Badge = {
  id: number;
  name: string;
  description: string;
  conditionType: string;
  conditionValue: number;
  imageUrl?: string | null;
  _count?: { userBadges: number };
};

type BadgeAnalytics = {
  recentEarners: Array<{
    id: number;
    userId: number;
    earnedAt: string;
    user?: { name?: string; email?: string };
    badge?: { name: string };
  }>;
  summary: Array<{ badgeId: number; _count: { id: number } }>;
  badges: Array<{ id: number; name: string; conditionType: string; conditionValue: number }>;
};

const CONDITION_TYPES = ['LEVEL', 'STREAK', 'SHORTS_WATCHED', 'WITHDRAWAL', 'REFERRALS'];

const BadgesPage = () => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [analytics, setAnalytics] = useState<BadgeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'catalog' | 'analytics'>('catalog');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Badge>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getBadges();
      setBadges(res.data.data);
      const stats = await getBadgeAnalytics();
      setAnalytics(stats.data.data);
    } catch (error) {
      console.error(error);
      alert('Error fetching badges');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingId(0);
    setFormData({ name: 'New Badge', description: '', conditionType: 'LEVEL', conditionValue: 1 });
  };

  const handleEdit = (badge: Badge) => {
    setEditingId(badge.id);
    setFormData(badge);
  };

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.description?.trim() || !formData.conditionType) {
      alert('Name, description, and condition type are required.');
      return;
    }
    try {
      if (editingId === 0) {
        await createBadge(formData);
      } else {
        await updateBadge(editingId!, formData);
      }
      setEditingId(null);
      fetchData();
    } catch {
      alert('Error saving badge');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this badge? Users who already earned it will lose it too.')) return;
    try {
      await deleteBadge(id);
      fetchData();
    } catch {
      alert('Error deleting badge');
    }
  };

  const renderForm = (isNew: boolean) => (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Name</label>
        <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Description</label>
        <input type="text" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-gray-400 block mb-1">Condition Type</label>
          <select value={formData.conditionType} onChange={e => setFormData({ ...formData, conditionType: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm">
            {CONDITION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">Must match a checkAndAwardBadges() call site in the backend to actually fire.</p>
        </div>
        <div className="w-32">
          <label className="text-xs text-gray-400 block mb-1">Threshold</label>
          <input type="number" value={formData.conditionValue ?? 0} onChange={e => setFormData({ ...formData, conditionValue: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Image URL (Optional)</label>
        <input type="text" placeholder="https://example.com/badge.png" value={formData.imageUrl || ''} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-gray-800">
        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white flex items-center gap-1"><X size={16} /> Cancel</button>
        <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded flex items-center gap-1"><Save size={16} /> {isNew ? 'Create' : 'Save'}</button>
      </div>
    </div>
  );

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Achievement Badges</h1>
          <p className="text-sm text-gray-400 mt-1">
            Define the badge catalog — awarded automatically by services/badgeService.ts whenever a tracked metric (level, streak,
            shorts watched, withdrawals, referrals) crosses a threshold.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
            <button onClick={() => setView('catalog')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'catalog' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white'}`}>Catalog</button>
            <button onClick={() => setView('analytics')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'analytics' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white'}`}>Analytics</button>
          </div>
          <button onClick={fetchData} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {view === 'catalog' ? (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={handleCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <Plus size={18} /> Add Badge
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {badges.map(badge => (
              <div key={badge.id} className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-5">
                {editingId === badge.id ? renderForm(false) : (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                          <Award size={18} className="text-yellow-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{badge.name}</h3>
                          <p className="text-xs text-gray-500">{badge._count?.userBadges ?? 0} earned</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(badge)} className="p-1.5 text-gray-400 hover:text-blue-400 bg-black/30 rounded"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(badge.id)} className="p-1.5 text-gray-400 hover:text-red-400 bg-black/30 rounded"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{badge.description}</p>
                    <div className="bg-black/30 p-3 rounded-lg text-xs text-gray-300 font-mono">
                      {badge.conditionType} ≥ {badge.conditionValue}
                    </div>
                  </>
                )}
              </div>
            ))}
            {editingId === 0 && (
              <div className="bg-[#1A1A1A] border border-blue-500/50 rounded-xl p-5">{renderForm(true)}</div>
            )}
            {badges.length === 0 && editingId !== 0 && (
              <div className="col-span-full text-center text-gray-500 py-10">
                No badges yet. Run <code className="text-gray-300">npm run seed:badges</code> for the starter catalog, or add one above.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BarChart2 size={20} className="text-blue-400" /> Badges Earned
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/40 text-gray-500">
                  <tr>
                    <th className="p-3 font-medium rounded-tl-lg">Badge</th>
                    <th className="p-3 font-medium rounded-tr-lg">Times Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {analytics?.summary?.map((row) => {
                    const badge = analytics.badges.find((b) => b.id === row.badgeId);
                    return (
                      <tr key={row.badgeId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3">{badge?.name || `Deleted Badge (${row.badgeId})`}</td>
                        <td className="p-3 text-yellow-400 font-medium">{row._count.id}</td>
                      </tr>
                    );
                  })}
                  {(!analytics?.summary || analytics.summary.length === 0) && (
                    <tr><td colSpan={2} className="p-4 text-center text-gray-500">No badges earned yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Recent Earners (Last 100)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/40 text-gray-500">
                  <tr>
                    <th className="p-3 font-medium rounded-tl-lg">User</th>
                    <th className="p-3 font-medium">Badge</th>
                    <th className="p-3 font-medium rounded-tr-lg">Earned At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {analytics?.recentEarners?.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">{row.user?.name || row.user?.email || `User ${row.userId}`}</td>
                      <td className="p-3">{row.badge?.name || 'Unknown'}</td>
                      <td className="p-3 text-gray-500">{new Date(row.earnedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!analytics?.recentEarners || analytics.recentEarners.length === 0) && (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">No recent badge unlocks.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgesPage;
