import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Save, X, RefreshCw, BarChart2, Check, XCircle } from 'lucide-react';
import { 
  getRouletteItems, createRouletteItem, updateRouletteItem, deleteRouletteItem, getRouletteAnalytics, getConfig, updateConfig 
} from '../services/api';

type RouletteItem = {
  id: number;
  label: string;
  color: string;
  rewardCoins: number;
  probability: number;
  sizePortion: number;
  popupType: string;
  imageUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const createArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, r, endAngle);
  const end = polarToCartesian(x, y, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', x, y,
    'L', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
    'Z'
  ].join(' ');
};

const WheelPreview = ({ items }: { items: RouletteItem[] }) => {
  const activeItems = items.filter(i => i.isActive).sort((a,b) => a.sortOrder - b.sortOrder);
  if (activeItems.length === 0) return <div className="text-gray-500 text-sm italic p-10 text-center">No active slices to preview</div>;

  const totalPortion = activeItems.reduce((sum, item) => sum + item.sizePortion, 0);
  let currentAngle = 0;
  
  const SIZE = 240;
  const CENTER = SIZE / 2;

  return (
    <div className="relative w-[240px] h-[240px] mx-auto rounded-full border-4 border-gray-800 bg-black overflow-hidden shadow-2xl">
      <svg width={SIZE} height={SIZE}>
        {activeItems.map((slice) => {
          const angle = (slice.sizePortion / totalPortion) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;
          const centerAngle = startAngle + angle / 2;

          const path = createArc(CENTER, CENTER, CENTER - 4, startAngle, endAngle);
          const textRadius = CENTER - 40;
          const textPos = polarToCartesian(CENTER, CENTER, textRadius, centerAngle);
          const isDark = parseInt(slice.color.replace('#',''), 16) > 0xffffff/2;

          return (
            <g key={slice.id}>
              <path d={path} fill={slice.color} stroke="#111" strokeWidth="2" />
              <text
                x={textPos.x}
                y={textPos.y}
                fill={isDark ? '#000' : '#fff'}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
                transform={`rotate(${centerAngle + 90} ${textPos.x} ${textPos.y})`}
              >
                {slice.label}
              </text>
            </g>
          );
        })}
        <circle cx={CENTER} cy={CENTER} r="15" fill="#111" />
        <circle cx={CENTER} cy={CENTER} r="8" fill="#FFD700" />
      </svg>
      {/* Pointer */}
      <svg width="20" height="24" className="absolute top-[-2px] left-1/2 -translate-x-1/2 z-10 drop-shadow-md">
        <polygon points="10,24 0,0 20,0" fill="#FFD700" stroke="#111" strokeWidth="2" />
      </svg>
    </div>
  );
};

