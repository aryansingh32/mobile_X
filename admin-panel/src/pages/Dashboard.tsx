import React, { useEffect, useState } from 'react';
import { Activity, BarChart3, Coins, CreditCard, ExternalLink, Flame, ShieldCheck, Star, Trophy, Users } from 'lucide-react';
import { getDashboardAnalytics } from '../services/api';

type DashboardStats = {
  totalUsers: number;
  activeUsers: number;
  totalCoinsCirculating: number;
  totalRevenueINR: number;
  totalWithdrawnINR: number;
  avgStreak: number;
  maxStreak: number;
  usersWithStreak: number;
  usersWithStreak7Plus: number;
};

const defaultStats: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  totalCoinsCirculating: 0,
  totalRevenueINR: 0,
  totalWithdrawnINR: 0,
  avgStreak: 0,
  maxStreak: 0,
  usersWithStreak: 0,
  usersWithStreak7Plus: 0,
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value || 0);
const formatInr = (value: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value || 0)}`;

const Dashboard = () => {
  const grafanaUrl = import.meta.env.VITE_GRAFANA_URL;
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    getDashboardAnalytics()
      .then(res => {
        setStats({ ...defaultStats, ...res.data.data });
        setLastUpdated(new Date());
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const primaryCards = [
    { title: 'Total Users', value: formatNumber(stats.totalUsers), icon: Users, tone: 'text-blue-300', bg: 'bg-blue-400/10' },
    { title: 'Active Users (24h)', value: formatNumber(stats.activeUsers), icon: Activity, tone: 'text-emerald-300', bg: 'bg-emerald-400/10' },
    { title: 'Total Withdrawn', value: formatInr(stats.totalWithdrawnINR), icon: CreditCard, tone: 'text-red-300', bg: 'bg-red-400/10' },
    { title: 'Circulating Coins', value: formatNumber(stats.totalCoinsCirculating), icon: Coins, tone: 'text-yellow-200', bg: 'bg-yellow-400/10' },
  ];

  const streakCards = [
    { title: 'Active Streaks', value: formatNumber(stats.usersWithStreak), icon: Flame, tone: 'text-orange-300', bg: 'bg-orange-400/10' },
    { title: 'Average Streak', value: `${stats.avgStreak || 0}d`, icon: BarChart3, tone: 'text-sky-300', bg: 'bg-sky-400/10' },
    { title: 'Max Streak', value: `${formatNumber(stats.maxStreak)}d`, icon: Trophy, tone: 'text-yellow-200', bg: 'bg-yellow-400/10' },
    { title: '7+ Day Streaks', value: formatNumber(stats.usersWithStreak7Plus), icon: Star, tone: 'text-purple-300', bg: 'bg-purple-400/10' },
  ];

  const renderCard = (card: typeof primaryCards[number]) => {
    const Icon = card.icon;
    return (
      <div key={card.title} className="rounded-[22px] border border-white/10 bg-[#161616] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:border-[#FFD700]/25 hover:bg-[#1E1E1E]">
        <div className="mb-5 flex items-center justify-between">
          <div className={`rounded-2xl ${card.bg} p-3 ${card.tone}`}>
            <Icon size={22} />
          </div>
          <ShieldCheck size={18} className="text-white/20" />
        </div>
        <div className="text-sm font-semibold text-white/45">{card.title}</div>
        <div className={`mt-2 text-3xl font-black tracking-tight ${card.tone}`}>
          {loading ? '...' : card.value}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 text-white">
      <div className="mb-7 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,215,0,0.16),transparent_32%),linear-gradient(135deg,#161616,#0A0A0A)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-xs font-bold text-[#FFD700]">
              Live Operations
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Dashboard Overview</h1>
            <p className="mt-2 text-sm text-white/55">Real-time metrics, reward economy health, and streak retention signals.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/55">
            Last Updated:{' '}
            <span className="font-semibold text-white">{lastUpdated ? lastUpdated.toLocaleString() : loading ? 'Loading...' : 'Unavailable'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {primaryCards.map(renderCard)}
      </div>

      <div className="mt-6 rounded-[24px] border border-orange-400/20 bg-[#161616] p-5 shadow-[0_0_40px_rgba(255,122,26,0.08)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Streak Analytics</h2>
            <p className="mt-1 text-sm text-white/45">Retention depth from the existing dashboard analytics endpoint.</p>
          </div>
          <Flame className="text-orange-300" size={24} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {streakCards.map(renderCard)}
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-white/10 bg-[#161616] p-5">
        <h3 className="text-lg font-black text-white">Quick Actions</h3>
        <p className="mt-2 text-sm leading-6 text-white/50">
          Use the sidebar to navigate to detailed management pages.
          {grafanaUrl ? (
            <>
              {' '}Open the{' '}
              <a className="inline-flex items-center font-bold text-[#FFD700] hover:text-yellow-300" href={grafanaUrl} target="_blank" rel="noreferrer">
                Grafana dashboard <ExternalLink size={14} className="ml-1" />
              </a>
              {' '}for advanced monitoring.
            </>
          ) : (
            ' Configure VITE_GRAFANA_URL to enable the Grafana link.'
          )}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
