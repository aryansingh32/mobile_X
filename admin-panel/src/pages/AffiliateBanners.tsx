import React, { useEffect, useState } from 'react';
import { Check, Edit2, GalleryHorizontal, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import {
  createAffiliateBanner,
  deleteAffiliateBanner,
  getAffiliateBanners,
  updateAffiliateBanner,
} from '../services/api';

const LINK_TYPES = ['PRODUCT', 'CATEGORY', 'URL'];

const blankForm = {
  imageUrl: '',
  linkType: 'URL',
  linkValue: '',
  sortOrder: 0,
  isActive: true,
};

const linkValueHint: Record<string, string> = {
  PRODUCT: 'The numeric product id to open',
  CATEGORY: 'The category name to filter to, e.g. Electronics',
  URL: 'Any external URL to open',
};

const AffiliateBannersPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data } = await getAffiliateBanners();
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
      imageUrl: item.imageUrl || '',
      linkType: item.linkType || 'URL',
      linkValue: item.linkValue || '',
      sortOrder: item.sortOrder || 0,
      isActive: item.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await deleteAffiliateBanner(id);
      await fetchBanners();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete banner');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, sortOrder: Number(formData.sortOrder) };
    try {
      if (editingItem) {
        await updateAffiliateBanner(editingItem.id, payload);
      } else {
        await createAffiliateBanner(payload);
      }
      setShowModal(false);
      await fetchBanners();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save banner');
    }
  };

  if (loading) return <div className="p-6 text-white">Loading banners...</div>;

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <GalleryHorizontal className="mr-3 text-[var(--accent)]" /> Store Banners
          </h1>
          <p className="text-sm text-gray-400 mt-1">Hero carousel shown at the top of the app's Store, and its teaser on Home.</p>
        </div>
        <button onClick={openCreate} className="bg-[var(--accent)] hover:bg-[#E64518] text-white px-4 py-2 rounded-lg flex items-center transition-colors">
          <Plus size={20} className="mr-2" /> Add Banner
        </button>
      </div>

      <div className="bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#333]">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#2A2A2A] text-gray-400">
            <tr>
              <th className="px-5 py-4 font-semibold">Banner</th>
              <th className="px-5 py-4 font-semibold">Links to</th>
              <th className="px-5 py-4 font-semibold">Sort</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-[#222] transition-colors">
                <td className="px-5 py-4">
                  <div className="w-24 h-12 bg-[#333] rounded-md overflow-hidden flex items-center justify-center shrink-0">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-gray-500" />}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="bg-[#333] px-2 py-1 rounded text-xs mr-2">{item.linkType}</span>
                  <span className="text-gray-400 text-xs">{item.linkValue}</span>
                </td>
                <td className="px-5 py-4 text-gray-400">{item.sortOrder}</td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${item.isActive ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {item.isActive ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => openEdit(item)} className="text-blue-400 hover:text-blue-300" title="Edit banner"><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300" title="Delete banner"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No banners found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-lg border border-[#333] w-full max-w-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">{editingItem ? 'Edit Banner' : 'Add Banner'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image URL *</label>
                <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Link Type *</label>
                  <select className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.linkType} onChange={(e) => setFormData({ ...formData, linkType: e.target.value })}>
                    {LINK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sort Order</label>
                  <input type="number" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Link Value *</label>
                <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.linkValue} onChange={(e) => setFormData({ ...formData, linkValue: e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">{linkValueHint[formData.linkType]}</p>
              </div>
              <label className="flex items-center gap-3 text-white">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
                Active in app Store
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" className="px-4 py-2 text-gray-400 hover:text-white" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--accent)] hover:bg-[#E64518] text-white rounded flex items-center">
                  <Check size={16} className="mr-2" /> Save Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateBannersPage;
