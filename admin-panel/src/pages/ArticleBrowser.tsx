import React, { useState, useEffect } from 'react';
import { FileText, Search, Edit2, Trash2, X, Check } from 'lucide-react';
import { getNewsArticles, updateNewsArticle, deleteNewsArticle, getCategories } from '../services/api';

const ArticleBrowser = () => {
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [editingArticle, setEditingArticle] = useState<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [debouncedSearch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [artRes, catRes] = await Promise.all([
        getNewsArticles(debouncedSearch ? { search: debouncedSearch } : {}),
        getCategories()
      ]);
      setArticles(artRes.data.data || []);
      setCategories(catRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    try {
      await deleteNewsArticle(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete article', err);
      alert('Failed to delete article');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle) return;
    try {
      await updateNewsArticle(editingArticle.id, editingArticle);
      setEditingArticle(null);
      fetchData();
    } catch (err) {
      console.error('Failed to update article', err);
      alert('Failed to update article');
    }
  };

  return (
    <div className="p-6 relative h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <FileText className="mr-3 text-emerald-400" /> Article Browser
        </h1>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search articles..." 
            className="bg-[#1A1A1A] border border-[#333] text-white px-4 py-2 pl-10 rounded-lg focus:outline-none focus:border-emerald-500 w-64 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333] flex-1 flex flex-col">
        {loading ? (
          <div className="p-6 text-gray-400">Loading articles...</div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#2A2A2A] text-gray-400 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Image</th>
                  <th className="px-6 py-4 font-semibold">Title</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-[#222] transition-colors">
                    <td className="px-6 py-4">
                      {article.imageUrl ? (
                        <img src={article.imageUrl} alt="thumbnail" className="w-16 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-16 bg-[#333] rounded flex items-center justify-center text-xs text-gray-500">No Img</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white line-clamp-2 max-w-md" title={article.title}>{article.title}</div>
                      <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline mt-1 inline-block">View Source</a>
                    </td>
                    <td className="px-6 py-4">{article.category?.name || 'Uncategorized'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${article.isHidden ? 'bg-gray-800 text-gray-400' : 'bg-green-900/30 text-green-400'}`}>
                        {article.isHidden ? 'HIDDEN' : 'VISIBLE'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{new Date(article.publishedAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          className="text-blue-400 hover:text-blue-300 p-1"
                          onClick={() => setEditingArticle(article)}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          className="text-red-400 hover:text-red-300 p-1"
                          onClick={() => handleDelete(article.id)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingArticle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">Edit Article</h2>
              <button onClick={() => setEditingArticle(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-4 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    value={editingArticle.title}
                    onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea 
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white h-24 focus:outline-none focus:border-emerald-500"
                    value={editingArticle.description || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    value={editingArticle.imageUrl || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, imageUrl: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Category</label>
                    <select 
                      className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      value={editingArticle.categoryId || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, categoryId: parseInt(e.target.value) || null })}
                    >
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Visibility</label>
                    <select 
                      className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      value={editingArticle.isHidden ? 'HIDDEN' : 'VISIBLE'}
                      onChange={(e) => setEditingArticle({ ...editingArticle, isHidden: e.target.value === 'HIDDEN' })}
                    >
                      <option value="VISIBLE">VISIBLE</option>
                      <option value="HIDDEN">HIDDEN</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button 
                  type="button" 
                  className="px-4 py-2 text-gray-400 hover:text-white"
                  onClick={() => setEditingArticle(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center"
                >
                  <Check size={16} className="mr-2" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleBrowser;
