import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Search, Shield, MapPin, Smartphone, Clock, CreditCard, Network, Download, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { adjustUserBalance, api, updateUserMetrics, bulkUpdateUsers } from '../services/api';

type TriState = 'all' | 'true' | 'false';
type SortBy = 'createdAt' | 'lastActiveAt' | 'trustScore' | 'riskScore' | 'name';

const PAGE_SIZE_OPTIONS = [50, 100, 200];

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [listError, setListError] = useState('');

  // Filters — this is what makes the list usable at 10k+ users instead of
  // scrolling through a flat, unfiltered dump.
  const [search, setSearch] = useState('');
  const [bannedFilter, setBannedFilter] = useState<TriState>('all');
  const [shadowFilter, setShadowFilter] = useState<TriState>('all');
  const [minTrust, setMinTrust] = useState('');
  const [maxTrust, setMaxTrust] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params: Record<string, string | number> = { limit, offset, sortBy, sortDir };
      if (search.trim()) params.search = search.trim();
      if (bannedFilter !== 'all') params.banned = bannedFilter;
      if (shadowFilter !== 'all') params.shadowBanned = shadowFilter;
      if (minTrust !== '') params.minTrust = minTrust;
      if (maxTrust !== '') params.maxTrust = maxTrust;

      const { data } = await api.get('/admin/users', { params });
      setUsers(data.data || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
      setListError('Failed to load users. Try again.');
    } finally {
      setLoading(false);
    }
  }, [limit, offset, sortBy, sortDir, search, bannedFilter, shadowFilter, minTrust, maxTrust]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Any filter change resets to page 1 — a stale offset past a shrunk
  // result set would otherwise render an empty page.
  const resetToFirstPage = () => setOffset(0);

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      resetToFirstPage();
    }, 350);
  };

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    resetToFirstPage();
  };

  const handleBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const amount = Number(balanceAmount);
    if (!Number.isInteger(amount) || amount === 0 || !balanceReason.trim()) return;
    if (!window.confirm(`Adjust ${selectedUser.name}'s balance by ${amount} VIB?`)) return;
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
      fetchUsers();
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
      fetchUsers();
    } catch (err) {
      console.error('Failed to update shadowban status', err);
      alert('Failed to update shadowban status');
    }
  };

  // ── Bulk selection ──────────────────────────────────────────────────
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        users.forEach((u) => next.delete(u.id));
      } else {
        users.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  const runBulkAction = async (action: 'ban' | 'unban' | 'shadowban' | 'unshadowban') => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Apply "${action}" to ${selectedIds.size} selected user(s)?`)) return;
    setBulkBusy(true);
    try {
      await bulkUpdateUsers(Array.from(selectedIds), action);
      setSelectedIds(new Set());
      await fetchUsers();
    } catch (err) {
      console.error('Bulk action failed', err);
      alert('Bulk action failed');
    } finally {
      setBulkBusy(false);
    }
  };

  // ── CSV export (current filtered page) ──────────────────────────────
  const exportCsv = () => {
    const header = ['id', 'name', 'email', 'coins', 'trustScore', 'riskScore', 'banned', 'shadowBanned', 'country', 'createdAt', 'lastActiveAt'];
    const rows = users.map((u) => header.map((key) => {
      const v = u[key];
      const cell = v === null || v === undefined ? '' : String(v);
      return `"${cell.replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="p-6 flex h-full gap-6">
      {/* Left List */}
      <div className="w-2/5 flex flex-col min-w-[420px]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Users className="mr-3 text-blue-400" /> User Intelligence
          </h1>
          <span className="text-xs text-gray-500">{total.toLocaleString()} total</span>
        </div>

        {/* Search */}
        <div className="mb-3 relative">
          <input
            type="text"
            placeholder="Search ID, Email, Name..."
            className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
        </div>

        {/* Filter bar */}
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <select
            value={bannedFilter}
            onChange={(e) => { setBannedFilter(e.target.value as TriState); resetToFirstPage(); }}
            className="bg-[#1A1A1A] border border-[#333] rounded-lg px-2 py-1.5 text-gray-300"
          >
            <option value="all">All (banned/active)</option>
            <option value="false">Active only</option>
            <option value="true">Banned only</option>
          </select>
          <select
            value={shadowFilter}
            onChange={(e) => { setShadowFilter(e.target.value as TriState); resetToFirstPage(); }}
            className="bg-[#1A1A1A] border border-[#333] rounded-lg px-2 py-1.5 text-gray-300"
          >
            <option value="all">All (shadowban)</option>
            <option value="false">Not shadowbanned</option>
            <option value="true">Shadowbanned only</option>
          </select>
          <input
            type="number"
            placeholder="Min trust"
            value={minTrust}
            onChange={(e) => { setMinTrust(e.target.value); resetToFirstPage(); }}
            className="bg-[#1A1A1A] border border-[#333] rounded-lg px-2 py-1.5 text-gray-300"
          />
          <input
            type="number"
            placeholder="Max trust"
            value={maxTrust}
            onChange={(e) => { setMaxTrust(e.target.value); resetToFirstPage(); }}
            className="bg-[#1A1A1A] border border-[#333] rounded-lg px-2 py-1.5 text-gray-300"
          />
        </div>

        {/* Sort bar */}
        <div className="mb-3 flex items-center gap-1 text-xs text-gray-400 flex-wrap">
          <span className="mr-1">Sort:</span>
          {([
            ['createdAt', 'Joined'],
            ['lastActiveAt', 'Active'],
            ['trustScore', 'Trust'],
            ['riskScore', 'Risk'],
            ['name', 'Name'],
          ] as [SortBy, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`px-2 py-1 rounded ${sortBy === field ? 'bg-blue-900/40 text-blue-300' : 'bg-[#1A1A1A] hover:bg-[#222]'}`}
            >
              {label}{sortBy === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 bg-blue-900/20 border border-blue-800/40 rounded-lg px-3 py-2 text-xs">
            <span className="text-blue-300 font-semibold">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button disabled={bulkBusy} onClick={() => runBulkAction('ban')} className="px-2 py-1 rounded bg-red-900/40 text-red-300 hover:bg-red-900/60 disabled:opacity-50">Ban</button>
            <button disabled={bulkBusy} onClick={() => runBulkAction('unban')} className="px-2 py-1 rounded bg-[#222] text-gray-300 hover:bg-[#2a2a2a] disabled:opacity-50">Unban</button>
            <button disabled={bulkBusy} onClick={() => runBulkAction('shadowban')} className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50">Shadowban</button>
            <button disabled={bulkBusy} onClick={() => runBulkAction('unshadowban')} className="px-2 py-1 rounded bg-[#222] text-gray-300 hover:bg-[#2a2a2a] disabled:opacity-50">Un-shadow</button>
            <button onClick={() => setSelectedIds(new Set())} className="px-2 py-1 rounded bg-[#111] text-gray-500 hover:text-gray-300">Clear</button>
          </div>
        )}

        {listError && <div role="alert" className="text-sm text-amber-400 mb-3">{listError}</div>}

        {/* List header row */}
        <div className="flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-wide text-gray-500 border-b border-[#333]">
          <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} className="accent-blue-500" />
          <span>Select all on page</span>
          <div className="flex-1" />
          <button onClick={exportCsv} className="flex items-center gap-1 text-gray-400 hover:text-white" title="Export current page to CSV">
            <Download size={12} /> Export
          </button>
        </div>

        <div className="bg-[#1A1A1A] rounded-b-xl overflow-hidden border border-t-0 border-[#333] flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-gray-500 text-sm">Loading…</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-gray-500 text-sm">No matching users found.</div>
          ) : users.map(u => (
            <div
              key={u.id}
              className={`flex items-start gap-2 p-4 border-b border-[#333] cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-[#222]'}`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(u.id)}
                onChange={(e) => { e.stopPropagation(); toggleSelected(u.id); }}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 accent-blue-500"
              />
              <div className="flex-1 flex justify-between items-start" onClick={() => loadUserIntelligence(u.id)}>
                <div>
                  <div className="text-white font-bold flex items-center gap-2">
                    {u.name}
                    {u.banned && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/50 text-red-400">BANNED</span>}
                    {u.shadowBanned && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300">SHADOW</span>}
                    {u._count?.fraudLogs > 0 && (
                      <span title={`${u._count.fraudLogs} fraud incident(s)`} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-orange-900/40 text-orange-400">
                        <Flag size={10} /> {u._count.fraudLogs}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs">{u.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--accent)] font-mono text-sm">{u.coins} VIB</div>
                  <div className={`text-xs mt-1 ${u.trustScore < 40 ? 'text-red-400' : 'text-green-400'}`}>TS: {u.trustScore}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>Page size:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
              className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-1"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span>Page {page} of {pageCount}</span>
            <button disabled={!canPrev} onClick={() => setOffset(Math.max(0, offset - limit))} className="p-1.5 rounded bg-[#1A1A1A] border border-[#333] disabled:opacity-30 hover:bg-[#222]">
              <ChevronLeft size={14} />
            </button>
            <button disabled={!canNext} onClick={() => setOffset(offset + limit)} className="p-1.5 rounded bg-[#1A1A1A] border border-[#333] disabled:opacity-30 hover:bg-[#222]">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Intelligence Panel */}
      <div className="flex-1">
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
                <div className="text-xl font-bold text-[var(--accent)]">{selectedUser.coins || 0} VIB</div>
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
                <label className="sr-only" htmlFor="balance-amount">VIB amount</label>
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
