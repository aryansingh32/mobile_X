import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, Save, Search, Settings } from 'lucide-react';
import { getYoutubePool, updateYoutubePoolItem, getConfig, updateConfig } from '../services/api';

const TrendingShorts = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('RANDOM');
  const [savingMode, setSavingMode] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [poolRes, configRes] = await Promise.all([
        getYoutubePool(),
        getConfig()
      ]);
      setVideos(poolRes.data.data);
      const modeConfig = configRes.data.data.find((c: any) => c.key === 'TRENDING_SHORTS_MODE');
      if (modeConfig) {
        setMode(modeConfig.value);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveMode = async () => {
    setSavingMode(true);
    try {
      await updateConfig('TRENDING_SHORTS_MODE', mode);
      alert('Mode saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save mode');
    } finally {
      setSavingMode(false);
    }
  };

  const toggleTrending = async (video: any) => {
    try {
      const updated = await updateYoutubePoolItem(video.id, { isTrending: !video.isTrending });
      setVideos(videos.map(v => v.id === video.id ? { ...v, isTrending: !v.isTrending } : v));
    } catch (err) {
      console.error(err);
      alert('Failed to update trending status');
    }
  };

  const filtered = videos.filter(v => 
    v.title?.toLowerCase().includes(search.toLowerCase()) || 
    v.videoId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="text-[var(--accent)]" size={32} />
        <div>
          <h1 className="text-2xl font-bold text-white">Trending Shorts</h1>
          <p className="text-gray-400 text-sm">Manage videos shown in the Home Screen Trending section</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-white">Display Mode</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Choose how trending shorts are selected for the user.
          </p>
          <select 
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full bg-black border border-[#333] rounded-lg p-2 text-white mb-4"
          >
            <option value="RANDOM">RANDOM (Randomly select from trending tagged)</option>
            <option value="TOP10">TOP10 (10 Most recently added trending shorts)</option>
            <option value="MANUAL">MANUAL (Only manually tagged trending shorts)</option>
          </select>
          <button
            onClick={handleSaveMode}
            disabled={savingMode}
            className="w-full bg-[var(--accent)] text-black font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Save size={18} />
            {savingMode ? 'Saving...' : 'Save Config'}
          </button>
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden">
        <div className="p-4 border-b border-[#333] flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Shorts Pool</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
            <input 
              type="text"
              placeholder="Search title or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading videos...</div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">Video</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Added</th>
                <th className="px-6 py-4 font-medium">Trending Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-black/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-24 bg-gray-800 rounded flex items-center justify-center shrink-0 relative overflow-hidden">
                         <img src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                         <Play className="text-white relative z-10" size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-white mb-1 line-clamp-2">{v.title || v.videoId}</div>
                        <div className="text-xs text-gray-500">ID: {v.videoId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {v.category ? (
                      <span className="px-2 py-1 bg-gray-800 rounded text-xs">{v.category.name}</span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                    {new Date(v.addedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleTrending(v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        v.isTrending 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {v.isTrending ? '✓ Trending' : 'Mark Trending'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No videos found. Upload them from the RSS & Content page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TrendingShorts;
