import React, { useEffect, useState } from 'react';
import { Megaphone, RefreshCw } from 'lucide-react';
import { getMarqueeAdmin } from '../services/api';

type MarqueeItem = { id: string; text: string };

const MarqueePage = () => {
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getMarqueeAdmin();
      setItems(res.data.items || []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Megaphone className="text-yellow-400" size={24} /> Social-Proof Feed</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            This is exactly what the Home screen's scrolling marquee shows users right now — built live from recent real
            withdrawals, referrals, and badge unlocks (see GET /api/marquee). If this list is empty, the app falls back to a
            fixed set of example chips instead of showing nothing.
          </p>
        </div>
        <button onClick={fetchData} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white self-start">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl divide-y divide-gray-800/50">
        {items.map(item => (
          <div key={item.id} className="p-4 text-sm text-gray-200 flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
            {item.text}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No real activity in the last 14 days — users are currently seeing the app's hardcoded fallback chips instead of
            this feed.
          </div>
        )}
      </div>
    </div>
  );
};

export default MarqueePage;
