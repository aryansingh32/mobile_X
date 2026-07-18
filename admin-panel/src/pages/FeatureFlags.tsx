import React, { useState, useEffect } from 'react';
import { getFeatureFlags, updateFeatureFlag } from '../services/api';
import { RefreshCw, ToggleLeft, ToggleRight, Save, Flag, Sliders } from 'lucide-react';

interface FeatureFlag {
  id: number;
  key: string;
  category: string;
  enabled: boolean;
  rolloutPercent: number;
  description: string | null;
  updatedAt: string;
}

const FeatureFlags: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchFlags = async () => {
    try {
      const { data } = await getFeatureFlags();
      setFlags(data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    setSaving(key);
    try {
      await updateFeatureFlag(key, { enabled: !currentEnabled });
      await fetchFlags();
    } catch (e) {
      console.error(e);
      alert('Failed to toggle flag');
    }
    setSaving(null);
  };

  const handleRolloutChange = async (key: string, percent: number) => {
    setSaving(key);
    try {
      await updateFeatureFlag(key, { rolloutPercent: percent });
      await fetchFlags();
    } catch (e) {
      console.error(e);
      alert('Failed to update rollout percentage');
    }
    setSaving(null);
  };

  // Group by category
  const categories = flags.reduce((acc, flag) => {
    if (!acc[flag.category]) acc[flag.category] = [];
    acc[flag.category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  if (loading) return <div className="p-6 text-gray-400">Loading feature flags…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Flag className="text-purple-400" size={28} /> Feature Flags & Toggles
          </h1>
          <p className="text-gray-400 text-sm mt-1">Control experimental features, animations, and kill switches.</p>
        </div>
        <button onClick={fetchFlags} className="flex items-center gap-2 px-4 py-2 bg-[#252525] border border-[#333] text-white rounded-lg hover:bg-[#333] transition-colors">
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="space-y-8">
        {Object.entries(categories).map(([category, catFlags]) => (
          <div key={category} className="bg-[#161616] border border-[#333] rounded-xl overflow-hidden">
            <div className="bg-[#1A1A1A] px-6 py-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-gray-200 uppercase tracking-wider">{category}</h2>
            </div>
            
            <div className="divide-y divide-[#333]">
              {catFlags.map((flag) => (
                <div key={flag.key} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-[#1A1A1A] transition-colors">
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <code className="text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {flag.key}
                      </code>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${flag.enabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                        {flag.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    {flag.description && <p className="text-sm text-gray-400 mt-2">{flag.description}</p>}
                  </div>

                  <div className="flex items-center gap-8 lg:w-96 shrink-0">
                    
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-2 flex justify-between items-center">
                        <span className="flex items-center gap-1"><Sliders size={12}/> Rollout %</span>
                        <span className="text-gray-300 font-mono">{flag.rolloutPercent}%</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={flag.rolloutPercent}
                          onChange={(e) => {
                             const updated = [...flags];
                             const idx = updated.findIndex((f) => f.key === flag.key);
                             updated[idx].rolloutPercent = parseInt(e.target.value);
                             setFlags(updated);
                          }}
                          className="w-full accent-purple-500"
                        />
                        <button
                           onClick={() => handleRolloutChange(flag.key, flag.rolloutPercent)}
                           disabled={saving === flag.key}
                           className="text-purple-400 hover:text-purple-300 disabled:opacity-50"
                           title="Save Rollout %"
                        >
                          <Save size={18} />
                        </button>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleToggle(flag.key, flag.enabled)}
                      disabled={saving === flag.key}
                      className="shrink-0"
                    >
                      {flag.enabled ? (
                        <ToggleRight className="text-green-500 hover:text-green-400 transition-colors" size={40} />
                      ) : (
                        <ToggleLeft className="text-gray-600 hover:text-gray-500 transition-colors" size={40} />
                      )}
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeatureFlags;
