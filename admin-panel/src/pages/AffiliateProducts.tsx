import React, { useEffect, useState } from 'react';
import { Check, Edit2, Image as ImageIcon, Plus, Store, Trash2, X } from 'lucide-react';
import {
  createAffiliateProduct,
  deleteAffiliateProduct,
  getAffiliateProducts,
  updateAffiliateProduct,
} from '../services/api';

const SECTIONS = ['FEATURED', 'TRENDING', 'DEALS', 'GENERAL'];
const PLATFORMS = ['AMAZON', 'FLIPKART', 'OTHER'];

const blankForm = {
  title: '',
  description: '',
  imageUrl: '',
  price: 0,
  vibReward: 50,
  affiliateUrl: '',
  platform: 'AMAZON',
  category: '',
  section: 'GENERAL',
  sortOrder: 0,
  isActive: true,
};

const AffiliateProductsPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await getAffiliateProducts();
      setItems(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData(blankForm);
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      price: item.price || 0,
      vibReward: item.vibReward || 0,
      affiliateUrl: item.affiliateUrl || '',
      platform: item.platform || 'AMAZON',
      category: item.category || '',
      section: item.section || 'GENERAL',
      sortOrder: item.sortOrder || 0,
      isActive: item.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this product? It will disappear from the app immediately.')) return;
    try {
      await deleteAffiliateProduct(id);
      await fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      price: Number(formData.price),
      vibReward: Number(formData.vibReward),
      sortOrder: Number(formData.sortOrder),
    };
    try {
      if (editingItem) {
        await updateAffiliateProduct(editingItem.id, payload);
      } else {
        await createAffiliateProduct(payload);
      }
      setShowModal(false);
      await fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save product');
    }
  };

  if (loading) return <div className="p-6 text-white">Loading products...</div>;

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Store className="mr-3 text-[var(--accent)]" /> Affiliate Products
          </h1>
          <p className="text-sm text-gray-400 mt-1">Amazon/Flipkart-style catalog shown in the app's Store. VIB is credited manually from Affiliate Purchases once a real sale is confirmed.</p>
        </div>
        <button onClick={openCreate} className="bg-[var(--accent)] hover:bg-[#E64518] text-white px-4 py-2 rounded-lg flex items-center transition-colors">
          <Plus size={20} className="mr-2" /> Add Product
        </button>
      </div>

      <div className="bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#333]">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#2A2A2A] text-gray-400">
            <tr>
              <th className="px-5 py-4 font-semibold">Product</th>
              <th className="px-5 py-4 font-semibold">Platform</th>
              <th className="px-5 py-4 font-semibold">Section</th>
              <th className="px-5 py-4 font-semibold">Price</th>
              <th className="px-5 py-4 font-semibold">VIB Reward</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-[#222] transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#333] rounded-md overflow-hidden flex items-center justify-center shrink-0">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-gray-500" />}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{item.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{item.category}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4"><span className="bg-[#333] px-2 py-1 rounded text-xs">{item.platform}</span></td>
                <td className="px-5 py-4"><span className="bg-[#333] px-2 py-1 rounded text-xs">{item.section}</span></td>
                <td className="px-5 py-4 font-mono text-green-400">₹{item.price}</td>
                <td className="px-5 py-4 font-mono text-[var(--accent)]">{item.vibReward}</td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${item.isActive ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {item.isActive ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => openEdit(item)} className="text-blue-400 hover:text-blue-300" title="Edit product"><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300" title="Delete product"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No products found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-lg border border-[#333] w-full max-w-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">{editingItem ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea rows={3} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image URL *</label>
                <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Affiliate Buy Link *</label>
                <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.affiliateUrl} onChange={(e) => setFormData({ ...formData, affiliateUrl: e.target.value })} placeholder="https://amazon.in/..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price (₹) *</label>
                  <input type="number" required min="0" step="0.01" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">VIB Reward *</label>
                  <input type="number" required min="0" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.vibReward} onChange={(e) => setFormData({ ...formData, vibReward: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Platform *</label>
                  <select className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value })}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Section (shelf) *</label>
                  <select className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })}>
                    {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category *</label>
                  <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Electronics" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sort Order</label>
                  <input type="number" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
                </div>
              </div>
              <label className="flex items-center gap-3 text-white">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
                Active in app Store
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" className="px-4 py-2 text-gray-400 hover:text-white" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--accent)] hover:bg-[#E64518] text-white rounded flex items-center">
                  <Check size={16} className="mr-2" /> Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateProductsPage;
