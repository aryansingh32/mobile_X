import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit2, Gift, Image as ImageIcon, Package, Plus, Tags, Trash2, X } from 'lucide-react';
import {
  addCatalogCodes,
  createCatalogItem,
  deleteCatalogCode,
  deleteCatalogItem,
  getCatalog,
  getCatalogCodes,
  updateCatalogCode,
  updateCatalogItem,
} from '../services/api';

const blankForm = {
  name: '',
  description: '',
  imageUrl: '',
  type: 'VOUCHER',
  coinCost: 100,
  inrValue: 1,
  stock: -1,
  active: true,
};

const CatalogPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [codeText, setCodeText] = useState('');
  const [savingCodes, setSavingCodes] = useState(false);
  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (selectedItem) fetchCodes(selectedItem.id);
  }, [selectedItem?.id]);

  const selectedFreshItem = useMemo(
    () => items.find((item) => item.id === selectedItem?.id) || selectedItem,
    [items, selectedItem],
  );

  const fetchCatalog = async () => {
    try {
      const { data } = await getCatalog();
      setItems(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCodes = async (itemId: number) => {
    try {
      const { data } = await getCatalogCodes(itemId);
      setCodes(data.data || []);
    } catch (err) {
      console.error(err);
      setCodes([]);
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
      name: item.name || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      type: item.type || 'VOUCHER',
      coinCost: item.coinCost || 100,
      inrValue: item.inrValue || 1,
      stock: item.stock ?? -1,
      active: item.active ?? true,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this catalog item and all unissued code inventory?')) return;
    try {
      await deleteCatalogItem(id);
      if (selectedItem?.id === id) setSelectedItem(null);
      await fetchCatalog();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete item');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description || null,
      imageUrl: formData.imageUrl || null,
      type: formData.type,
      coinCost: Number(formData.coinCost),
      inrValue: Number(formData.inrValue),
      stock: Number(formData.stock),
      active: formData.active,
    };

    try {
      if (editingItem) {
        await updateCatalogItem(editingItem.id, payload);
      } else {
        await createCatalogItem(payload);
      }
      setShowModal(false);
      await fetchCatalog();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save item');
    }
  };

  const handleAddCodes = async () => {
    if (!selectedFreshItem || !codeText.trim()) return;
    try {
      setSavingCodes(true);
      await addCatalogCodes(selectedFreshItem.id, codeText);
      setCodeText('');
      await Promise.all([fetchCodes(selectedFreshItem.id), fetchCatalog()]);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add codes');
    } finally {
      setSavingCodes(false);
    }
  };

  const handleVoidCode = async (code: any) => {
    if (!window.confirm('Void this code? It will no longer be issued.')) return;
    await updateCatalogCode(code.id, { status: 'VOID' });
    await Promise.all([fetchCodes(selectedFreshItem.id), fetchCatalog()]);
  };

  const handleDeleteCode = async (code: any) => {
    if (!window.confirm('Delete this unissued code?')) return;
    await deleteCatalogCode(code.id);
    await Promise.all([fetchCodes(selectedFreshItem.id), fetchCatalog()]);
  };

  if (loading) return <div className="p-6 text-white">Loading catalog...</div>;

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Gift className="mr-3 text-[var(--accent)]" /> Reward Catalog
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage redeem cards, stock, images, and voucher code inventory.</p>
        </div>
        <button onClick={openCreate} className="bg-[var(--accent)] hover:bg-[#E64518] text-white px-4 py-2 rounded-lg flex items-center transition-colors">
          <Plus size={20} className="mr-2" /> Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <div className="bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#333]">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#2A2A2A] text-gray-400">
              <tr>
                <th className="px-5 py-4 font-semibold">Item</th>
                <th className="px-5 py-4 font-semibold">Type</th>
                <th className="px-5 py-4 font-semibold">Coins</th>
                <th className="px-5 py-4 font-semibold">Value</th>
                <th className="px-5 py-4 font-semibold">Inventory</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {items.map((item) => {
                const counts = item.codeCounts || {};
                const available = counts.available ?? 0;
                const issued = counts.issued ?? 0;
                const hasCodeInventory = available + issued + (counts.void ?? 0) > 0;
                const soldOut = hasCodeInventory ? available <= 0 : item.stock !== -1 && item.stock <= 0;

                return (
                  <tr key={item.id} className={`hover:bg-[#222] transition-colors ${selectedItem?.id === item.id ? 'bg-[#222]' : ''}`}>
                    <td className="px-5 py-4">
                      <button onClick={() => setSelectedItem(item)} className="flex items-center gap-3 text-left cursor-pointer">
                        <div className="w-12 h-12 bg-[#333] rounded-md overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-gray-500" />}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{item.name}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{item.description || 'No description'}</div>
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-4"><span className="bg-[#333] px-2 py-1 rounded text-xs">{item.type}</span></td>
                    <td className="px-5 py-4 font-mono text-[var(--accent)]">{item.coinCost}</td>
                    <td className="px-5 py-4 font-mono text-green-400">₹{item.inrValue}</td>
                    <td className="px-5 py-4">
                      <div className={soldOut ? 'text-red-400 font-semibold' : 'text-white font-semibold'}>{soldOut ? 'Sold out' : hasCodeInventory ? `${available} available` : item.stock === -1 ? 'Unlimited' : `${item.stock} available`}</div>
                      {hasCodeInventory && <div className="text-xs text-gray-500">{issued} issued</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${item.active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {item.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => openEdit(item)} className="text-blue-400 hover:text-blue-300" title="Edit item"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300" title="Delete item"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No catalog items found.</td></tr>}
            </tbody>
          </table>
        </div>

        <aside className="bg-[#1A1A1A] rounded-lg border border-[#333] p-4 h-fit">
          {selectedFreshItem ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedFreshItem.name}</h2>
                  <p className="text-sm text-gray-400">{selectedFreshItem.type} inventory</p>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-[#111] rounded-md p-3 border border-[#333]"><div className="text-xs text-gray-500">Available</div><div className="text-lg font-bold text-white">{selectedFreshItem.codeCounts?.available ?? 0}</div></div>
                <div className="bg-[#111] rounded-md p-3 border border-[#333]"><div className="text-xs text-gray-500">Issued</div><div className="text-lg font-bold text-white">{selectedFreshItem.codeCounts?.issued ?? 0}</div></div>
                <div className="bg-[#111] rounded-md p-3 border border-[#333]"><div className="text-xs text-gray-500">Void</div><div className="text-lg font-bold text-white">{selectedFreshItem.codeCounts?.void ?? 0}</div></div>
              </div>

              <label className="block text-sm text-gray-400 mb-2">Add codes, one per line. Use CODE,SERIAL for tracking numbers.</label>
              <textarea value={codeText} onChange={(e) => setCodeText(e.target.value)} rows={5} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)] font-mono text-sm" placeholder="AMZN-XXXX-YYYY&#10;FK-XXXX,SERIAL-001" />
              <button onClick={handleAddCodes} disabled={savingCodes || !codeText.trim()} className="mt-3 w-full bg-[var(--accent)] disabled:bg-[#333] hover:bg-[#E64518] text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors">
                <Tags size={18} className="mr-2" /> {savingCodes ? 'Adding...' : 'Add Codes'}
              </button>

              <div className="mt-5 max-h-[420px] overflow-y-auto divide-y divide-[#333]">
                {codes.map((code) => (
                  <div key={code.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm text-white break-all">{code.code}</div>
                        <div className="text-xs text-gray-500">{code.serialNumber || 'No serial'} · {code.status}</div>
                        {code.withdrawal && <div className="text-xs text-green-400 mt-1">Issued to {code.withdrawal.user?.email || `user #${code.withdrawal.userId}`} via withdrawal #{code.withdrawal.id}</div>}
                      </div>
                      {code.status !== 'ISSUED' && (
                        <div className="flex gap-2">
                          {code.status !== 'VOID' && <button onClick={() => handleVoidCode(code)} className="text-yellow-400 hover:text-yellow-300" title="Void code"><X size={16} /></button>}
                          <button onClick={() => handleDeleteCode(code)} className="text-red-400 hover:text-red-300" title="Delete code"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {codes.length === 0 && <div className="py-8 text-center text-gray-500">No codes loaded for this item.</div>}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-gray-500">
              <Package className="mx-auto mb-3 text-gray-600" />
              Select a catalog item to manage code inventory.
            </div>
          )}
        </aside>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-lg border border-[#333] w-full max-w-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">{editingItem ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea rows={3} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                <input className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type *</label>
                  <select className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                    <option value="VOUCHER">VOUCHER</option>
                    <option value="PHYSICAL">PHYSICAL</option>
                    <option value="CUSTOM">CUSTOM</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price *</label>
                  <input type="number" required min="1" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.coinCost} onChange={(e) => setFormData({ ...formData, coinCost: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">INR Value *</label>
                  <input type="number" required min="0" step="0.01" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.inrValue} onChange={(e) => setFormData({ ...formData, inrValue: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Manual Stock</label>
                  <input type="number" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} />
                  <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited. Code-backed vouchers use available codes.</p>
                </div>
              </div>
              <label className="flex items-center gap-3 text-white">
                <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} />
                Active in user catalog
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" className="px-4 py-2 text-gray-400 hover:text-white" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--accent)] hover:bg-[#E64518] text-white rounded flex items-center">
                  <Check size={16} className="mr-2" /> Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
