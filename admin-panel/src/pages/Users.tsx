import React, { useState, useEffect } from 'react';
import { Users, Search, Shield, MapPin, Smartphone, Clock, CreditCard, Network } from 'lucide-react';
import { adjustUserBalance, api, updateUserMetrics } from '../services/api';

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users?limit=100');
      setUsers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchMessage('');
    try {
      const { data } = await api.get('/admin/users', { params: { limit: 100, search: search.trim() || undefined } });
      setUsers(data.data || []);
      if ((data.data || []).length === 1) loadUserIntelligence(data.data[0].id);
      if ((data.data || []).length === 0) setSearchMessage('No matching users found.');
    } catch (err) {
      console.error(err);
      setSearchMessage('Search failed. Try again.');
    }
  };

  const handleBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const amount = Number(balanceAmount);
    if (!Number.isInteger(amount) || amount === 0 || !balanceReason.trim()) return;
    if (!window.confirm(`Adjust ${selectedUser.name}'s balance by ${amount} coins?`)) return;
    try {
      setAdjusting(true);
      await adjustUserBalance(selectedUser.id, amount, balanceReason.trim());
      setBalanceAmount('');
      setBalanceReason('');
      await Promise.all([loadUserIntelligence(selectedUser.id), fetchUsers()]);
    } catch (err) {
      console.error(err);
      alert('Balance adjustment failed');
    } finally {
      setAdjusting(false);
    }
  };

  const loadUserIntelligence = async (id: number) => {
    try {
      const { data } = await api.get(`/admin/user-intelligence/${id}`);
      setSelectedUser(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBanUser = async () => {
    if (!selectedUser) return;
    const isBanned = selectedUser.banned;
    if (!window.confirm(`Are you sure you want to ${isBanned ? 'unban' : 'ban'} this user?`)) return;
    
    try {
      await updateUserMetrics(selectedUser.id, { banned: !isBanned });
      loadUserIntelligence(selectedUser.id);
      fetchUsers(); // Refresh list to reflect potentially changed status
    } catch (err) {
      console.error('Failed to update ban status', err);
      alert('Failed to update ban status');
    }
  };

  const handleShadowbanUser = async () => {
    if (!selectedUser) return;
    const isShadowbanned = selectedUser.shadowBanned;
    if (!window.confirm(`Are you sure you want to ${isShadowbanned ? 'remove shadowban from' : 'shadowban'} this user?`)) return;
    
    try {
      await updateUserMetrics(selectedUser.id, { shadowBanned: !isShadowbanned });
      loadUserIntelligence(selectedUser.id);
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error('Failed to update shadowban status', err);
      alert('Failed to update shadowban status');
    }
  };

  if (loading) return <div className="p-6 text-white">Loading Intelligence DB...</div>;

  return (
    <div className="p-6 flex h-full gap-6">
      {/* Left List */}
      <div className="w-1/3 flex flex-col">
        <h1 className="text-2xl font-bold text-white mb-4 flex items-center">
          <Users className="mr-3 text-blue-400" /> User Intelligence
        </h1>
        
        <form onSubmit={handleSearch} className="mb-4 relative">
          <input 
            type="text" 
            placeholder="Search ID, Email, IP..." 
            className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
        </form>
        {searchMessage && <div role="alert" className="text-sm text-amber-400 mb-3">{searchMessage}</div>}

        <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333] flex-1 overflow-y-auto">
          {users.map(u => (
            <div 
              key={u.id} 
              onClick={() => loadUserIntelligence(u.id)}
              className={`p-4 border-b border-[#333] cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-[#222]'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-white font-bold flex items-center gap-2">
                    {u.name}
                    {u.banned && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/50 text-red-400">BANNED</span>}
                    {u.shadowBanned && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300">SHADOW</span>}
                  </div>
                  <div className="text-gray-400 text-xs">{u.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--accent)] font-mono text-sm">{u.coins} coins</div>
                  <div className={`text-xs mt-1 ${u.trustScore < 40 ? 'text-red-400' : 'text-green-400'}`}>TS: {u.trustScore}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Intelligence Panel */}
      <div className="w-2/3">
        {selectedUser ? (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] h-full overflow-y-auto p-6">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-[#333] pb-6 mb-6">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  {selectedUser.name}
                  {selectedUser.banned && <span className="px-2 py-1 rounded text-xs bg-red-900/50 text-red-400">BANNED</span>}
                  {selectedUser.shadowBanned && <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">SHADOWBANNED</span>}
                </h2>
                <div className="text-gray-400 mt-1 flex items-center gap-4">
                  <span>ID: {selectedUser.id}</span>
                  <span>{selectedUser.email}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleBanUser}
                  className={`px-4 py-2 rounded border transition-colors ${selectedUser.banned ? 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30' : 'bg-red-900/30 text-red-400 border-red-900/50 hover:bg-red-900/50'}`}
                >
                  {selectedUser.banned ? 'Unban User' : 'Ban User'}
                </button>
                <button 
                  onClick={handleShadowbanUser}
                  className={`px-4 py-2 rounded transition-colors ${selectedUser.shadowBanned ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                >
                  {selectedUser.shadowBanned ? 'Remove Shadowban' : 'Shadowban'}
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-[#222] p-4 rounded-lg">
                <div className="text-gray-500 text-xs mb-1 flex items-center"><CreditCard size={14} className="mr-1"/> Balance</div>
                <div className="text-xl font-bold text-[var(--accent)]">{selectedUser.coins || 0} coins</div>
              </div>
              <div className="bg-[#222] p-4 rounded-lg">
                <div className="text-gray-500 text-xs mb-1 flex items-center"><Shield size={14} className="mr-1"/> Trust Score</div>
                <div className={`text-xl font-bold ${selectedUser.trustScore < 40 ? 'text-red-500' : 'text-green-500'}`}>{selectedUser.trustScore}/100</div>
              </div>
              <div className="bg-[#222] p-4 rounded-lg">
                <div className="text-gray-500 text-xs mb-1 flex items-center"><MapPin size={14} className="mr-1"/> Country</div>
                <div className="text-xl font-bold text-white">{selectedUser.country || 'Unknown'}</div>
              </div>
              <div className="bg-[#222] p-4 rounded-lg">
                <div className="text-gray-500 text-xs mb-1 flex items-center"><Clock size={14} className="mr-1"/> Last Active</div>
                <div className="text-lg font-bold text-white">{new Date(selectedUser.lastActiveAt).toLocaleDateString()}</div>
              </div>
            </div>

            <form onSubmit={handleBalanceAdjustment} className="bg-[#222] border border-[#333] rounded-lg p-4 mb-8">
              <h3 className="text-sm font-bold text-white mb-3">Manual balance adjustment</h3>
              <div className="grid grid-cols-[160px_1fr_auto] gap-3">
                <label className="sr-only" htmlFor="balance-amount">Coin amount</label>
                <input id="balance-amount" type="number" step="1" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} placeholder="+100 or -100" className="bg-[#111] border border-[#444] rounded px-3 py-2 text-white" required />
                <label className="sr-only" htmlFor="balance-reason">Reason</label>
                <input id="balance-reason" value={balanceReason} onChange={e => setBalanceReason(e.target.value)} placeholder="Required audit reason" className="bg-[#111] border border-[#444] rounded px-3 py-2 text-white" required />
                <button disabled={adjusting} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-4 py-2">{adjusting ? 'Applying…' : 'Apply'}</button>
              </div>
            </form>

            {/* Lifetime Metrics Grid */}
            <div className="bg-[#222] border border-[#333] rounded-lg p-4 mb-8">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center">Lifetime Metrics (Mission Triggers)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">Screentime</div>
                  <div className="text-lg font-bold text-white">{selectedUser.lifetimeScreentimeMin || 0} mins</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">News Reads</div>
                  <div className="text-lg font-bold text-white">{selectedUser.lifetimeNewsReads || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Ads Watched (Total)</div>
                  <div className="text-lg font-bold text-white">{selectedUser.lifetimeAdsWatched || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Shorts Watched</div>
                  <div className="text-lg font-bold text-white">{selectedUser.lifetimeShortsWatched || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Games Played</div>
                  <div className="text-lg font-bold text-white">{selectedUser.lifetimeGamesPlayed || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Offerwall Tasks</div>
                  <div className="text-lg font-bold text-white">{selectedUser.lifetimeOfferwallTasks || 0}</div>
                </div>
              </div>
            </div>

            {/* Deep Dive Tabs */}
            <div className="space-y-6">
              
              {/* Device History */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center"><Smartphone size={18} className="mr-2 text-blue-400"/> Device History</h3>
                <div className="bg-[#222] rounded-lg p-4 text-sm text-gray-300">
                  {selectedUser.devices?.length > 0 ? selectedUser.devices.map((d: any) => (
                    <div key={d.id} className="flex justify-between items-center py-2 border-b border-[#333] last:border-0">
                      <div>
                        <div className="text-white font-mono">{d.deviceIdHash}</div>
                        <div className="text-xs text-gray-500">IP: {d.lastIpAddress} • {d.osVersion}</div>
                      </div>
                      <div className="flex gap-2">
                        {d.isEmulator && <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded text-xs">EMULATOR</span>}
                        {d.isRooted && <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded text-xs">ROOTED</span>}
                      </div>
                    </div>
                  )) : "No device records found."}
                </div>
              </div>

              {/* Referral Tree */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center"><Network size={18} className="mr-2 text-purple-400"/> Referral Tree</h3>
                <div className="bg-[#222] rounded-lg p-4 text-sm text-gray-300 font-mono">
                  {selectedUser.referredBy && (
                    <div className="text-gray-500 mb-2">↑ Referred by: {selectedUser.referredBy.referrer.name} (Tier {selectedUser.referredBy.tier})</div>
                  )}
                  <div className="text-white font-bold">● {selectedUser.name} (Me)</div>
                  {selectedUser.referrals?.length > 0 ? selectedUser.referrals.map((r: any) => (
                    <div key={r.id} className="pl-4 border-l-2 border-[#444] ml-2 mt-2">
                      ├─ {r.referred.name} (Tier {r.tier})
                    </div>
                  )) : <div className="pl-4 text-gray-500 mt-2">No referrals yet</div>}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] h-full flex flex-col items-center justify-center text-gray-500">
            <Users size={64} className="mb-4 opacity-20" />
            <p>Select a user to view deep intelligence</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
