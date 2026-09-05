import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Share, Image, Linking } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { Shimmer } from '../components/ui/Shimmer';
import { completeTask, getOfferwallTasks, type OfferwallTask } from '../api/offerwall';
import { getReferralStats } from '../api/referral';
import { claimDailyBonus, getDailyMissions, getProfile } from '../api/user';
import { Coins, CheckSquare, Gift, Users, Copy, Share2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import DailyStreakRow from '../components/ui/DailyStreakRow';
import CoinRain from '../components/ui/CoinRain';
import { useToast } from '../components/ui/Toast';
import { VIBIcon } from '../components/ui/VIBIcon';
import { StoreScreen } from '../components/affiliate/StoreScreen';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

export const RewardsScreen = React.memo(() => {
  const insets = useSafeAreaInsets();
  const storeEnabled = useFeatureFlag('affiliate_store_enabled', false);

  const mountedRef = React.useRef(true);
  React.useEffect(() => { return () => { mountedRef.current = false; } }, []);
  // dailyBonusAvailable only flips to false in the store *after* the claim
  // request resolves, so a rapid double-tap on "Claim" before that render
  // lands would otherwise pass the disabled-button check twice.
  const claimingBonusRef = React.useRef(false);

  const { coinBalance, user, updateBalance, setBalance, dailyBonusAvailable, setDailyBonusAvailable, trackEvent } = useAppStore(useShallow(s => ({ coinBalance: s.coinBalance, user: s.user, updateBalance: s.updateBalance, setBalance: s.setBalance, dailyBonusAvailable: s.dailyBonusAvailable, setDailyBonusAvailable: s.setDailyBonusAvailable, trackEvent: s.trackEvent })));
  const [activeTab, setActiveTab] = useState<'shop' | 'tasks' | 'daily' | 'referrals'>(() => (storeEnabled ? 'shop' : 'tasks'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<OfferwallTask[]>([]);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [rainAmount, setRainAmount] = useState(0);
  const [showRain, setShowRain] = useState(false);
  const { showToast } = useToast();

  const loadData = async (mounted = true) => {
    try {
      if (!mounted) return;
      setError('');
      if (activeTab === 'shop') {
        // StoreScreen fetches and manages its own loading state internally —
        // nothing to do here besides clearing the top-level loading spinner.
        return;
      } else if (activeTab === 'tasks') {
        const res = await getOfferwallTasks();
        if (mounted) setTasks(res.data || []);
      } else if (activeTab === 'referrals') {
        const stats = await getReferralStats();
        if (mounted) setReferralStats(stats.data);
      } else {
        const miss = await getDailyMissions();
        if (mounted) setMissions(miss);
      }
    } catch {
      if (mounted) setError('Could not load this section.');
    } finally {
      if (mounted) {
        if (mountedRef.current) setLoading(false);
        if (mountedRef.current) setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mountedRef.current) setLoading(true);
    loadData(mounted);
    return () => { mounted = false; };
  }, [activeTab]);

  const onRefresh = () => {
    if (mountedRef.current) setRefreshing(true);
    loadData();
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast('Referral code copied', 'success');
  };

  const handleTask = async (task: OfferwallTask) => {
    // No third-party network verifies these — opening the task's own link
    // (if it has one) is the only real "did they engage" signal available,
    // so send them there before crediting rather than crediting on a tap
    // that never left the app.
    if (task.externalUrl) {
      Linking.openURL(task.externalUrl).catch(() => {});
    }
    const taskId = task.id;
    try {
      if (mountedRef.current) setBusyTaskId(taskId);
      const result = await completeTask(taskId);
      // updateBalance() already applies the earned delta to the store
      // correctly (a functional update, race-safe against other concurrent
      // coin-earning actions). The profile refresh below is just a
      // best-effort correction toward server truth — if IT fails, that must
      // not turn into a "task could not be completed" error toast for a
      // task that, in fact, already completed and paid out.
      updateBalance(result.coinsEarned || 0);
      trackEvent('OFFERWALL', 1);
      showToast(<View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{color: '#fff', fontSize: 14}}>Task complete — you earned {result.coinsEarned || 0} </Text><VIBIcon size={14} /><Text style={{color: '#fff', fontSize: 14}}>.</Text></View>, 'success');
      const profile = await getProfile().catch(() => null);
      if (profile?.coins !== undefined) setBalance(profile.coins);
      await loadData().catch(() => {});
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'This task could not be completed.', 'error');
    } finally {
      if (mountedRef.current) setBusyTaskId(null);
    }
  };

  const handleClaimDailyBonus = async () => {
    if (!dailyBonusAvailable || claimingBonusRef.current) return;
    claimingBonusRef.current = true;
    try {
      const result = await claimDailyBonus();
      if (result.claimed) {
        // updateBalance() alone is the correct, race-safe update here —
        // it was previously followed by setBalance(coinBalance + earned),
        // which recomputed from a stale render-time coinBalance snapshot
        // and could clobber a concurrent coin-earning action's result.
        updateBalance(result.coinsEarned || 0);
        setDailyBonusAvailable(false);
        // Daily bonus is the most emotionally important habit-loop moment in
        // the app — give it the same CoinRain celebration Discover ad-rewards
        // already get, instead of a plain system alert.
        setRainAmount(result.coinsEarned || 0);
        setShowRain(true);
      } else {
        showToast(result.message || 'Already claimed — come back tomorrow.', 'info');
      }
      await loadData().catch(() => {});
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Bonus unavailable — please try again later.', 'error');
    } finally {
      claimingBonusRef.current = false;
    }
  };

  const shareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join ReelFlow using my code ${code} and let's earn together!`,
      });
    } catch {
      // Silently fail share
    }
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(storeEnabled ? (['shop', 'tasks', 'daily', 'referrals'] as const) : (['tasks', 'daily', 'referrals'] as const)).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const nextResetHours = Math.max(1, Math.ceil((new Date().setHours(24, 0, 0, 0) - Date.now()) / 3600000));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(60, insets.top) }]}>
        <Text style={styles.headerTitle}>Earn More</Text>
        <View style={styles.balanceBadge}>
          <Text style={styles.balanceText}>{coinBalance}</Text>
          <VIBIcon size={16} style={{ marginLeft: 4 }} animated />
        </View>
      </View>

      {renderTabs()}

      {activeTab === 'shop' ? (
        // StoreScreen owns a FlatList internally — it must not be nested
        // inside the ScrollView below (nesting a virtualized list inside a
        // plain ScrollView defeats virtualization and was already a real
        // perf bug once in this app's shorts feed).
        <StoreScreen />
      ) : (
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {error ? (
          <TouchableOpacity style={styles.errorCard} onPress={() => loadData()}>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}
        {loading ? (
          <View>
            <Shimmer width="100%" height={100} borderRadius={12} style={{ marginBottom: 12 }} />
            <Shimmer width="100%" height={100} borderRadius={12} style={{ marginBottom: 12 }} />
            <Shimmer width="100%" height={100} borderRadius={12} />
          </View>
        ) : activeTab === 'tasks' ? (
          <View>
            {tasks.length === 0 ? (
              <Text style={styles.emptyText}>No tasks available right now — check back later!</Text>
            ) : tasks.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskIconContainer}>
                  {task.type === 'INSTALL' || task.type === 'SIGNUP' ? <CheckSquare color="#FFF" size={24} /> : <Gift color="#FFF" size={24} />}
                </View>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDesc}>{task.description}</Text>
                </View>
                <View style={styles.taskAction}>
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardText}>+{task.rewardCoins}</Text>
                    <VIBIcon size={12} style={{ marginLeft: 2 }} animated />
                  </View>
                  <TouchableOpacity
                    style={[styles.startButton, busyTaskId === task.id && styles.buttonDisabled]}
                    onPress={() => handleTask(task)}
                    disabled={busyTaskId !== null}
                  >
                    <Text style={styles.startButtonText}>{busyTaskId === task.id ? 'Working…' : 'Complete'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : activeTab === 'referrals' ? (
          <View>
            <View style={styles.referralCodeBox}>
              <Text style={styles.referralLabel}>Your Referral Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{user?.referralCode || 'LOADING'}</Text>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => copyToClipboard(user?.referralCode || '')}>
                    <Copy color="#FFF" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => shareCode(user?.referralCode || '')}>
                    <Share2 color="#FFF" size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Users color="#FFD700" size={24} />
                <Text style={styles.statValue}>{referralStats?.totalReferrals || 0}</Text>
                <Text style={styles.statLabel}>Friends Referred</Text>
              </View>
              <View style={styles.statCard}>
                <VIBIcon size={24} animated />
                <Text style={styles.statValue}>{referralStats?.earnedCoins || 0}</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <VIBIcon size={12} animated />
                  <Text style={styles.statLabel}> Earned</Text>
                </View>
              </View>
            </View>

            <View style={styles.tierBox}>
              <Text style={styles.tierTitle}>Tier {referralStats?.tier || 1} Status</Text>
              <View style={{ alignItems: 'center' }}>
                {referralStats?.tier === 1 ? (
                  <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center'}}>
                    <Text style={styles.tierDesc}>Earn 500 </Text>
                    <VIBIcon size={14} style={{ marginHorizontal: 2 }} animated />
                    <Text style={styles.tierDesc}> from referrals to unlock Tier 2 (15% commission)</Text>
                  </View>
                ) : (
                  <Text style={styles.tierDesc}>Keep referring to earn more!</Text>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View>
            <DailyStreakRow streak={user?.streak || 0} claimedToday={!dailyBonusAvailable} onClaim={dailyBonusAvailable ? handleClaimDailyBonus : undefined} />
            <View style={styles.dailyBonusBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dailyBonusTitle}>Daily bonus</Text>
                <Text style={styles.dailyBonusText}>
                  {dailyBonusAvailable ? 'Claim your login bonus now.' : `Next bonus in ~${nextResetHours}h.`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.claimButton, !dailyBonusAvailable && styles.buttonDisabled]}
                onPress={handleClaimDailyBonus}
                disabled={!dailyBonusAvailable}
              >
                <Text style={styles.claimButtonText}>{dailyBonusAvailable ? 'Claim' : 'Claimed'}</Text>
              </TouchableOpacity>
            </View>
            {missions.length === 0 ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>No daily missions are active right now.</Text>
                <Text style={styles.emptySub}>New missions can be activated from the admin panel at any time.</Text>
                <Text style={styles.emptyCountdown}>Refreshes in ~{nextResetHours}h.</Text>
              </View>
            ) : missions.map(mission => {
              const target = mission.targetCount || 1;
              const progress = mission.progress || 0;
              return (
                <View key={mission.id} style={styles.missionCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle}>{mission.title}</Text>
                    <Text style={styles.taskDesc}>{mission.description}</Text>
                    <Text style={styles.progressText}>{progress}/{target}</Text>
                  </View>
                  <Text style={styles.rewardText}>+{mission.rewardCoins || 0}</Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      )}
      <CoinRain visible={showRain} amount={rainAmount} onComplete={() => setShowRain(false)} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1A1A1A',
  },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  balanceText: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  tab: {
    marginRight: 24,
    paddingBottom: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: { color: '#FFF' },
  content: { flex: 1, padding: 16 },
  taskCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskIconContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  taskInfo: { flex: 1 },
  taskTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  taskDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  taskAction: { alignItems: 'flex-end' },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rewardText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  startButton: { backgroundColor: '#FF4D1A', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  buttonDisabled: { opacity: 0.55 },
  startButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  errorCard: { backgroundColor: 'rgba(255,77,26,0.12)', borderColor: '#FF4D1A', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: '#FFF', textAlign: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 40 },
  missionCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  progressText: { color: '#FFD700', fontSize: 12, marginTop: 8 },
  referralCodeBox: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: '#FFD700',
  },
  referralLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 12 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeText: { color: '#FFF', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 },
  iconBtn: { padding: 8, marginLeft: 8, backgroundColor: '#2A2A2A', borderRadius: 8 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16,
    alignItems: 'center', marginHorizontal: 4,
  },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginVertical: 8 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  tierBox: { backgroundColor: '#2A2A2A', borderRadius: 12, padding: 16, alignItems: 'center' },
  tierTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  tierDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  dailyBonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.12)',
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  dailyBonusTitle: { color: '#FFF', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  dailyBonusText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 18 },
  claimButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  claimButtonText: { color: '#000', fontWeight: '900' },
  emptyPanel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    marginTop: 8,
  },
  emptyTitle: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  emptySub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 6, lineHeight: 18 },
  emptyCountdown: { color: '#FFD700', fontSize: 12, fontWeight: '800', marginTop: 10 },
});
