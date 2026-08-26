import { useShallow } from 'zustand/react/shallow';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions, FlatList, ViewToken, Platform, Text, Pressable, Alert, ActivityIndicator, Animated, AppState, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerHaptic } from '../../utils/haptics';
import { ShortItem, type ShortData } from './ShortItem';
import { fetchShorts } from '../../api/shorts';
import { useAppStore } from '../../store/useAppStore';
import { useConfigStore } from '../../store/useConfigStore';
import { RewardedInterstitialAd, RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { claimAdReward } from '../../api/rewards';
import CoinRain from '../ui/CoinRain';
import { useAdPlacement, isAdPenalized, getAdPenaltyRemainingSeconds } from '../../hooks/useAdPlacement';
import { reportAdEvent } from '../../api/config';
import { reportAdEventWithPenaltyCheck, formatAdPenaltyMessage } from '../../utils/adFarmingGuard';
import { useAdUnitId } from '../../hooks/useAdUnitId';
import { getDeviceId } from '../../utils/deviceSafety';
import { ShatterWrapper } from '../ui/ShatterWrapper';
import { VIBIcon } from '../ui/VIBIcon';
import { MOTION } from '../../constants/theme';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

// ── ShortsFeedShimmer ─────────────────────────────────────────────────────────
// Shows animated shimmer placeholder cards while the initial shorts feed loads.
function ShortsFeedShimmer({ width, height }: { width: number; height: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const shimmerOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* Full-screen thumbnail shimmer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#1A1A1A', opacity: shimmerOpacity },
        ]}
      />
      {/* Bottom info strip shimmer */}
      <View style={{ position: 'absolute', bottom: 100, left: 16, right: 80, gap: 8 }}>
        <Animated.View style={{ width: '60%', height: 16, borderRadius: 8, backgroundColor: '#2A2A2A', opacity: shimmerOpacity }} />
        <Animated.View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: '#2A2A2A', opacity: shimmerOpacity }} />
        <Animated.View style={{ width: '30%', height: 12, borderRadius: 6, backgroundColor: '#2A2A2A', opacity: shimmerOpacity }} />
      </View>
      {/* Right rail shimmer (shows structure without the actual buttons) */}
      <View style={{ position: 'absolute', right: 12, bottom: 120, gap: 20 }}>
        <Animated.View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#2A2A2A', opacity: shimmerOpacity }} />
        <Animated.View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#2A2A2A', opacity: shimmerOpacity }} />
      </View>
    </View>
  );
}

