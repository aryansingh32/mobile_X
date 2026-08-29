import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { 
  ShieldCheck, Users, AlertTriangle, CreditCard, LayoutDashboard,
  Activity, Database, Settings, ShoppingBag,
  Radio, FileCode, Shield, LineChart, Target, Bell, FlaskConical, Network, CheckSquare,
  LogOut, FileText, Layers, Terminal, MessageSquare, Filter, Play, Award, Trophy, Megaphone, TrendingUp, Bug
} from 'lucide-react';

import AdminLogin from './pages/AdminLogin';
import { getMe } from './services/api';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import LiveTracking from './pages/Live';
import EnvConfig from './pages/EnvConfig';
import Withdrawals from './pages/Withdrawals';
import FraudLogs from './pages/FraudLogs';
import ContentPage from './pages/Content';
import ConfigPage from './pages/Config';
import CatalogPage from './pages/Catalog';
import SuggestionsPage from './pages/Suggestions';
import Analytics from './pages/Analytics';
import Retention from './pages/Retention';
import Notifications from './pages/Notifications';
import ABTesting from './pages/ABTesting';
import Missions from './pages/Missions';
import Referrals from './pages/Referrals';
import SecurityLogs from './pages/Security';
import Monitoring from './pages/Monitoring';
import Logs from './pages/Logs';
import DiscoverFiltersPage from './pages/DiscoverFilters';

// New News System Pages
import ContentDashboard from './pages/ContentDashboard';
import ArticleBrowser from './pages/ArticleBrowser';
import CategoriesPage from './pages/Categories';

