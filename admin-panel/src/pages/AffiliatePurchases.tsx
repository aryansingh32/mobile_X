import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Check, Coins, RefreshCw, Save } from 'lucide-react';
import { creditAffiliatePurchase, getAffiliatePurchases, updateAffiliatePurchase } from '../services/api';

const STATUS_FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'CREDITED', 'REJECTED'];

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-900/30 text-yellow-400',
  CONFIRMED: 'bg-blue-900/30 text-blue-400',
  CREDITED: 'bg-green-900/30 text-green-400',
  REJECTED: 'bg-red-900/30 text-red-400',
};

type EditState = { amount: string; vibReward: string; adminNotes: string };

const AffiliatePurchasesPage = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [edits, setEdits] = useState<Record<number, EditState>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const { data } = await getAffiliatePurchases(statusFilter === 'ALL' ? {} : { status: statusFilter });
      const rows = data.data || [];
      setPurchases(rows);
      setEdits((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (!next[row.id]) {
            next[row.id] = {
              amount: row.amount ?? '',
              vibReward: String(row.vibReward ?? 0),
              adminNotes: row.adminNotes || '',
            };
          }
        }
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const summary = useMemo(() => {
    const pending = purchases.filter((p) => p.status === 'PENDING').length;
    const credited = purchases.filter((p) => p.status === 'CREDITED').length;
    return { pending, credited, total: purchases.length };
  }, [purchases]);

  const setEdit = (id: number, patch: Partial<EditState>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (row: any) => {
    const edit = edits[row.id];
    try {
      setBusyId(row.id);
      await updateAffiliatePurchase(row.id, {
        amount: edit.amount === '' ? null : Number(edit.amount),
        vibReward: Number(edit.vibReward),
        adminNotes: edit.adminNotes || null,
      });
      await fetchPurchases();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setBusyId(null);
    }
  };

  const handleCredit = async (row: any) => {
    if (!window.confirm(`Credit ${edits[row.id]?.vibReward ?? row.vibReward} VIB to ${row.user?.name || `user #${row.userId}`}? This cannot be undone.`)) return;
    try {
      setBusyId(row.id);
      // Persist any unsaved amount/vibReward edits first, so the credited
      // amount matches what the admin sees on screen right before confirming.
      await updateAffiliatePurchase(row.id, {
        amount: edits[row.id]?.amount === '' ? null : Number(edits[row.id]?.amount),
        vibReward: Number(edits[row.id]?.vibReward),
      });
      await creditAffiliatePurchase(row.id);
      await fetchPurchases();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to credit VIB');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (row: any) => {
    if (!window.confirm('Mark this purchase as rejected? The user will not receive VIB for it.')) return;
    try {
      setBusyId(row.id);
      await updateAffiliatePurchase(row.id, { status: 'REJECTED' });
      await fetchPurchases();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Coins className="mr-3 text-[var(--accent)]" /> Affiliate Purchases
          </h1>
          <p className="text-sm text-gray-400 mt-1">Every "Buy" tap in the app logs a row here. There is no live Amazon/Flipkart conversion feed — check your own affiliate dashboard for the real sale, fill in the amount, then credit VIB.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-400">
            <span className="text-yellow-400 font-semibold">{summary.pending}</span> pending · <span className="text-green-400 font-semibold">{summary.credited}</span> credited
          </div>
          <button onClick={fetchPurchases} className="bg-[#2A2A2A] hover:bg-[#333] text-white px-3 py-2 rounded-lg flex items-center transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-[var(--accent)] text-white' : 'bg-[#2A2A2A] text-gray-400 hover:text-white'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#333]">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#2A2A2A] text-gray-400">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Clicked</th>
              <th className="px-4 py-3 font-semibold">Amount (₹)</th>
              <th className="px-4 py-3 font-semibold">VIB Reward</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading && (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
            )}
            {!loading && purchases.map((row) => {
              const edit = edits[row.id] || { amount: '', vibReward: String(row.vibReward), adminNotes: '' };
              const editable = row.status !== 'CREDITED' && row.status !== 'REJECTED';
              return (
                <tr key={row.id} className="hover:bg-[#222] transition-colors align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{row.user?.name || `User #${row.userId}`}</div>
                    <div className="text-xs text-gray-500">{row.user?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{row.productTitle}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(row.clickedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      disabled={!editable}
                      className="w-24 bg-[#111] border border-[#333] rounded px-2 py-1 text-white disabled:opacity-50 focus:outline-none focus:border-[var(--accent)]"
                      value={edit.amount}
                      onChange={(e) => setEdit(row.id, { amount: e.target.value })}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      disabled={!editable}
                      className="w-20 bg-[#111] border border-[#333] rounded px-2 py-1 text-[var(--accent)] font-mono disabled:opacity-50 focus:outline-none focus:border-[var(--accent)]"
                      value={edit.vibReward}
                      onChange={(e) => setEdit(row.id, { vibReward: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      disabled={!editable}
                      className="w-36 bg-[#111] border border-[#333] rounded px-2 py-1 text-gray-300 text-xs disabled:opacity-50 focus:outline-none focus:border-[var(--accent)]"
                      value={edit.adminNotes}
                      onChange={(e) => setEdit(row.id, { adminNotes: e.target.value })}
                      placeholder="Order id, etc."
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_STYLES[row.status] || 'bg-gray-800 text-gray-400'}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {editable && (
                        <>
                          <button disabled={busyId === row.id} onClick={() => handleSave(row)} className="text-blue-400 hover:text-blue-300 disabled:opacity-40" title="Save changes"><Save size={18} /></button>
                          <button disabled={busyId === row.id} onClick={() => handleCredit(row)} className="text-green-400 hover:text-green-300 disabled:opacity-40" title="Credit VIB"><Check size={18} /></button>
                          <button disabled={busyId === row.id} onClick={() => handleReject(row)} className="text-red-400 hover:text-red-300 disabled:opacity-40" title="Reject"><Ban size={18} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && purchases.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No purchase records for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AffiliatePurchasesPage;