const RouletteConfig = () => {
  const [items, setItems] = useState<RouletteItem[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'config' | 'analytics'>('config');
  const [isRouletteEnabled, setIsRouletteEnabled] = useState(true);
  const [dailyChances, setDailyChances] = useState(2);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<RouletteItem>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRouletteItems();
      setItems(res.data.data);
      const stats = await getRouletteAnalytics();
      setAnalytics(stats.data.data);
      const confRes = await getConfig();
      const enabledConf = confRes.data.data?.find((c: any) => c.key === 'roulette_enabled');
      setIsRouletteEnabled(enabledConf ? enabledConf.value === 'true' : true);
      const chancesConf = confRes.data.data?.find((c: any) => c.key === 'roulette_daily_chances');
      setDailyChances(chancesConf ? parseInt(chancesConf.value, 10) : 2);
    } catch (error) {
      console.error(error);
      alert('Error fetching data');
    }
    setLoading(false);
  };

  const handleCreate = () => {
    setEditingId(0);
    setFormData({
      label: 'New Slice',
      color: '#ff0000',
      rewardCoins: 100,
      probability: 10,
      sizePortion: 1,
      popupType: 'WINNING',
      isActive: true,
      sortOrder: items.length + 1
    });
  };

  const handleEdit = (item: RouletteItem) => {
    setEditingId(item.id);
    setFormData(item);
  };

  const handleDuplicate = (item: RouletteItem) => {
    setEditingId(0);
    setFormData({
      ...item,
      id: undefined,
      label: item.label + ' (Copy)',
      sortOrder: items.length + 1
    });
  };

  const handleSave = async () => {
    try {
      if (editingId === 0) {
        await createRouletteItem(formData);
      } else {
        await updateRouletteItem(editingId!, formData);
      }
      setEditingId(null);
      fetchData();
    } catch (error) {
      alert('Error saving item');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this slice?')) return;
    try {
      await deleteRouletteItem(id);
      fetchData();
    } catch (error) {
      alert('Error deleting item');
    }
  };

  const toggleActive = async (item: RouletteItem) => {
    try {
      await updateRouletteItem(item.id, { isActive: !item.isActive });
      fetchData();
    } catch (error) {
      alert('Error toggling status');
    }
  };

  const handleToggleEnable = async () => {
    const newVal = !isRouletteEnabled;
    try {
      await updateConfig('roulette_enabled', String(newVal));
      setIsRouletteEnabled(newVal);
    } catch (error) {
      alert('Error updating global setting');
    }
  };

  const handleUpdateChances = async (val: number) => {
    try {
      await updateConfig('roulette_daily_chances', String(val));
    } catch (error) {
      alert('Error updating daily chances');
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  const totalProbability = items.reduce((sum, i) => sum + (i.isActive ? i.probability : 0), 0);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Roulette Wheel Configuration</h1>
            <div className="flex items-center gap-2 mt-1">
              <label className="text-sm text-gray-400">Global Enable:</label>
              <button 
                onClick={handleToggleEnable} 
                className={`w-10 h-5 rounded-full relative transition-colors ${isRouletteEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isRouletteEnabled ? 'left-[22px]' : 'left-0.5'}`}></div>
              </button>

              <label className="text-sm text-gray-400 ml-6">Daily Ad Chances:</label>
              <input 
                type="number" 
                min="0"
                value={dailyChances} 
                onChange={(e) => setDailyChances(parseInt(e.target.value) || 0)}
                onBlur={(e) => handleUpdateChances(parseInt(e.target.value) || 0)}
                className="w-16 bg-gray-800 border border-gray-700 text-white rounded px-2 py-0.5 text-sm text-center"
              />
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-1">Manage slices, probabilities, and analytics</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setView('config')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'config' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Config
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'analytics' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Analytics
            </button>
          </div>
          <button onClick={fetchData} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {view === 'config' ? (
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="xl:w-1/3 space-y-6">
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-6 text-center">Live Preview</h2>
              <WheelPreview items={items} />
              <div className="text-center mt-6 text-xs text-gray-500">
                This is how the wheel will appear in the mobile app.
              </div>
            </div>
          </div>
          
          <div className="xl:w-2/3 space-y-6">
            <div className="bg-black/20 p-4 rounded-lg border border-white/5 flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-400">Total Active Probability</div>
              <div className={`text-xl font-bold ${totalProbability > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalProbability.toFixed(1)} (sum of weights)
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus size={18} /> Add Slice
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map(item => (
              <div key={item.id} className={`bg-[#1A1A1A] border ${item.isActive ? 'border-gray-800' : 'border-red-900/50 opacity-60'} rounded-xl p-5`}>
                {editingId === item.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Label</label>
                      <input type="text" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Color</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-8 h-8 rounded border border-gray-700 p-0" />
                          <input type="text" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="flex-1 bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                        </div>
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-gray-400 block mb-1">Sort Order</label>
                        <input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Reward (Coins)</label>
                        <input type="number" value={formData.rewardCoins} onChange={e => setFormData({ ...formData, rewardCoins: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Weight / Prob.</label>
                        <input type="number" step="0.1" value={formData.probability} onChange={e => setFormData({ ...formData, probability: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="text-xs text-gray-400 block mb-1">Image URL (Optional)</label>
                      <input type="text" placeholder="https://example.com/icon.png" value={formData.imageUrl || ''} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Visual Size (Portion)</label>
                        <input type="number" step="0.1" value={formData.sizePortion} onChange={e => setFormData({ ...formData, sizePortion: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Popup Type</label>
                        <select value={formData.popupType} onChange={e => setFormData({ ...formData, popupType: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm">
                          <option value="WINNING">Winning</option>
                          <option value="CONGRATULATION">Congratulation</option>
                          <option value="BETTER_LUCK">Better Luck</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} id="active-edit" />
                      <label htmlFor="active-edit" className="text-sm text-gray-300">Is Active</label>
                    </div>
                    
                    <div className="flex gap-2 justify-end pt-2 border-t border-gray-800">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white flex items-center gap-1"><X size={16}/> Cancel</button>
                      <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded flex items-center gap-1"><Save size={16}/> Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-gray-700" style={{ backgroundColor: item.color }}></div>
                        <div>
                          <h3 className="font-bold text-white">{item.label}</h3>
                          <p className="text-xs text-gray-500">Order: {item.sortOrder}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => toggleActive(item)} className="p-1.5 text-gray-400 hover:text-white bg-black/30 rounded">
                          {item.isActive ? <Check size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-500" />}
                        </button>
                        <button onClick={() => handleEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-400 bg-black/30 rounded"><Edit size={16}/></button>
                        <button onClick={() => handleDuplicate(item)} className="p-1.5 text-gray-400 hover:text-green-400 bg-black/30 rounded"><Copy size={16}/></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-400 bg-black/30 rounded"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 bg-black/30 p-3 rounded-lg mb-2">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Reward</div>
                        <div className="font-medium text-yellow-400">{item.rewardCoins} Coins</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Probability</div>
                        <div className="font-medium text-blue-400">{item.probability} (wt)</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Size Portion</div>
                        <div className="font-medium text-gray-300">{item.sizePortion}x</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Popup Type</div>
                        <div className="font-medium text-gray-300 text-xs">{item.popupType}</div>
                      </div>
                      {item.imageUrl && (
                        <div className="col-span-2 mt-1">
                           <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Image URL</div>
                           <div className="font-medium text-gray-400 text-xs truncate" title={item.imageUrl}>{item.imageUrl}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {editingId === 0 && (
              <div className="bg-[#1A1A1A] border border-blue-500/50 rounded-xl p-5">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Label</label>
                    <input type="text" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 block mb-1">Color (Hex)</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-8 h-8 rounded border border-gray-700 p-0" />
                        <input type="text" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="flex-1 bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                      </div>
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-gray-400 block mb-1">Sort Order</label>
                      <input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 block mb-1">Reward (Coins)</label>
                      <input type="number" value={formData.rewardCoins} onChange={e => setFormData({ ...formData, rewardCoins: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 block mb-1">Weight / Prob.</label>
                      <input type="number" step="0.1" value={formData.probability} onChange={e => setFormData({ ...formData, probability: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 block mb-1">Image URL (Optional)</label>
                    <input type="text" placeholder="https://example.com/icon.png" value={formData.imageUrl || ''} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 block mb-1">Visual Size (Portion)</label>
                      <input type="number" step="0.1" value={formData.sizePortion} onChange={e => setFormData({ ...formData, sizePortion: Number(e.target.value) })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 block mb-1">Popup Type</label>
                      <select value={formData.popupType} onChange={e => setFormData({ ...formData, popupType: e.target.value })} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm">
                        <option value="WINNING">Winning</option>
                        <option value="CONGRATULATION">Congratulation</option>
                        <option value="BETTER_LUCK">Better Luck</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} id="active-new" />
                    <label htmlFor="active-new" className="text-sm text-gray-300">Is Active</label>
                  </div>
                  
                  <div className="flex gap-2 justify-end pt-2 border-t border-gray-800">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white flex items-center gap-1"><X size={16}/> Cancel</button>
                    <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded flex items-center gap-1"><Save size={16}/> Create</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BarChart2 size={20} className="text-blue-400" />
              Spin Distribution
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/40 text-gray-500">
                  <tr>
                    <th className="p-3 font-medium rounded-tl-lg">Item</th>
                    <th className="p-3 font-medium">Total Spins</th>
                    <th className="p-3 font-medium rounded-tr-lg">Total Coins Awarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {analytics?.summary?.map((row: any) => {
                    const item = analytics.items.find((i: any) => i.id === row.rouletteItemId);
                    return (
                      <tr key={row.rouletteItemId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item?.color || '#555' }}></div>
                          {item?.label || `Deleted Item (${row.rouletteItemId})`}
                        </td>
                        <td className="p-3">{row._count.id}</td>
                        <td className="p-3 text-yellow-400 font-medium">{row._sum.coinsAwarded}</td>
                      </tr>
                    );
                  })}
                  {(!analytics?.summary || analytics.summary.length === 0) && (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">No spin history recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Recent Spins (Last 100)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/40 text-gray-500">
                  <tr>
                    <th className="p-3 font-medium rounded-tl-lg">User</th>
                    <th className="p-3 font-medium">Item Won</th>
                    <th className="p-3 font-medium">Reward</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium rounded-tr-lg">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {analytics?.recentSpins?.map((spin: any) => (
                    <tr key={spin.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">{spin.user?.name || spin.user?.email || `User ${spin.userId}`}</td>
                      <td className="p-3">{spin.rouletteItem?.label || 'Unknown'}</td>
                      <td className="p-3 text-yellow-400">{spin.coinsAwarded > 0 ? `+${spin.coinsAwarded}` : '0'}</td>
                      <td className="p-3 text-xs">{spin.spinType}</td>
                      <td className="p-3 text-gray-500">{new Date(spin.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!analytics?.recentSpins || analytics.recentSpins.length === 0) && (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">No recent spins.</td></tr>
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

export default RouletteConfig;
