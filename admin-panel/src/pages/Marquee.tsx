import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { getMarqueeAdmin, getConfig, updateConfig } from '../services/api';

type MarqueeItem = { id: string; text: string };

const CUSTOM_MESSAGES_KEY = 'marquee_custom_messages';

const parseMessages = (raw: string | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
};

const MarqueePage = () => {
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customMessages, setCustomMessages] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feedRes, configRes] = await Promise.all([getMarqueeAdmin(), getConfig()]);
      setItems(feedRes.data.items || []);
      const rows: Array<{ key: string; value: string }> = configRes.data.data || [];
      const row = rows.find(r => r.key === CUSTOM_MESSAGES_KEY);
      setCustomMessages(parseMessages(row?.value));
    } catch (err) {
      console.error(err);
      setError('Failed to load the marquee feed.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveMessages = async (next: string[]) => {
    setSaving(true);
    setError('');
    try {
      await updateConfig(CUSTOM_MESSAGES_KEY, JSON.stringify(next));
      setCustomMessages(next);
    } catch (err) {
      console.error(err);
      setError('Failed to save custom messages.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const text = newMessage.trim();
    if (!text) return;
    saveMessages([...customMessages, text]);
    setNewMessage('');
  };

  const handleDelete = (index: number) => {
    saveMessages(customMessages.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Megaphone className="text-yellow-400" size={24} /> Social-Proof Feed</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            The Home screen's scrolling marquee shows a shuffled mix of real recent activity (withdrawals, referrals, badge
            unlocks) plus any promotional lines you add below. If both are empty, the app falls back to a fixed set of example
            chips instead of showing nothing.
          </p>
        </div>
        <button onClick={fetchData} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white self-start">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-1">Custom Messages</h2>
          <p className="text-xs text-gray-500 mb-4">Announcements, promos, or milestones — mixed in with real activity, never shown as if they came from a real user.</p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="e.g. We just crossed 50,000 users!"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="flex-1 bg-black/50 border border-gray-700 rounded p-2 text-white text-sm"
            />
            <button onClick={handleAdd} disabled={saving || !newMessage.trim()} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium">
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="space-y-2">
            {customMessages.map((msg, i) => (
              <div key={i} className="flex items-center justify-between bg-black/30 rounded-lg p-3">
                <span className="text-sm text-gray-200">{msg}</span>
                <button onClick={() => handleDelete(i)} disabled={saving} className="p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-50">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {customMessages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-6">No custom messages yet.</div>
            )}
          </div>
        </section>

        <section className="bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-6 pb-3">
            <h2 className="text-lg font-bold text-white mb-1">Live Preview</h2>
            <p className="text-xs text-gray-500">Exactly what GET /api/marquee returns right now, real activity and custom messages shuffled together.</p>
          </div>
          <div className="divide-y divide-gray-800/50 max-h-[520px] overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className="p-4 text-sm text-gray-200 flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                {item.text}
              </div>
            ))}
            {!loading && items.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Nothing to show — users are currently seeing the app's hardcoded fallback chips instead of this feed.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default MarqueePage;
