import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, RefreshCw, Edit2, X, Check, Search } from 'lucide-react';
import {
  getRssSources, getYoutubePool, createRssSource, updateRssSource, deleteRssSource,
  syncNewsSource, syncNews, uploadYoutubePool, deleteYoutubePoolItem, getCategories,
  importYoutubeSearch, getYoutubeImportLogs,
} from '../services/api';

const ContentPage = () => {
  const [sources, setSources] = useState<any[]>([]);
  const [youtubePool, setYoutubePool] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [youtubeImportLogs, setYoutubeImportLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    categoryId: '',
    active: true,
    isDiscoverFilter: false,
    imageUrl: ''
  });

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [youtubeSearch, setYoutubeSearch] = useState({ query: '', categoryId: '', count: 25 });
  const [youtubeImporting, setYoutubeImporting] = useState(false);
  const [youtubeImportResult, setYoutubeImportResult] = useState<any>(null);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const [rssRes, ytRes, categoryRes, importLogRes] = await Promise.all([
        getRssSources(), getYoutubePool(), getCategories(), getYoutubeImportLogs(),
      ]);
      setSources(rssRes.data.data || []);
      setYoutubePool(ytRes.data.data || []);
      setCategories(categoryRes.data.data || []);
      setYoutubeImportLogs(importLogRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this RSS source?')) return;
    try {
      await deleteRssSource(id);
      fetchContent();
    } catch (err) {
      console.error('Failed to delete RSS source', err);
      alert('Failed to delete RSS source');
    }
  };

  const handleEdit = (source: any) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      url: source.url,
      categoryId: source.categoryId ? String(source.categoryId) : '',
      active: Boolean(source.active),
      isDiscoverFilter: Boolean(source.isDiscoverFilter),
      imageUrl: source.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingSource(null);
    setFormData({
      name: '',
      url: '',
      categoryId: '',
      active: true,
      isDiscoverFilter: false,
      imageUrl: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSource) {
        await updateRssSource(editingSource.id, formData);
      } else {
        await createRssSource(formData);
      }
      setIsModalOpen(false);
      fetchContent();
    } catch (err) {
      console.error('Failed to save RSS source', err);
      alert('Failed to save RSS source');
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      await syncNews();
      await fetchContent();
      alert('Sync completed!');
    } catch (err) {
      console.error('Sync failed', err);
      alert('Sync failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncSource = async (id: number) => {
    try {
      setSyncingId(id);
      await syncNewsSource(id);
      await fetchContent();
    } catch (err) {
      console.error('Sync source failed', err);
      alert('Failed to sync source');
    } finally {
      setSyncingId(null);
    }
  };

  const handleAddYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeVideoId) return;
    try {
      // Basic extraction if they paste a full URL
      let vid = youtubeVideoId;
      if (vid.includes('v=')) {
        vid = vid.split('v=')[1].split('&')[0];
      } else if (vid.includes('youtu.be/')) {
        vid = vid.split('youtu.be/')[1].split('?')[0];
      } else if (vid.includes('shorts/')) {
        vid = vid.split('shorts/')[1].split('?')[0];
      }
      
      await uploadYoutubePool([vid]);
      setIsYoutubeModalOpen(false);
      setYoutubeVideoId('');
      fetchContent();
    } catch (err) {
      console.error('Failed to add youtube video', err);
      alert('Failed to add youtube video');
    }
  };

  const handleDeleteYoutube = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this video from the pool?')) return;
    try {
      await deleteYoutubePoolItem(id);
      fetchContent();
    } catch (err) {
      console.error('Failed to delete youtube video', err);
      alert('Failed to delete youtube video');
    }
  };

  const handleYoutubeSearchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeSearch.query.trim() || !youtubeSearch.categoryId) return;
    try {
      setYoutubeImporting(true);
      setYoutubeImportResult(null);
      const response = await importYoutubeSearch({
        query: youtubeSearch.query.trim(),
        categoryId: Number(youtubeSearch.categoryId),
        count: Number(youtubeSearch.count),
      });
      setYoutubeImportResult(response.data.data);
      await fetchContent();
    } catch (err: any) {
      console.error('Failed to import YouTube videos', err);
      setYoutubeImportResult({ error: err.response?.data?.error || 'YouTube import failed' });
    } finally {
      setYoutubeImporting(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Loading content management...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <Database className="mr-3 text-purple-400" /> Content Management
      </h1>

      {/* RSS Sources Section */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">RSS Sources (Discover Feed)</h2>
          <div className="flex gap-2">
            <button 
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="bg-[#333] hover:bg-[#444] disabled:opacity-50 text-white px-3 py-2 rounded-lg flex items-center transition-colors"
            >
              <RefreshCw size={16} className={`mr-2 ${syncingAll ? 'animate-spin' : ''}`} /> 
              {syncingAll ? 'Syncing...' : 'Sync All'}
            </button>
            <button 
              onClick={handleAdd}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
            >
              <Plus size={16} className="mr-2" /> Add Source
            </button>
          </div>
        </div>
        
        <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333]">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#2A2A2A] text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">URL</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Last Fetched</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-[#222] transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{source.name}</td>
                  <td className="px-6 py-4 text-gray-400 truncate max-w-[200px]" title={source.url}>{source.url}</td>
                  <td className="px-6 py-4">{source.category?.name || '-'}</td>
                  <td className="px-6 py-4">{source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : 'Never'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${source.active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {source.active ? (source.lastSyncStatus || 'ACTIVE') : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        className="text-green-400 hover:text-green-300 p-1 disabled:opacity-50"
                        onClick={() => handleSyncSource(source.id)}
                        disabled={syncingId === source.id}
                        title="Sync this source"
                      >
                        <RefreshCw size={18} className={syncingId === source.id ? 'animate-spin' : ''} />
                      </button>
                      <button 
                        className="text-blue-400 hover:text-blue-300 p-1"
                        onClick={() => handleEdit(source)}
                        title="Edit source"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        className="text-red-400 hover:text-red-300 p-1"
                        onClick={() => handleDelete(source.id)}
                        title="Delete source"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No RSS sources configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* YouTube Pool Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">YouTube Pool (Shorts Feed)</h2>
          <button 
            onClick={() => setIsYoutubeModalOpen(true)}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          >
            <Plus size={16} className="mr-2" /> Add Video
          </button>
        </div>

        <form onSubmit={handleYoutubeSearchImport} className="bg-[#1A1A1A] border border-[#333] rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Search size={19} className="text-red-400" />
            <h3 className="text-white font-bold">Search and add Shorts</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_140px_auto] gap-3 items-end">
            <div>
              <label htmlFor="youtube-query" className="block text-sm text-gray-400 mb-1">Search phrase</label>
              <input id="youtube-query" required minLength={2} maxLength={120} value={youtubeSearch.query} onChange={e => setYoutubeSearch({ ...youtubeSearch, query: e.target.value })} placeholder="e.g. motivational shorts india" className="w-full bg-[#111] border border-[#444] rounded px-3 py-2 text-white focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label htmlFor="youtube-category" className="block text-sm text-gray-400 mb-1">Category</label>
              <select id="youtube-category" required value={youtubeSearch.categoryId} onChange={e => setYoutubeSearch({ ...youtubeSearch, categoryId: e.target.value })} className="w-full bg-[#111] border border-[#444] rounded px-3 py-2 text-white focus:outline-none focus:border-red-500">
                <option value="">Select category</option>
                {categories.filter(category => category.active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="youtube-count" className="block text-sm text-gray-400 mb-1">Videos</label>
              <input id="youtube-count" type="number" required min={1} max={100} value={youtubeSearch.count} onChange={e => setYoutubeSearch({ ...youtubeSearch, count: Number(e.target.value) })} className="w-full bg-[#111] border border-[#444] rounded px-3 py-2 text-white focus:outline-none focus:border-red-500" />
            </div>
            <button disabled={youtubeImporting} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-5 py-2 rounded flex items-center justify-center min-h-10">
              <Search size={16} className="mr-2" /> {youtubeImporting ? 'Importing…' : 'Search & Add'}
            </button>
          </div>
          {youtubeImportResult && (
            <div role="status" className={`mt-4 rounded-lg p-3 text-sm ${youtubeImportResult.error ? 'bg-red-900/20 text-red-300 border border-red-800' : 'bg-green-900/20 text-green-300 border border-green-800'}`}>
              {youtubeImportResult.error
                ? youtubeImportResult.error
                : `Added ${youtubeImportResult.added} of ${youtubeImportResult.requested} requested videos. ${youtubeImportResult.duplicatesSkipped} duplicates skipped.`}
            </div>
          )}
        </form>
        
        <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333]">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#2A2A2A] text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Thumbnail</th>
                <th className="px-6 py-4 font-semibold">Video ID</th>
                <th className="px-6 py-4 font-semibold">Title</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Source</th>
                <th className="px-6 py-4 font-semibold">Added At</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {youtubePool.map((video) => (
                <tr key={video.id} className="hover:bg-[#222] transition-colors">
                  <td className="px-6 py-4">
                    <img src={`https://img.youtube.com/vi/${video.videoId}/default.jpg`} alt="thumbnail" className="w-16 h-12 object-cover rounded" />
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-400">{video.videoId}</td>
                  <td className="px-6 py-4 font-medium text-white">{video.title}</td>
                  <td className="px-6 py-4">{video.category?.name || 'Uncategorized'}</td>
                  <td className="px-6 py-4">
                    <span className="bg-[#333] px-2 py-1 rounded text-xs">{video.source || 'MANUAL'}</span>
                    {video.sourceQuery && <div className="text-xs text-gray-500 mt-1 max-w-[180px] truncate" title={video.sourceQuery}>{video.sourceQuery}</div>}
                  </td>
                  <td className="px-6 py-4">{new Date(video.addedAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDeleteYoutube(video.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {youtubePool.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No YouTube videos in the pool.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-white mt-6 mb-3">YouTube Import History</h3>
        <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333]">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#2A2A2A] text-gray-400">
              <tr>
                <th className="px-5 py-3">Search</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Requested</th><th className="px-5 py-3">Added</th><th className="px-5 py-3">Skipped</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {youtubeImportLogs.map(log => (
                <tr key={log.id}>
                  <td className="px-5 py-3 text-white">{log.query}</td>
                  <td className="px-5 py-3">{log.category?.name || '-'}</td>
                  <td className="px-5 py-3">{log.requestedCount}</td>
                  <td className="px-5 py-3 text-green-400">{log.addedCount}</td>
                  <td className="px-5 py-3">{log.duplicatesSkipped + log.invalidSkipped}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-1 rounded text-xs ${log.status === 'SUCCESS' ? 'bg-green-900/30 text-green-400' : log.status === 'PARTIAL' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'}`}>{log.status}</span></td>
                  <td className="px-5 py-3">{new Date(log.startedAt).toLocaleString()}</td>
                </tr>
              ))}
              {youtubeImportLogs.length === 0 && <tr><td colSpan={7} className="px-5 py-6 text-center text-gray-500">No YouTube imports have been run.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* RSS Source Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">{editingSource ? 'Edit RSS Source' : 'Add RSS Source'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">RSS URL *</label>
                  <input 
                    type="url" 
                    required
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Filter Chip Image URL (Optional)</label>
                  <input 
                    type="url" 
                    placeholder="https://example.com/image.png"
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">No category</option>
                    {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Status</label>
                    <select 
                      className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                      value={formData.active ? 'ACTIVE' : 'INACTIVE'}
                      onChange={(e) => setFormData({ ...formData, active: e.target.value === 'ACTIVE' })}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end pb-2">
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.isDiscoverFilter}
                        onChange={(e) => setFormData({ ...formData, isDiscoverFilter: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 relative"></div>
                      <span className="ml-3 text-sm font-medium text-gray-300">Is Discover Filter?</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button 
                  type="button" 
                  className="px-4 py-2 text-gray-400 hover:text-white"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center"
                >
                  <Check size={16} className="mr-2" /> Save Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* YouTube Add Video Modal */}
      {isYoutubeModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">Add YouTube Video</h2>
              <button onClick={() => setIsYoutubeModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddYoutube} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Video ID or URL *</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-red-500"
                    value={youtubeVideoId}
                    onChange={(e) => setYoutubeVideoId(e.target.value)}
                    placeholder="e.g. dQw4w9WgXcQ or https://youtu.be/..."
                  />
                  <p className="text-xs text-gray-500 mt-2">The video will be added to the shorts feed rotation.</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button 
                  type="button" 
                  className="px-4 py-2 text-gray-400 hover:text-white"
                  onClick={() => setIsYoutubeModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded flex items-center"
                >
                  <Check size={16} className="mr-2" /> Add Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentPage;
