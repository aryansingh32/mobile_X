import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, FileText, Plus, RefreshCw, Save, Search, X } from 'lucide-react';
import { getContentStrings, updateContentString } from '../services/api';

type ContentString = {
  id: number;
  key: string;
  screen: string;
  value: string;
  description?: string | null;
  updatedAt: string;
};

const SCREENS = ['HOME', 'AUTH', 'SPLASH', 'DISCOVER', 'SHORTS', 'WALLET', 'EARN', 'GAMES', 'GLOBAL'];

// Every mobile-app useContent('some.key', 'fallback text') call site reads
// through this table — any key that already exists here overrides the
// hardcoded fallback with no app deploy. A brand-new key still needs a
// matching useContent() call in the app before it does anything (the hook
// can't invent new UI text out of nothing), so this page is for tuning
// existing copy, not introducing new screens.
const ContentStringsPage = () => {
  const [strings, setStrings] = useState<ContentString[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [screenFilter, setScreenFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({ key: '', screen: 'GLOBAL', value: '', description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getContentStrings();
      setStrings(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load content strings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return strings.filter(s => {
      if (screenFilter !== 'ALL' && s.screen !== screenFilter) return false;
      if (search && !s.key.toLowerCase().includes(search.toLowerCase()) && !s.value.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [strings, screenFilter, search]);

  const screenCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of strings) counts.set(s.screen, (counts.get(s.screen) || 0) + 1);
    return counts;
  }, [strings]);

  const startEdit = (s: ContentString) => {
    setEditingKey(s.key);
    setEditValue(s.value);
    setEditDescription(s.description || '');
  };

  const saveEdit = async (key: string) => {
    if (!editValue.trim()) {
      setError('Value cannot be empty.');
      return;
    }
    setSavingKey(key);
    setError('');
    try {
      await updateContentString(key, { value: editValue, description: editDescription });
      setStrings(current => current.map(s => (s.key === key ? { ...s, value: editValue, description: editDescription } : s)));
      setEditingKey(null);
    } catch {
      setError('Failed to save this string.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = newEntry.key.trim();
    if (!key || !newEntry.value.trim()) {
      setError('Key and value are required.');
      return;
    }
    setSavingKey(key);
    setError('');
    try {
      await updateContentString(key, { screen: newEntry.screen, value: newEntry.value, description: newEntry.description });
      await fetchData();
      setNewEntry({ key: '', screen: 'GLOBAL', value: '', description: '' });
      setAdding(false);
    } catch {
      setError('Failed to create this string — it may already exist.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Loading content strings...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileText className="text-blue-400" size={24} /> Content Strings (CMS)</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Every piece of app copy wired through <code className="text-gray-300">useContent()</code> — editing a row here changes
            what users see with no app deploy. New keys only take effect once a matching <code className="text-gray-300">useContent('key', 'fallback')</code> call
            exists in the app code.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors self-start"
        >
          <Plus size={18} /> Add String
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search key or text..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/40 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
          />
        </div>
        <select
          value={screenFilter}
          onChange={e => setScreenFilter(e.target.value)}
          className="bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="ALL">All screens ({strings.length})</option>
          {SCREENS.map(screen => (
            <option key={screen} value={screen}>{screen} ({screenCounts.get(screen) || 0})</option>
          ))}
        </select>
        <button onClick={fetchData} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map(s => {
          const isEditing = editingKey === s.key;
          return (
            <div key={s.key} className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
              <div className="flex flex-col lg:flex-row lg:items-start gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="rounded-full border border-blue-400/25 bg-blue-400/10 px-2 py-0.5 text-[11px] font-bold text-blue-300">{s.screen}</span>
                    <code className="text-xs text-gray-400">{s.key}</code>
                  </div>
                  {s.description && <p className="text-xs text-gray-500 mb-2">{s.description}</p>}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        rows={2}
                        className="w-full bg-black/50 border border-blue-500/40 rounded-lg p-2 text-white text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-white text-xs"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-white">{s.value}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => setEditingKey(null)} className="p-2 text-gray-400 hover:text-white bg-black/30 rounded-lg"><X size={16} /></button>
                      <button onClick={() => saveEdit(s.key)} disabled={savingKey === s.key} className="flex items-center gap-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50">
                        <Save size={15} /> {savingKey === s.key ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(s)} className="p-2 text-gray-400 hover:text-blue-400 bg-black/30 rounded-lg"><Edit3 size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-16">No content strings match this filter.</div>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#161616] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <h2 className="text-lg font-black text-white">Add Content String</h2>
              <button onClick={() => setAdding(false)} className="rounded-full p-2 text-white/45 hover:bg-white/10 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Key</label>
                <input required value={newEntry.key} onChange={e => setNewEntry({ ...newEntry, key: e.target.value })} placeholder="wallet.redeem_title" className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 font-mono text-sm text-white outline-none" />
                <p className="mt-1 text-[11px] text-white/40">Must match an existing useContent() call site to have any effect.</p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Screen</label>
                <select value={newEntry.screen} onChange={e => setNewEntry({ ...newEntry, screen: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-sm text-white outline-none">
                  {SCREENS.map(screen => <option key={screen} value={screen}>{screen}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Value</label>
                <textarea required rows={2} value={newEntry.value} onChange={e => setNewEntry({ ...newEntry, value: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/45">Description (optional)</label>
                <input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-sm text-white outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAdding(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-white/55 hover:bg-white/5 hover:text-white">Cancel</button>
                <button className="rounded-xl bg-[#FFD700] px-4 py-2 text-sm font-black text-black hover:bg-yellow-300">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentStringsPage;
