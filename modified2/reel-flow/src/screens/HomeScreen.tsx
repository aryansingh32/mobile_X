import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useState, useMemo, useRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Image, Linking } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { useConfigStore } from '../store/useConfigStore';
import { Shimmer } from '../components/ui/Shimmer';
import { getDailyMissions, getProfile, syncStreak } from '../api/user';
import { Flame, Coins, PlaySquare, Newspaper, CheckSquare, Bell, Gamepad2, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, MOTION } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { FallingEmbers } from '../components/ui/FallingEmbers';
import RewardCard from '../components/ui/RewardCard';
import { ShatterWrapper } from '../components/ui/ShatterWrapper';
import { Dimensions } from 'react-native';
import type { TabId } from '../components/BottomNavBar';
import { useContent } from '../hooks/useContent';
import CoinCounter from '../components/ui/CoinCounter';
import AnimatedProgressBar from '../components/ui/AnimatedProgressBar';
import SectionHeader from '../components/ui/SectionHeader';
import AutoMarquee from '../components/ui/AutoMarquee';
import { useToast } from '../components/ui/Toast';
import { DailyMissionsCard } from '../components/ui/DailyMissionsCard';
import { fetchGamesFromOrigin, Game } from '../api/games';
import { GamePlayerOverlay, GamePlayerOverlayHandle } from '../components/ui/GamePlayerOverlay';
import { GameGridCard } from '../components/ui/GameGridCard';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useAdPlacement, isAdPenalized, getAdPenaltyRemainingSeconds } from '../hooks/useAdPlacement';
import { useAdUnitId } from '../hooks/useAdUnitId';
import { reportAdEvent } from '../api/config';
import { reportAdEventWithPenaltyCheck, formatAdPenaltyMessage } from '../utils/adFarmingGuard';
import { fetchCached, invalidateCached, peekCached } from '../utils/requestCache';
import { getRouletteConfig } from '../api/rewards';
import { getDeviceId } from '../utils/deviceSafety';
import CoinRain from '../components/ui/CoinRain';
import { RouletteWheel, RouletteSlice } from '../components/ui/RouletteWheel';
import RedemptionSuccessScreen from './RedemptionSuccessScreen';
import { TrendingShortsCatalog } from '../components/ui/TrendingShortsCatalog';
import { VIBIcon } from '../components/ui/VIBIcon';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { AffiliateProduct, getAffiliateProducts, trackAffiliateClick } from '../api/affiliate';
import { ProductCard } from '../components/affiliate/ProductCard';

type HomeScreenProps = {
  onNavigate: (tab: TabId) => void;
  onOpenGames: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenDailyMissions: () => void;
  onOpenShortsWithVideo?: (videoId: string) => void;
};

// Lets the app's shared Android hardware-back handler close a game opened
// via Home's own "quick play" entry point — this screen keeps its own
// selectedGame state, invisible to App.tsx's back handler otherwise, which
// previously meant hardware-back while such a game was open fell through
// to "exit the app" instead of closing the game.
export interface HomeScreenHandle {
  handleBack: () => boolean;
}