export function ShortsFeed({ startVideoId, onVideoStarted, onBack }: { startVideoId?: string | null; onVideoStarted?: () => void; onBack?: () => void } = {}) {
  const insets = useSafeAreaInsets();
  const { isAdPlaying, setAdPlaying, canWatchAd, incrementAdCount, updateBalance, trackEvent } = useAppStore(useShallow(s => ({ isAdPlaying: s.isAdPlaying, setAdPlaying: s.setAdPlaying, canWatchAd: s.canWatchAd, incrementAdCount: s.incrementAdCount, updateBalance: s.updateBalance, trackEvent: s.trackEvent })));
  
  const { config: interstitialPlacement, canShow: canShowInterstitial, recordShown: recordIntShown } = useAdPlacement('shorts_feed_interstitial');
  const { config: rewardedPlacement, canShow: canShowRewarded, recordShown: recordRevShown } = useAdPlacement('shorts_feed_rewarded_card');
  // Fix: use REWARDED_INTERSTITIAL not REWARDED_INTERSTITIAL_SHORTS — must match backend AD_UNIT_KEY_LOOKUP
  const adUnitInterstitial = useAdUnitId(interstitialPlacement?.adUnitKey ?? 'REWARDED_INTERSTITIAL', TestIds.REWARDED_INTERSTITIAL);
  const adUnitVideo = useAdUnitId(rewardedPlacement?.adUnitKey ?? 'REWARDED', TestIds.REWARDED);
  const rewardedCoins = useConfigStore(s => s.adRewardRules['REWARDED']?.coinsAwarded ?? 100);

  // Pre-loaded ads for instant display (eliminates 10s+ load delay)
  const preloadedInterstitialRef = useRef<RewardedInterstitialAd | null>(null);
  const preloadedRewardedRef = useRef<RewardedAd | null>(null);
  const preloadedInterstitialReadyRef = useRef(false);
  const preloadedRewardedReadyRef = useRef(false);
  
  const [items, setItems] = useState<ShortData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Explicit loading — shimmer always shows on first open
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [uiLocked, setUiLocked] = useState(false);
  const [coinRain, setCoinRain] = useState({ visible: false, amount: 0 });
  const [loadingAdId, setLoadingAdId] = useState<string | null>(null);
  const [shatteringAdId, setShatteringAdId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const itemsSinceLastAd = useRef(0);
  // Client-side seen video tracking — prevents same videos from reshowing this session
  const seenVideoIds = useRef<Set<string>>(new Set());
  
  // Single shared scale value for the "Watch & Earn" opt-in CTA — only one such
  // card is ever active/interactive at a time, so one Animated.Value suffices.
  const optInScale = useRef(new Animated.Value(1)).current;
  const onOptInPressIn = () => {
    Animated.spring(optInScale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  const onOptInPressOut = () => {
    Animated.spring(optInScale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };

  const flatListRef = useRef<FlatList<ShortData>>(null);
  const prevActiveRef = useRef(0);
  const isScrollingRef = useRef(false);
  const interstitialRef = useRef<RewardedInterstitialAd | null>(null);
  const nextAdTargetRef = useRef<'INTERSTITIAL' | 'REWARDED'>('INTERSTITIAL');

  // Intercept app state to cancel ad rewards if backgrounded mid-ad
  const appStateRef = useRef(AppState.currentState);
  const adAbortedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (isAdPlaying && state === 'background') {
        adAbortedRef.current = true;
      }
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, [isAdPlaying]);

  const bottomNavHeight = 76 + insets.bottom;
  const feedHeight = windowHeight - insets.top - bottomNavHeight;

  const loadData = async (isLoadMore = false) => {
    if (isLoadMore && (!cursor || fetchingMore)) return;
    try {
      if (isLoadMore) setFetchingMore(true);
      else setIsLoading(true);
      // Pass seen video IDs to backend to avoid reshowing same videos this session
      const excludeIds = isLoadMore ? Array.from(seenVideoIds.current) : [];
      const res = await fetchShorts(isLoadMore ? cursor! : undefined, 10, excludeIds);
      
      let fetchedItems: ShortData[] = res.data.map((item: any) => ({
        id: item.videoId,
        username: 'Creator',
        avatar: 'https://via.placeholder.com/100',
        caption: item.title || 'Amazing short video!',
        sound: 'Original Sound',
        likes: 0,
        comments: 0,
        coins: 0,
        type: 'NORMAL'
      }));

      // Ad Injection
      if (fetchedItems.length > 0) {
        const totalItems = items.length + fetchedItems.length;
        itemsSinceLastAd.current += fetchedItems.length;
        
        const tryShowInterstitial = () => {
          if (canShowInterstitial(itemsSinceLastAd.current, totalItems)) {
            fetchedItems.splice(fetchedItems.length - 1, 0, {
              id: `ad_rit_${Math.random().toString(36).substring(7)}`,
              username: '', avatar: '', caption: '', sound: '', likes: 0, comments: 0, coins: 0,
              type: 'REWARDED_INTERSTITIAL_TRIGGER'
            });
            recordIntShown();
            itemsSinceLastAd.current = 0;
            nextAdTargetRef.current = 'REWARDED';
            return true;
          }
          return false;
        };

        const tryShowRewarded = () => {
          if (canShowRewarded(itemsSinceLastAd.current, totalItems)) {
            fetchedItems.splice(Math.floor(fetchedItems.length / 2), 0, {
              id: `ad_rv_${Math.random().toString(36).substring(7)}`,
              username: '', avatar: '', caption: '', sound: '', likes: 0, comments: 0, coins: rewardedCoins,
              type: 'REWARDED_VIDEO_CARD'
            });
            recordRevShown();
            itemsSinceLastAd.current = 0;
            nextAdTargetRef.current = 'INTERSTITIAL';
            return true;
          }
          return false;
        };

        if (nextAdTargetRef.current === 'INTERSTITIAL') {
          if (!tryShowInterstitial()) tryShowRewarded();
        } else {
          if (!tryShowRewarded()) tryShowInterstitial();
        }
      }

      setItems(prev => isLoadMore ? [...prev, ...fetchedItems] : fetchedItems);
      setCursor(res.nextCursor);

      // If we have a startVideoId, scroll to it on initial load
      if (!isLoadMore && startVideoId) {
        const idx = fetchedItems.findIndex(
          (item) => item.id === startVideoId || item.id?.toString() === startVideoId
        );
        if (idx >= 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: idx, animated: false });
            if (onVideoStarted) onVideoStarted();
          }, 300);
        } else if (onVideoStarted) {
          onVideoStarted();
        }
      }
    } catch {
      // Never show developer error details to users
    } finally {
      setFetchingMore(false);
      setIsLoading(false); // Always clear loading state after first fetch
    }
  };

  useEffect(() => {
    loadData();
    getDeviceId().then(setDeviceId).catch(() => {});
  }, []);

  useEffect(() => {
    if (deviceId) {
      if (adUnitInterstitial) preloadInterstitialAd();
      if (adUnitVideo) preloadRewardedAd();
    }
  }, [deviceId, adUnitInterstitial, adUnitVideo]);

  // ── Pre-loading helpers ──────────────────────────────────
  // Background pre-load — runs silently; when user triggers an ad the
  // pre-loaded instance shows instantly instead of waiting 10+ seconds.
  const preloadInterstitialAd = () => {
    if (!adUnitInterstitial) return;
    preloadedInterstitialReadyRef.current = false;
    const ad = RewardedInterstitialAd.createForAdRequest(adUnitInterstitial, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED_INTERSTITIAL`
      }
    });
    const unsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      preloadedInterstitialRef.current = ad;
      preloadedInterstitialReadyRef.current = true;
      unsub();
    });
    ad.load();
  };

  const preloadRewardedAd = () => {
    if (!adUnitVideo) return;
    preloadedRewardedReadyRef.current = false;
    const ad = RewardedAd.createForAdRequest(adUnitVideo, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED`
      }
    });
    const unsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      preloadedRewardedRef.current = ad;
      preloadedRewardedReadyRef.current = true;
      unsub();
    });
    ad.load();
  };

  const triggerPostAdLockout = () => {
    setUiLocked(true);
    setTimeout(() => setUiLocked(false), 1500);
  };

  const handleInterstitialTrigger = (adCardId: string) => {
    if (!preloadedInterstitialReadyRef.current) {
      // No pre-loaded ad ready — silently skip this card
      setItems(prev => prev.filter(i => i.id !== adCardId));
      preloadInterstitialAd();
      return;
    }

    if (!adUnitInterstitial || !canWatchAd() || isAdPlaying || isScrollingRef.current) return;
    if (isAdPenalized()) {
      triggerHaptic('warning');
      Alert.alert('Slow down a bit', formatAdPenaltyMessage(getAdPenaltyRemainingSeconds()));
      return;
    }
    
    setAdPlaying(true);
    adAbortedRef.current = false;
    const sessionId = `shorts-int-${Date.now()}`;
    
    reportAdEvent({
      placementKey: 'shorts_feed_interstitial',
      adType: 'REWARDED_INTERSTITIAL',
      eventType: 'REQUESTED',
      screen: 'SHORTS',
      sessionId,
    });

    // Use pre-loaded ad if ready for instant display, otherwise load fresh
    const rewardedInt = preloadedInterstitialReadyRef.current && preloadedInterstitialRef.current
      ? preloadedInterstitialRef.current
      : RewardedInterstitialAd.createForAdRequest(adUnitInterstitial, { 
          requestNonPersonalizedAdsOnly: true,
          serverSideVerificationOptions: {
            customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED_INTERSTITIAL`
          }
        });
    
    preloadedInterstitialRef.current = null;
    preloadedInterstitialReadyRef.current = false;

    const showAd = () => {
      reportAdEvent({ placementKey: 'shorts_feed_interstitial', adType: 'REWARDED_INTERSTITIAL', eventType: 'LOADED', screen: 'SHORTS', sessionId });
      rewardedInt.show();
    };

    const unsubscribeLoaded = rewardedInt.addAdEventListener(RewardedAdEventType.LOADED, showAd);

    const unsubscribeEarned = rewardedInt.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
      if (!adAbortedRef.current) {
        try {
          // SSV handles DB. Optimistic UI update.
          const rewardedCoinsInt = useConfigStore.getState().adRewardRules['REWARDED_INTERSTITIAL']?.coinsAwarded ?? 50;
          updateBalance(rewardedCoinsInt);
          incrementAdCount();
          trackEvent('ADS_WATCHED_SHORTS', 1);
          trackEvent('AD_WATCHED', 1);
          setCoinRain({ visible: true, amount: rewardedCoinsInt });
          triggerHaptic('success', 'haptics_ad_reward');
          reportAdEvent({ placementKey: 'shorts_feed_interstitial', adType: 'REWARDED_INTERSTITIAL', eventType: 'EARNED_REWARD', screen: 'SHORTS', sessionId });
        } catch {
          // Silently fail — never show backend error details to users
        }
      } else {
        triggerHaptic('error');
        Alert.alert('Reward cancelled', 'Watch the full video without switching apps to earn VIB.');
      }
    });

    const unsubscribeClosed = rewardedInt.addAdEventListener(AdEventType.CLOSED, () => {
      reportAdEventWithPenaltyCheck({ placementKey: 'shorts_feed_interstitial', adType: 'REWARDED_INTERSTITIAL', eventType: 'DISMISSED', screen: 'SHORTS', sessionId });
      setAdPlaying(false);
      triggerPostAdLockout();
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      setShatteringAdId(adCardId);
      // Pre-load next ad immediately after close
      preloadInterstitialAd();
    });

    // If already loaded (pre-loaded), show immediately. Otherwise trigger load.
    if (preloadedInterstitialReadyRef.current) {
      showAd();
    } else {
      rewardedInt.load();
    }
  };

  const handleVideoOptInTrigger = (adCardId: string) => {
    if (!adUnitVideo || !canWatchAd() || isAdPlaying) return;
    if (isAdPenalized()) {
      triggerHaptic('warning');
      Alert.alert('Slow down a bit', formatAdPenaltyMessage(getAdPenaltyRemainingSeconds()));
      return;
    }
    
    setAdPlaying(true);
    setLoadingAdId(adCardId);
    adAbortedRef.current = false;
    const sessionId = `shorts-rv-${Date.now()}`;
    
    reportAdEvent({ placementKey: 'shorts_feed_rewarded_card', adType: 'REWARDED', eventType: 'REQUESTED', screen: 'SHORTS', sessionId });

    // Use pre-loaded ad if ready for instant display
    const rewarded = preloadedRewardedReadyRef.current && preloadedRewardedRef.current
      ? preloadedRewardedRef.current
      : RewardedAd.createForAdRequest(adUnitVideo, { 
          requestNonPersonalizedAdsOnly: true,
          serverSideVerificationOptions: {
            customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED`
          }
        });

    const wasPreloaded = preloadedRewardedReadyRef.current;
    preloadedRewardedRef.current = null;
    preloadedRewardedReadyRef.current = false;

    const showAd = () => {
      reportAdEvent({ placementKey: 'shorts_feed_rewarded_card', adType: 'REWARDED', eventType: 'LOADED', screen: 'SHORTS', sessionId });
      rewarded.show();
    };

    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, showAd);

    const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
      if (!adAbortedRef.current) {
        try {
          // SSV handles DB. Optimistic UI update.
          updateBalance(rewardedCoins);
          incrementAdCount();
          trackEvent('ADS_WATCHED_SHORTS', 1);
          trackEvent('AD_WATCHED', 1);
          setCoinRain({ visible: true, amount: rewardedCoins });
          triggerHaptic('success', 'haptics_ad_reward');
          reportAdEvent({ placementKey: 'shorts_feed_rewarded_card', adType: 'REWARDED', eventType: 'EARNED_REWARD', screen: 'SHORTS', sessionId });
        } catch {
          // Silently fail — never show backend error details to users
        }
      } else {
        triggerHaptic('error');
        Alert.alert('Reward cancelled', 'Watch the full video without switching apps to earn VIB.');
      }
    });

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      reportAdEventWithPenaltyCheck({ placementKey: 'shorts_feed_rewarded_card', adType: 'REWARDED', eventType: 'DISMISSED', screen: 'SHORTS', sessionId });
      setAdPlaying(false);
      triggerPostAdLockout();
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      setLoadingAdId(null);
      setShatteringAdId(adCardId);
      // Pre-load next ad immediately after close
      preloadRewardedAd();
    });

    if (wasPreloaded) {
      showAd();
    } else {
      rewarded.load();
    }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const index = viewableItems[0].index;
      if (index !== prevActiveRef.current) {
        triggerHaptic('selection', 'haptics_navigation');
        trackEvent('SHORTS_WATCHED', 1);
        prevActiveRef.current = index;
        // Track seen video IDs for exclusion on next fetch
        const viewedItem = items[index];
        if (viewedItem && viewedItem.type === 'NORMAL') {
          seenVideoIds.current.add(viewedItem.id);
        }
      }
      setActiveIndex(index);
      if (index >= items.length - 3) {
        loadData(true);
      }
    }
  }, [items.length, cursor, fetchingMore]);

  // Handle interstitial triggers safely only on scroll end
  const onMomentumScrollEnd = useCallback(() => {
    isScrollingRef.current = false;
    const activeItem = items[activeIndex];
    if (activeItem?.type === 'REWARDED_INTERSTITIAL_TRIGGER') {
      // Small timeout to allow UI to settle before ad popup
      setTimeout(() => handleInterstitialTrigger(activeItem.id), 300);
    }
  }, [activeIndex, items]);

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), []);
  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: feedHeight, offset: feedHeight * index, index,
  }), [feedHeight]);

  const renderItem = useCallback(({ item, index }: { item: ShortData; index: number }) => {
    const isActive = index === activeIndex;
    const isPreload = !isActive && Math.abs(index - activeIndex) <= 1;
    
    return (
      <ShatterWrapper
        isShattered={shatteringAdId === item.id}
        onAnimationComplete={() => {
          setItems(prev => prev.filter(i => i.id !== item.id));
          if (shatteringAdId === item.id) setShatteringAdId(null);
        }}
        width={windowWidth}
        height={feedHeight}
        glassColor="#1A1A2E"
      >
        <View style={{ width: windowWidth, height: feedHeight }}>
          <ShortItem
            data={item}
            isActive={isActive}
            isPreload={isPreload}
            playerHeight={feedHeight}
            playerWidth={windowWidth}
          />
          {item.type === 'REWARDED_VIDEO_CARD' && isActive && (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 120 }]} pointerEvents="box-none">
              <Animated.View style={{ transform: [{ scale: optInScale }] }}>
                <Pressable
                  style={[styles.optInButton, (uiLocked || loadingAdId === item.id) && { opacity: 0.5, backgroundColor: '#333' }]}
                  onPress={() => handleVideoOptInTrigger(item.id)}
                  onPressIn={onOptInPressIn}
                  onPressOut={onOptInPressOut}
                  disabled={uiLocked || isAdPlaying || loadingAdId === item.id}
                >
                  {loadingAdId === item.id ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color="#FFD700" />
                      <Text style={[styles.optInText, { color: '#FFD700' }]}>Loading Ad...</Text>
                    </View>
                  ) : (
                    <Text style={styles.optInText}>Watch & Earn {item.coins} <VIBIcon size={18} style={{ transform: [{ translateY: 3 }] }} /></Text>
                  )}
                </Pressable>
              </Animated.View>
            </View>
          )}
        </View>
      </ShatterWrapper>
    );
  }, [activeIndex, feedHeight, uiLocked, isAdPlaying]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ width: windowWidth, height: feedHeight }}>
        {isLoading ? (
          <ShortsFeedShimmer width={windowWidth} height={feedHeight} />
        ) : items.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>No videos available.</Text>
            <Pressable
              style={({ pressed }) => [styles.optInButton, pressed && { opacity: 0.75 }]}
              onPress={() => loadData()}
            >
              <Text style={styles.optInText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            extraData={`${activeIndex}_${uiLocked}_${items[activeIndex]?.type}`}
            scrollEnabled={items[activeIndex]?.type !== 'REWARDED_INTERSTITIAL_TRIGGER'}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollBeginDrag={() => { isScrollingRef.current = true; }}
            onMomentumScrollEnd={onMomentumScrollEnd}
            initialNumToRender={5}
            windowSize={7}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === 'android'}
            getItemLayout={getItemLayout}
            style={{ flex: 1 }}
          />
        )}
      </View>
      <CoinRain visible={coinRain.visible} amount={coinRain.amount} onComplete={() => setCoinRain({ visible: false, amount: 0 })} />
      {onBack && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: Math.max(insets.top, 40) + 10,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{'<'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  optInButton: {
    backgroundColor: '#FFD700', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 28,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  optInText: { color: '#000', fontSize: 18, fontWeight: 'bold' }
});
