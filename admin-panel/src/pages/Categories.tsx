import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/api';

const CategoriesPage = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    sortOrder: 0,
    active: true,
    isDiscoverFilter: false,
    imageUrl: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getCategories();
      setCategories(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category? Articles might be left uncategorized.')) return;
    try {
      await deleteCategory(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete category', err);
      alert('Failed to delete category');
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || '',
      sortOrder: category.sortOrder || 0,
      active: category.active ?? true,
      isDiscoverFilter: category.isDiscoverFilter ?? false,
      imageUrl: category.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      icon: '',
      sortOrder: categories.length,
      active: true,
      isDiscoverFilter: false,
      imageUrl: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
      } else {
        await createCategory(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save category', err);
      alert('Failed to save category');
    }
  };

  return (
    <div className="p-6 relative h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Layers className="mr-3 text-purple-400" /> Categories
        </h1>
        <button 
          onClick={handleAdd}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
        >
          <Plus size={16} className="mr-2" /> Add Category
        </button>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl overflow-y-auto border border-[#333] flex-1">
        {loading ? (
          <div className="p-6 text-gray-400">Loading categories...</div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#2A2A2A] text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Order</th>
                <th className="px-6 py-4 font-semibold">Icon</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Content Stats</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((cat) => (
                <tr key={cat.id} className="hover:bg-[#222] transition-colors">
                  <td className="px-6 py-4 font-mono text-gray-500">{cat.sortOrder}</td>
                  <td className="px-6 py-4 text-xl">{cat.icon || '📁'}</td>
                  <td className="px-6 py-4 font-medium text-white">{cat.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-xs text-gray-400">
                      <span>{cat._count?.articles || 0} Articles</span>
                      <span>{cat._count?.youtubeVideos || 0} YT Shorts</span>
                      <span>{cat._count?.sources || 0} Sources</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${cat.active ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                      {cat.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        className="text-blue-400 hover:text-blue-300 p-1"
                        onClick={() => handleEdit(cat)}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        className="text-red-400 hover:text-red-300 p-1"
                        onClick={() => handleDelete(cat.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No categories found. Create one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
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
                  <label className="block text-sm text-gray-400 mb-1">Filter Chip Image URL (Optional)</label>
                  <input 
                    type="url" 
                    placeholder="https://example.com/image.png"
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Icon (Emoji/URL)</label>
                    <input 
                      type="text" 
                      className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Status</label>
                    <label className="flex items-center cursor-pointer mt-2">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 relative"></div>
                      <span className="ml-3 text-sm font-medium text-gray-300">Active</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Sort Order</label>
                    <input 
                      type="number" 
                      className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
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
                  <Check size={16} className="mr-2" /> Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
