import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, Trophy } from 'lucide-react';
import { getLeaderboardAdmin } from '../services/api';

type Period = 'week' | 'month' | 'all';
type Leader = {
  rank: number;
  id: number;
  name: string;
  email: string;
  coins: number;
  level: number;
  banned: boolean;
  shadowBanned: boolean;
  trustScore: number;
  riskScore: number;
};

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

const LeaderboardPage = () => {
  const [period, setPeriod] = useState<Period>('all');
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getLeaderboardAdmin(period);
      setLeaders(res.data.data.leaders || []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Trophy className="text-yellow-400" size={24} /> Leaderboard</h1>
          <p className="text-sm text-gray-400 mt-1">Same ranking basis the app shows users — top earners by real coin credits. Unlike the in-app leaderboard, banned/shadow-banned users stay visible here (flagged below) for fraud review.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${period === p.key ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-white">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-black/40 text-gray-500">
            <tr>
              <th className="p-3 font-medium">Rank</th>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Level</th>
              <th className="p-3 font-medium">Coins</th>
              <th className="p-3 font-medium">Trust / Risk</th>
              <th className="p-3 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {leaders.map(l => (
              <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-3 font-bold text-white">#{l.rank}</td>
                <td className="p-3">
                  <div className="text-white">{l.name}</div>
                  <div className="text-xs text-gray-500">{l.email}</div>
                </td>
                <td className="p-3">Lv. {l.level}</td>
                <td className="p-3 text-yellow-400 font-medium">{l.coins.toLocaleString()}</td>
                <td className="p-3 text-xs">{l.trustScore} / {l.riskScore}</td>
                <td className="p-3">
                  {(l.banned || l.shadowBanned) && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-300">
                      <ShieldAlert size={11} /> {l.banned ? 'Banned' : 'Shadow-banned'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && leaders.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">No earners in this period yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderboardPage;