// Remote Config & Monetization Engine
import AdPlacements from './pages/AdPlacements';
import AdRewardRules from './pages/AdRewardRules';
import DailyCapPolicies from './pages/DailyCapPolicies';
import FeatureFlags from './pages/FeatureFlags';
import ScreenLayout from './pages/ScreenLayout';
import AdAnalytics from './pages/AdAnalytics';
import RouletteConfig from './pages/RouletteConfig';
import TrendingShorts from './pages/TrendingShorts';
import BadgesPage from './pages/Badges';
import LeaderboardPage from './pages/Leaderboard';
import MarqueePage from './pages/Marquee';
import ProgressionPage from './pages/Progression';
import ContentStringsPage from './pages/ContentStrings';
import ErrorLogsPage from './pages/ErrorLogs';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const Sidebar = ({ onLogout }: { onLogout: () => void }) => {
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

  return (
    <div className="sidebar overflow-y-auto">
      <div className="sidebar-title sticky top-0 bg-[#111] z-10 py-4">
        <ShieldCheck color="var(--accent)" size={28} />
        Google-Grade Admin
      </div>
      <div className="sidebar-nav pb-8">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4 px-4">Core</div>
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={20} /> Executive Dashboard</NavLink>
        <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Users size={20} /> User Intelligence</NavLink>
        <NavLink to="/live" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Radio size={20} /> Live Tracking</NavLink>
        
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6 px-4">Economy & Revenue</div>
        <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><LineChart size={20} /> Revenue Analytics</NavLink>
        <NavLink to="/config" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={20} /> Economy Control</NavLink>
        <NavLink to="/withdrawals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><CreditCard size={20} /> Withdrawals</NavLink>
        <NavLink to="/catalog" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><ShoppingBag size={20} /> Catalog</NavLink>
        
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6 px-4">Remote Config Engine</div>
        <NavLink to="/roulette" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Radio size={20} /> Roulette Config</NavLink>
        <NavLink to="/ad-placements" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Radio size={20} /> Ad Placements</NavLink>
        <NavLink to="/ad-rules" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Activity size={20} /> Reward Rules</NavLink>
        <NavLink to="/cap-policies" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><ShieldCheck size={20} /> Cap Policies</NavLink>
        <NavLink to="/feature-flags" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><AlertTriangle size={20} /> Feature Flags</NavLink>
        <NavLink to="/screen-layout" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={20} /> Screen Layouts</NavLink>
        <NavLink to="/ad-analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><LineChart size={20} /> Ad Analytics</NavLink>

        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6 px-4">Growth & Engagement</div>
        <NavLink to="/retention" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Target size={20} /> Retention Lab</NavLink>
        <NavLink to="/ab-testing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FlaskConical size={20} /> A/B Testing</NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Bell size={20} /> Notifications</NavLink>
        <NavLink to="/missions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><CheckSquare size={20} /> Mission Builder</NavLink>
        <NavLink to="/referrals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Network size={20} /> Referral Tree</NavLink>
        <NavLink to="/badges" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Award size={20} /> Badges</NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Trophy size={20} /> Leaderboard</NavLink>
        <NavLink to="/marquee" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Megaphone size={20} /> Social-Proof Feed</NavLink>
        <NavLink to="/progression" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><TrendingUp size={20} /> Progression</NavLink>
        <NavLink to="/content-strings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FileText size={20} /> Content Strings</NavLink>
        
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6 px-4">Content & News</div>
        <NavLink to="/news-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Activity size={20} /> News Dashboard</NavLink>
        <NavLink to="/articles" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FileText size={20} /> Articles</NavLink>
        <NavLink to="/categories" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Layers size={20} /> Categories</NavLink>
        <NavLink to="/trending-shorts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Play size={20} /> Trending Shorts</NavLink>
        <NavLink to="/news/discover-filters" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Filter size={20} /> Discover Filters</NavLink>
        <NavLink to="/content" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Database size={20} /> RSS Sources</NavLink>
        <NavLink to="/suggestions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><MessageSquare size={20} /> User Suggestions</NavLink>

        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6 px-4">Security & System</div>
        <NavLink to="/fraud" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><AlertTriangle size={20} /> Fraud Center</NavLink>
        <NavLink to="/error-logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Bug size={20} /> Error Log</NavLink>
        <NavLink to="/security" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Shield size={20} /> Security Ops (Audit)</NavLink>
        <NavLink to="/env" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FileCode size={20} /> Env Manager</NavLink>
        <NavLink to="/monitoring" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Activity size={20} /> Server Monitoring</NavLink>
        <NavLink to="/logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Terminal size={20} /> System Logs</NavLink>

        {/* Admin user info and logout */}
        <div className="mt-8 mx-4 pt-4 border-t border-[#333]">
          <div className="text-gray-400 text-xs mb-2 truncate">{adminUser?.email || 'Admin'}</div>
          <button 
            onClick={onLogout}
            className="flex items-center text-red-400 hover:text-red-300 text-sm transition-colors w-full py-2"
          >
            <LogOut size={16} className="mr-2" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'denied' | 'anonymous'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token || token === 'dummy-admin-token') {
      setAuthState('anonymous');
      return;
    }
    getMe()
      .then((res) => {
        localStorage.setItem('adminUser', JSON.stringify(res.data.data));
        setAuthState('authenticated');
      })
      .catch(() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        setAuthState('denied');
      });
  }, []);

  const handleLogin = () => {
    setAuthState('authenticated');
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAuthState('anonymous');
  };

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-red-500/40 bg-red-950/20 p-6">
          <h1 className="text-xl font-bold text-red-300 mb-2">Admin OAuth is not configured</h1>
          <p className="text-gray-300 text-sm">
            Set <code className="bg-black/40 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> before using the admin panel.
          </p>
        </div>
      </div>
    );
  }

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <ShieldCheck className="animate-pulse" size={24} />
          <span>Verifying access…</span>
        </div>
      </div>
    );
  }

  if (authState === 'denied') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-red-500/40 bg-red-950/20 p-6 text-center">
          <AlertTriangle className="text-red-400 mx-auto mb-3" size={32} />
          <h1 className="text-xl font-bold text-red-300 mb-2">Access Denied</h1>
          <p className="text-gray-300 text-sm mb-6">
            Your session expired, or this account doesn't have admin privileges.
          </p>
          <button
            onClick={() => setAuthState('anonymous')}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-sm font-medium"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (authState === 'anonymous') {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AdminLogin onLogin={handleLogin} />
      </GoogleOAuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <div className="app-container flex h-screen bg-[#111]">
          <Sidebar onLogout={handleLogout} />
          <main className="main-content flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/live" element={<LiveTracking />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/config" element={<ConfigPage />} />
              <Route path="/withdrawals" element={<Withdrawals />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/retention" element={<Retention />} />
              <Route path="/ab-testing" element={<ABTesting />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/missions" element={<Missions />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/badges" element={<BadgesPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/marquee" element={<MarqueePage />} />
              <Route path="/progression" element={<ProgressionPage />} />
              <Route path="/content-strings" element={<ContentStringsPage />} />
              <Route path="/fraud" element={<FraudLogs />} />
              <Route path="/error-logs" element={<ErrorLogsPage />} />
              <Route path="/security" element={<SecurityLogs />} />
              <Route path="/content" element={<ContentPage />} />
              <Route path="/news-dashboard" element={<ContentDashboard />} />
              <Route path="/articles" element={<ArticleBrowser />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/trending-shorts" element={<TrendingShorts />} />
              <Route path="/news/discover-filters" element={<DiscoverFiltersPage />} />
              <Route path="/env" element={<EnvConfig />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/logs" element={<Logs />} />
              
              {/* Remote Config Routes */}
              <Route path="/ad-placements" element={<AdPlacements />} />
              <Route path="/ad-rules" element={<AdRewardRules />} />
              <Route path="/cap-policies" element={<DailyCapPolicies />} />
              <Route path="/feature-flags" element={<FeatureFlags />} />
              <Route path="/screen-layout" element={<ScreenLayout />} />
              <Route path="/ad-analytics" element={<AdAnalytics />} />
              <Route path="/roulette" element={<RouletteConfig />} />

              <Route path="*" element={<div className="p-6 text-white">Module Under Construction.</div>} />
            </Routes>
          </main>
        </div>
      </Router>
    </GoogleOAuthProvider>
  );
};

export default App;