export const HomeScreen = React.memo(React.forwardRef<HomeScreenHandle, HomeScreenProps>(({
  onNavigate,
  onOpenGames,
  onOpenProfile,
  onOpenNotifications,
  onOpenDailyMissions,
  onOpenShortsWithVideo,
}, ref) => {
  const {
    user,
    isAdPlaying,
    setAdPlaying,
    canWatchAd,
    incrementAdCount,
    updateBalance,
    coinBalance,
    xp,
    level,
    streak,
    dailyAdsWatched,
    dailyRewardsCap,
    streakClaimedToday,
    setBalance,
    setXp,
    setLevel,
    setStreak,
    setDailyStats,
    setStreakClaimedToday,
    setDailyBonusAvailable,
    setConfigValues,
    sponsoredCardClaimedDate,
    setSponsoredCardClaimedDate,
    games,
    setGames,
    trackEvent,
  } = useAppStore(useShallow(s => ({ user: s.user, isAdPlaying: s.isAdPlaying, setAdPlaying: s.setAdPlaying, canWatchAd: s.canWatchAd, incrementAdCount: s.incrementAdCount, updateBalance: s.updateBalance, coinBalance: s.coinBalance, xp: s.xp, level: s.level, streak: s.streak, dailyAdsWatched: s.dailyAdsWatched, dailyRewardsCap: s.dailyRewardsCap, streakClaimedToday: s.streakClaimedToday, setBalance: s.setBalance, setXp: s.setXp, setLevel: s.setLevel, setStreak: s.setStreak, setDailyStats: s.setDailyStats, setStreakClaimedToday: s.setStreakClaimedToday, setDailyBonusAvailable: s.setDailyBonusAvailable, setConfigValues: s.setConfigValues, sponsoredCardClaimedDate: s.sponsoredCardClaimedDate, setSponsoredCardClaimedDate: s.setSponsoredCardClaimedDate, games: s.games, setGames: s.setGames, trackEvent: s.trackEvent })));

  // Lazy init: if Home was already visited this session (its dashboard
  // fetch is cached), skip the initial shimmer frame entirely instead of
  // defaulting to `true` and flipping to `false` a tick later — App.tsx
  // fully remounts this screen on every tab switch, so without this a
  // revisit within the cache's freshness window still flashed the skeleton.
  const [loading, setLoading] = useState(() => peekCached('home:dashboard') === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const gamePlayerRef = useRef<GamePlayerOverlayHandle>(null);

  useImperativeHandle(ref, () => ({
    handleBack: () => gamePlayerRef.current?.handleBack() ?? false,
  }), []);
  const [missions, setMissions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [coinRain, setCoinRain] = useState({ visible: false, amount: 0 });
  const [rouletteChances, setRouletteChances] = useState(2);
  const [isRouletteAdLoading, setIsRouletteAdLoading] = useState(false);
  const [autoSpinPending, setAutoSpinPending] = useState(false);
  const [rouletteConfig, setRouletteConfig] = useState<RouletteSlice[]>([]);
  const [showRedemptionSuccess, setShowRedemptionSuccess] = useState(false);
  const [wonXpAmount, setWonXpAmount] = useState(0);
  const [showRouletteModal, setShowRouletteModal] = useState(false);
  const [isSponsoredCardShattered, setIsSponsoredCardShattered] = useState(false);
  const [rouletteConfigLoading, setRouletteConfigLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Sponsored card is claimed today if date matches
  const todayStr = new Date().toISOString().split('T')[0];
  const sponsoredCardClaimed = sponsoredCardClaimedDate === todayStr;

  const { showToast } = useToast();

  const storeEnabled = useFeatureFlag('affiliate_store_enabled', false);
  const [storeProducts, setStoreProducts] = useState<AffiliateProduct[]>([]);
  useEffect(() => {
    if (!storeEnabled) return;
    getAffiliateProducts().then((products) => setStoreProducts(products.slice(0, 6))).catch(() => {});
  }, [storeEnabled]);

  const handleStoreProductBuy = async (product: AffiliateProduct) => {
    try {
      const result = await trackAffiliateClick(product.id);
      await Linking.openURL(result.affiliateUrl || product.affiliateUrl);
      showToast(`Opening ${product.platform}… VIB is credited after your purchase is verified.`, 'info');
    } catch {
      Linking.openURL(product.affiliateUrl).catch(() => showToast('Could not open the product link', 'error'));
    }
  };

  const rewardedCoinAmount = useConfigStore(
    (s) => s.adRewardRules?.['REWARDED']?.coinsAwarded ?? 100
  );
  const { config: homeRewardPlacement, canShow: canShowHomeReward } =
    useAdPlacement('home_sponsored_card');
  const homeRewardAdUnitId = useAdUnitId(
    homeRewardPlacement?.adUnitKey ?? 'REWARDED',
    TestIds.REWARDED
  );

  const preloadedHomeAdRef = useRef<any>(null);
  const preloadedHomeAdReadyRef = useRef(false);
  // streakClaimedToday comes from the Zustand store and only updates the
  // component's closure on the *next* render, so a rapid double-tap on
  // "Claim" before that render lands would otherwise pass the
  // !streakClaimedToday check twice and fire syncStreak() twice.
  const streakClaimInFlightRef = useRef(false);

  const preloadHomeRewardedAd = () => {
    if (!homeRewardAdUnitId || !deviceId) return;
    preloadedHomeAdReadyRef.current = false;
    const ad = RewardedAd.createForAdRequest(homeRewardAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED`
      }
    });
    const unsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      preloadedHomeAdRef.current = ad;
      preloadedHomeAdReadyRef.current = true;
      unsub();
    });
    ad.load();
  };

  const triggerHomeRewardedAd = () => {
    if (isAdPenalized()) {
      Alert.alert('Slow down a bit', formatAdPenaltyMessage(getAdPenaltyRemainingSeconds()));
      return;
    }
    if (!homeRewardAdUnitId) {
      showToast('Ad not available, try again later.', 'info');
      return;
    }
    if (!canWatchAd()) {
      Alert.alert('Daily limit reached', "You've reached your daily ad limit. Come back tomorrow!");
      return;
    }
    if (isAdPlaying) return;

    setAdPlaying(true);
    const sessionId = `home-reward-${Date.now()}`;
    reportAdEvent({
      placementKey: 'home_sponsored_card',
      adType: 'REWARDED',
      eventType: 'REQUESTED',
      screen: 'HOME',
      sessionId,
    });

    const ad =
      preloadedHomeAdReadyRef.current && preloadedHomeAdRef.current
        ? preloadedHomeAdRef.current
        : RewardedAd.createForAdRequest(homeRewardAdUnitId, {
            requestNonPersonalizedAdsOnly: true,
            serverSideVerificationOptions: {
              customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED`
            }
          });
    const wasPreloaded = preloadedHomeAdReadyRef.current;
    preloadedHomeAdRef.current = null;
    preloadedHomeAdReadyRef.current = false;

    const showAd = () => {
      reportAdEvent({
        placementKey: 'home_sponsored_card',
        adType: 'REWARDED',
        eventType: 'LOADED',
        screen: 'HOME',
        sessionId,
      });
      ad.show();
    };

    const u1 = ad.addAdEventListener(RewardedAdEventType.LOADED, showAd);
    const u2 = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
      try {
        // SSV handles the actual DB update. Optimistic UI update here.
        updateBalance(rewardedCoinAmount);
        incrementAdCount();
        trackEvent('AD_WATCHED', 1);
        setCoinRain({ visible: true, amount: rewardedCoinAmount });
        setIsSponsoredCardShattered(true);
        reportAdEvent({
          placementKey: 'home_sponsored_card',
          adType: 'REWARDED',
          eventType: 'EARNED_REWARD',
          screen: 'HOME',
          sessionId,
        });
      } catch {
        showToast('Network issue. Please try again later.', 'info');
      }
    });
    const u3 = ad.addAdEventListener(AdEventType.CLOSED, () => {
      reportAdEventWithPenaltyCheck({
        placementKey: 'home_sponsored_card',
        adType: 'REWARDED',
        eventType: 'DISMISSED',
        screen: 'HOME',
        sessionId,
      });
      setAdPlaying(false);
      u1(); u2(); u3();
      // Mark as claimed for today — persisted across app restarts
      setSponsoredCardClaimedDate(new Date().toISOString().split('T')[0]);
      preloadHomeRewardedAd();
    });
    const u4 = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
      reportAdEvent({
        placementKey: 'home_sponsored_card',
        adType: 'REWARDED',
        eventType: 'FAILED_TO_LOAD',
        screen: 'HOME',
        sessionId,
        errorCode: error?.message,
      });
      setAdPlaying(false);
      showToast('Ad not available right now. Try again later.', 'info');
      u1(); u2(); u3(); u4();
      preloadHomeRewardedAd();
    });

    if (wasPreloaded) { showAd(); } else { ad.load(); }
  };

  const triggerRouletteAd = () => {
    if (isAdPenalized()) {
      Alert.alert('Slow down a bit', formatAdPenaltyMessage(getAdPenaltyRemainingSeconds()));
      return;
    }
    if (!homeRewardAdUnitId) {
      showToast('Ad not available, try again later.', 'info');
      return;
    }
    if (!canWatchAd()) {
      Alert.alert('Daily limit reached', "You've reached your daily ad limit. Come back tomorrow!");
      return;
    }
    if (isAdPlaying || isRouletteAdLoading) return;

    setIsRouletteAdLoading(true);
    setAdPlaying(true);
    const sessionId = `roulette-ad-${Date.now()}`;
    reportAdEvent({
      placementKey: 'roulette_ad',
      adType: 'REWARDED',
      eventType: 'REQUESTED',
      screen: 'HOME',
      sessionId,
    });

    const ad = RewardedAd.createForAdRequest(homeRewardAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:ROULETTE_AD`
      }
    });
    const wasPreloaded = false;
    preloadedHomeAdReadyRef.current = false; // Intentionally invalidating since we want a fresh one
    preloadedHomeAdRef.current = null;

    const showAd = () => {
      setIsRouletteAdLoading(false);
      reportAdEvent({
        placementKey: 'roulette_ad',
        adType: 'REWARDED',
        eventType: 'LOADED',
        screen: 'HOME',
        sessionId,
      });
      ad.show();
    };

    const u1 = ad.addAdEventListener(RewardedAdEventType.LOADED, showAd);
    let rewardEarnedThisSession = false;

    const u2 = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
      try {
        // SSV handles the DB. Optimistic UI update.
        incrementAdCount();
        trackEvent('AD_WATCHED', 1);
        showToast('You earned 1 extra spin!', 'success');
        rewardEarnedThisSession = true;
        loadData();
        reportAdEvent({
          placementKey: 'roulette_ad',
          adType: 'REWARDED',
          eventType: 'EARNED_REWARD',
          screen: 'HOME',
          sessionId,
        });
      } catch {
        showToast('Network issue. Please try again later.', 'info');
      }
    });
    const u3 = ad.addAdEventListener(AdEventType.CLOSED, () => {
      reportAdEventWithPenaltyCheck({
        placementKey: 'roulette_ad',
        adType: 'REWARDED',
        eventType: 'DISMISSED',
        screen: 'HOME',
        sessionId,
      });
      setAdPlaying(false);
      setIsRouletteAdLoading(false);
      if (rewardEarnedThisSession) { setAutoSpinPending(true); }
      u1(); u2(); u3();
      preloadHomeRewardedAd();
    });
    const u4 = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
      reportAdEvent({
        placementKey: 'roulette_ad',
        adType: 'REWARDED',
        eventType: 'FAILED_TO_LOAD',
        screen: 'HOME',
        sessionId,
        errorCode: error?.message,
      });
      setAdPlaying(false);
      setIsRouletteAdLoading(false);
      showToast('Ad not available right now. Try again later.', 'info');
      u1(); u2(); u3(); u4();
      preloadHomeRewardedAd();
    });

    if (wasPreloaded) { showAd(); } else { ad.load(); }
  };

  const walletBalanceLabel = useContent('wallet.balance_label', 'Current Balance');
  const emptyMissionsText = useContent('home.missions.empty', 'New missions arrive at midnight.');
  const gamesTitle = useContent('home.games.title', 'Play Games');
  const gamesSubtitle = useContent('home.games.subtitle', 'Fast HTML5 arcade games');
  const referralTitle = useContent('home.referral.title', 'Invite & Earn');
  const referralBody = useContent('home.referral.body', "Earn 10% of your friends' withdrawals forever!");
  const referralButton = useContent('home.referral.button', 'Share Code');

  const applyLoadedData = (
    profile: any,
    dailyMissions: any,
    fetchedGames: any,
    rConf: any,
  ) => {
    setBalance(profile?.coins ?? 0);
    setXp(profile?.xp ?? 0);
    setLevel(profile?.level ?? 1);
    setStreak(profile?.streak ?? 0);
    setDailyStats({
      remaining: profile?.dailyAdRemaining ?? 20,
      cap: profile?.dailyAdCap ?? 20,
      todayEarned: profile?.todayCoinsEarned ?? 0,
    });
    setStreakClaimedToday(!!profile?.streakClaimedToday);
    setDailyBonusAvailable(!!profile?.dailyBonusAvailable);
    setConfigValues({
      coinToInrRate: profile?.coinToInrRate ?? profile?.config?.coin_to_inr_rate ?? 0.10,
      minWithdrawalCoins: profile?.minWithdrawalCoins ?? profile?.config?.min_withdrawal_coins ?? 500,
      adRewardedCoins: profile?.config?.ad_rewarded_coins,
      adRewardedInterstitialCoins: profile?.config?.ad_rewarded_interstitial_coins,
      adRewardedDiscoverCoins: profile?.config?.ad_rewarded_discover_coins,
    });
    setMissions(dailyMissions);
    setGames(fetchedGames);
    setRouletteChances(profile?.rouletteChancesRemaining ?? 2);
    if (rConf?.success && Array.isArray(rConf.data) && rConf.data.length > 0) {
      setRouletteConfig(rConf.data);
    }
  };

  const loadData = async (mounted = true) => {
    try {
      if (!mounted) return;
      setError('');
      // Stale-while-revalidate: an instant re-visit to Home (e.g. tab switch)
      // paints last known state immediately instead of a blank shimmer, then
      // silently refreshes in the background.
      const [profile, dailyMissions, fetchedGames, rConf] = await fetchCached(
        'home:dashboard',
        () => Promise.all([
          getProfile(),
          getDailyMissions(),
          fetchGamesFromOrigin(),
          getRouletteConfig(),
        ]),
        {
          ttlMs: 8_000,
          staleMs: 2 * 60_000,
          onStaleData: ([p, dm, fg, rc]) => {
            if (mounted) applyLoadedData(p, dm, fg, rc);
          },
        },
      );
      if (!mounted) return;
      applyLoadedData(profile, dailyMissions, fetchedGames, rConf);
    } catch {
      if (mounted) setError('Network issue. Please try again later.');
    } finally {
      if (mounted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    loadData(mounted);
    getDeviceId().then(id => {
      if (mounted) setDeviceId(id);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // preloadHomeRewardedAd() itself early-returns until homeRewardAdUnitId
    // is also ready — without it in the deps, an ad-placement config that
    // resolves after deviceId (common — it comes from a separate remote
    // config fetch) means this effect never re-fires and the sponsored-card
    // ad is never preloaded for the rest of the session.
    if (deviceId && homeRewardAdUnitId) {
      preloadHomeRewardedAd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, homeRewardAdUnitId]);

  const loadRouletteConfig = async () => {
    try {
      setRouletteConfigLoading(true);
      const rConf = await getRouletteConfig();
      if (rConf?.success && Array.isArray(rConf.data) && rConf.data.length > 0) {
        setRouletteConfig(rConf.data);
      }
    } catch {
      // Silently fail
    } finally {
      setRouletteConfigLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    invalidateCached('home:dashboard');
    loadData();
  };

  // Daily missions have no separate "claim" endpoint — the backend credits
  // the reward automatically the moment telemetry proves the mission
  // complete (see backend/src/routes/telemetry.ts), and that credit is
  // already reflected in the `coins` balance this screen's last loadData()
  // fetched. So this tap must NOT call updateBalance() again — doing so
  // double-counts the reward in the client's optimistic balance, which then
  // silently "reverts" the moment the next refresh pulls the true
  // (already-correct, not-doubled) server balance. This is purely an
  // acknowledge-and-hide-the-button UI action.
  const handleClaimReward = (missionId: string | number) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id === missionId) {
          const reward = m.rewardCoins ?? m.reward ?? 0;
          showToast(<View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{color: '#fff', fontSize: 14}}>Claimed {reward} </Text><VIBIcon size={14} /><Text style={{color: '#fff', fontSize: 14}}>!</Text></View>, 'success');
          return { ...m, claimed: true };
        }
        return m;
      })
    );
  };

  const displayedMissions = useMemo(() => {
    return [...missions]
      .sort((a, b) => {
        const aFeatured = a.tags?.includes('FEATURED') ? 1 : 0;
        const bFeatured = b.tags?.includes('FEATURED') ? 1 : 0;
        return bFeatured - aFeatured;
      })
      .slice(0, 3);
  }, [missions]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Shimmer width={40} height={40} borderRadius={20} />
            <View style={{ marginLeft: 12 }}>
              <Shimmer width={100} height={16} style={{ marginBottom: 4 }} />
              <Shimmer width={60} height={12} />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Shimmer width={80} height={20} style={{ marginBottom: 4 }} />
            <Shimmer width={50} height={12} />
          </View>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={false}>
          <Shimmer width="100%" height={160} borderRadius={20} style={{ marginBottom: 20 }} />
          <Shimmer width={140} height={16} borderRadius={8} style={{ marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', marginBottom: 20, gap: 12 }}>
            <Shimmer width="48%" height={90} borderRadius={16} />
            <Shimmer width="48%" height={90} borderRadius={16} />
          </View>
          <Shimmer width={100} height={16} borderRadius={8} style={{ marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <Shimmer width={100} height={100} borderRadius={16} />
            <Shimmer width={100} height={100} borderRadius={16} />
            <Shimmer width={100} height={100} borderRadius={16} />
          </View>
          <Shimmer width="100%" height={130} borderRadius={16} style={{ marginBottom: 12 }} />
          <Shimmer width="100%" height={80} borderRadius={16} style={{ marginBottom: 24 }} />
        </ScrollView>
      </View>
    );
  }

  const maxAds = dailyRewardsCap || 20;
  const adsRemaining = Math.max(0, maxAds - (dailyAdsWatched || 0));

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#e75d0b', '#0d0002', '#000000', '#000000']} 
        locations={[0, 0.4, 0.65, 1]}
        style={StyleSheet.absoluteFill} 
      />
      <FallingEmbers />

      <GamePlayerOverlay ref={gamePlayerRef} selectedGame={selectedGame} onExit={() => setSelectedGame(null)} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity
            style={styles.avatarPlaceholder}
            onPress={onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarInitial}>{user?.name?.[0] || 'U'}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.{level || 1}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsInfo}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onOpenNotifications}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Bell color="#FFF" size={18} />
          </TouchableOpacity>
          <View style={styles.balanceRow}>
            <CoinCounter value={coinBalance} size="sm" />
          </View>
          <View style={styles.streakRow}>
            <Flame color="#FF4D1A" size={14} />
            <Text style={styles.streakText}>{streak || 0}</Text>
          </View>
          <View style={styles.xpBarContainer}>
            <View style={[styles.xpBarFill, { width: `${xp % 100}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {error ? (
          <TouchableOpacity style={styles.errorCard} onPress={() => loadData()}>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        {/* Daily Missions Card */}
        <DailyMissionsCard
          missions={displayedMissions}
          onMoreMissions={onOpenDailyMissions}
          onClaimReward={handleClaimReward}
        />

        {/* Streak Widget (Hidden after claiming to reduce cognitive load) */}
        {!streakClaimedToday && (
          <LinearGradient 
            colors={['rgba(255, 77, 26, 0.15)', 'rgba(10, 10, 10, 1)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.streakWidget}
          >
            <Flame color="#FF4D1A" size={28} />
            <View style={styles.streakTextContainer}>
              <Text style={styles.streakWidgetValue}>{streak || 0} Day Streak</Text>
              <Text style={styles.streakWidgetHint}>Keep it up to earn a mystery box!</Text>
            </View>
            <TouchableOpacity
              style={styles.claimStreakBtn}
              onPress={async () => {
                if (streakClaimedToday || streakClaimInFlightRef.current) return;
                streakClaimInFlightRef.current = true;
                try {
                  const result = await syncStreak();
                  if (result?.coinsEarned) updateBalance(result.coinsEarned);
                  if (result?.streak !== undefined) setStreak(result.streak);
                } catch {
                  // Silently continue — streak claimed UI state is enough
                } finally {
                  streakClaimInFlightRef.current = false;
                }
                setStreakClaimedToday(true);
                showToast('Streak bonus claimed!', 'success');
              }}
              accessibilityRole="button"
              accessibilityLabel="Claim streak bonus"
            >
              <Text style={styles.claimStreakText}>Claim</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* Infinite Testimonial Marquee */}
        <View style={{ marginVertical: 12 }}>
          <AutoMarquee />
        </View>

        <View style={styles.horizontalSeparator} />

        {/* Quick Actions Row (Single Line, No Scroll) */}
        <View style={styles.shortcutsRowContainer}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => onNavigate('hot')}>
            <View style={styles.iconGlowBoxSmall}>
              <PlaySquare color="#FF4D1A" size={14} />
            </View>
            <Text style={styles.quickActionTitle} numberOfLines={1}>Shorts</Text>
          </TouchableOpacity>

          <View style={styles.quickActionDivider} />

          <TouchableOpacity style={styles.quickActionCard} onPress={() => onNavigate('discover')}>
            <View style={styles.iconGlowBoxSmall}>
              <Newspaper color="#FF4D1A" size={14} />
            </View>
            <Text style={styles.quickActionTitle} numberOfLines={1}>News</Text>
          </TouchableOpacity>

          <View style={styles.quickActionDivider} />

          <TouchableOpacity style={styles.quickActionCard} onPress={() => onNavigate('rewards')}>
            <View style={styles.iconGlowBoxSmall}>
              <CheckSquare color="#FF4D1A" size={14} />
            </View>
            <Text style={styles.quickActionTitle} numberOfLines={1}>Tasks</Text>
          </TouchableOpacity>

          <View style={styles.quickActionDivider} />

          <TouchableOpacity style={styles.quickActionCard} onPress={() => setShowRouletteModal(true)}>
            <Image source={require('../../assets/wheel.png')} style={styles.quickActionImg} resizeMode="contain" />
            <Text style={styles.quickActionTitle} numberOfLines={1}>Wheel</Text>
          </TouchableOpacity>
        </View>

        {/* Trending Shorts Catalog */}
        <TrendingShortsCatalog
          onVideoPress={(videoId) => {
            if (onOpenShortsWithVideo) {
              onOpenShortsWithVideo(videoId);
            } else {
              onNavigate('hot');
            }
          }}
          onViewMore={() => onNavigate('hot')}
        />

        {/* Store teaser — full catalog lives in the Rewards tab's default Shop page */}
        {storeEnabled && storeProducts.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <SectionHeader title="Store" subtitle="Shop and earn VIB" actionLabel="See all" onActionPress={() => onNavigate('rewards')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {storeProducts.map((product) => (
                <ProductCard key={product.id} product={product} variant="row" onPress={handleStoreProductBuy} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Roulette Wheel Modal removed from scroll view flow */}

        {/* Sponsored Reward Card — shown once per day */}
        {!sponsoredCardClaimed && !isSponsoredCardShattered ? (
          <View style={{ marginBottom: 16 }}>
            <ShatterWrapper
              isShattered={isSponsoredCardShattered}
              onAnimationComplete={() => {
                setSponsoredCardClaimedDate(new Date().toISOString().split('T')[0]);
              }}
              width={Dimensions.get('window').width - 32}
              height={90}
              glassColor="rgba(255, 77, 26, 0.8)"
            >
              <RewardCard coins={rewardedCoinAmount} onWatch={triggerHomeRewardedAd} />
            </ShatterWrapper>
          </View>
        ) : sponsoredCardClaimed ? (
          <View style={{ marginBottom: 16 }}>
            <RewardCard coins={rewardedCoinAmount} onWatch={() => {}} claimed />
          </View>
        ) : null}

        <CoinRain
          visible={coinRain.visible}
          amount={coinRain.amount}
          onComplete={() => setCoinRain({ visible: false, amount: 0 })}
        />

        {/* Games Section */}
        <View style={styles.gamesSection}>
          <SectionHeader title={gamesTitle} subtitle={gamesSubtitle} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {games.slice(0, 12).map((game: any) => (
              <GameGridCard key={game.id} game={game} onPress={setSelectedGame} />
            ))}
          </View>
          {games.length === 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{ width: '48%', height: 160, marginBottom: 16 }}>
                  <Shimmer width="100%" height="100%" borderRadius={16} />
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={styles.moreGamesBtn}
            onPress={onOpenGames}
          >
            <Text style={styles.moreGamesBtnText}>Play More Games</Text>
          </TouchableOpacity>
        </View>

        {/* Referral Banner */}
        <View style={styles.referralBanner}>
          <Text style={styles.referralTitle}>{referralTitle}</Text>
          <Text style={styles.referralBody}>{referralBody}</Text>
          <TouchableOpacity
            style={styles.referralButton}
            onPress={() => onNavigate('rewards')}
          >
            <Text style={styles.referralButtonText}>{referralButton}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Lucky Wheel Modal */}
      {showRouletteModal && (
        <View style={styles.modalOverlay}>
          <LinearGradient 
            colors={['rgba(231,93,11,0.95)', 'rgba(13,0,2,0.98)']} 
            style={StyleSheet.absoluteFill} 
          />
          <TouchableOpacity 
            style={styles.modalCloseBtn}
            onPress={() => setShowRouletteModal(false)}
          >
            <X color="#FFF" size={24} />
          </TouchableOpacity>
          <View style={styles.modalContent}>
            {rouletteConfig.length > 0 && (rouletteChances > 0 || canWatchAd()) ? (
              <RouletteWheel
                chances={rouletteChances}
                config={rouletteConfig}
                isAdPlaying={isAdPlaying}
                isAdPenalized={isAdPenalized()}
                adPenaltyMessage={formatAdPenaltyMessage(getAdPenaltyRemainingSeconds())}
                isAdLoading={isRouletteAdLoading}
                onWatchAd={triggerRouletteAd}
                autoSpinPending={autoSpinPending}
                onAutoSpinConsumed={() => setAutoSpinPending(false)}
                onSpinSuccess={async (xpEarned, slice) => {
                  // Roulette is a chance-based mechanic — its reward is XP only,
                  // never real/withdrawable VIB, so this must never touch
                  // coinBalance or show coin iconography (CoinRain is VIB-branded).
                  // See claimRouletteSpin on the backend for the compliance note.
                  if (xpEarned > 0) {
                    setXp(useAppStore.getState().xp + xpEarned);
                  }
                  if (slice.popupType === 'CONGRATULATION' || slice.popupType === 'WINNING') {
                    setWonXpAmount(xpEarned);
                    setShowRedemptionSuccess(true);
                    setShowRouletteModal(false);
                    } else {
                    showToast(
                      xpEarned > 0 ? `You won ${xpEarned} XP!` : 'Better luck next time!',
                      xpEarned > 0 ? 'success' : 'info'
                    );
                  }
                  loadData();
                }}
              />
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: '#fff', marginBottom: 16, fontSize: 15, textAlign: 'center' }}>
                  {rouletteConfigLoading ? 'Loading wheel...' : 'Wheel not available right now.'}
                </Text>
                {!rouletteConfigLoading && (
                  <TouchableOpacity
                    style={{ backgroundColor: '#FFD700', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 }}
                    onPress={loadRouletteConfig}
                  >
                    <Text style={{ color: '#000', fontWeight: '800' }}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {showRedemptionSuccess && (
        <RedemptionSuccessScreen
          itemName="Roulette Prize"
          coinsSpent={0}
          title={wonXpAmount > 0 ? "Congratulations!" : "Better luck next time!"}
          detail={wonXpAmount > 0 ? <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>You won {wonXpAmount} XP</Text> : undefined}
          onDone={() => setShowRedemptionSuccess(false)}
        />
      )}
    </View>
  );
}));

HomeScreen.displayName = 'HomeScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  errorCard: {
    backgroundColor: 'rgba(255,77,26,0.12)',
    borderColor: '#FF4D1A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: '#FFF', fontSize: 13 },
  retryText: { color: '#FFD700', fontWeight: '700', marginTop: 6, fontSize: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  levelBadge: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  levelText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsInfo: {
    alignItems: 'flex-end',
  },
  notificationButton: {
    position: 'absolute',
    right: 76,
    top: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  streakText: {
    color: '#FF4D1A',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  xpBarContainer: {
    width: 60,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Streak Widget
  streakWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 77, 26, 0.4)',
  },
  streakTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  streakWidgetValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  streakWidgetHint: {
    color: '#A296BA',
    fontSize: 12,
    marginTop: 2,
  },
  claimStreakBtn: {
    backgroundColor: '#FF4D1A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  claimStreakBtnDone: {
    backgroundColor: 'rgba(255, 77, 26, 0.2)',
  },
  claimStreakText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Stats strip
  statsStrip: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 2,
  },
  summarySubtext: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  // Quick Actions Row
  shortcutsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionImg: {
    width: 24,
    height: 24,
    marginRight: 6,
  },
  iconGlowBoxSmall: {
    width: 24,
    height: 24,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 77, 26, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 26, 0.3)',
  },
  quickActionTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  quickActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 6,
    alignSelf: 'center',
  },
  horizontalSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  // Games
  gamesSection: {
    marginBottom: 24,
  },
  moreGamesBtn: {
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  moreGamesBtnText: {
    color: '#FFF',
    fontWeight: '800',
  },
  // Referral
  referralBanner: {
    backgroundColor: '#FF4D1A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  referralTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  referralBody: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  referralButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  referralButtonText: {
    color: '#FF4D1A',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
