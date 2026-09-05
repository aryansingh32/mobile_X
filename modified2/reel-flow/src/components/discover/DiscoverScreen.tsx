import { useShallow } from 'zustand/react/shallow';
import axios from 'axios';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, AppState, Image, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchNews, fetchNewsFilters } from '../../api/news';
import { DiscoverCard, CardLayout, ITEM_SIZE, CARD_HEIGHT, ITEM_SPACING } from './DiscoverCard';
import { DiscoverDetail } from './DiscoverDetail';
import { ShimmerCard } from '../ui/Shimmer';
import { useAppStore } from '../../store/useAppStore';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { getCardColor, getRandomAdColor } from '../../hooks/useImageColor';
import { triggerHaptic } from '../../utils/haptics';
import CoinRain from '../ui/CoinRain';
import { useAdPlacement, isAdPenalized, getAdPenaltyRemainingSeconds } from '../../hooks/useAdPlacement';
import { useConfigStore } from '../../store/useConfigStore';
import { useContent } from '../../hooks/useContent';
import { reportAdEvent } from '../../api/config';
import { reportAdEventWithPenaltyCheck, formatAdPenaltyMessage } from '../../utils/adFarmingGuard';
import { useAdUnitId } from '../../hooks/useAdUnitId';
import { getDeviceId } from '../../utils/deviceSafety';
import { fetchCached } from '../../utils/requestCache';

const { height: windowHeight } = Dimensions.get('window');
const OFFSET = (windowHeight - CARD_HEIGHT) / 3;

const getSourceAvatar = (sourceName: string) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(sourceName)}&background=random&color=fff&size=100`;
};

export const DiscoverScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isAdPlaying, setAdPlaying, canWatchAd, incrementAdCount, updateBalance, todayCoinsEarned, trackEvent } = useAppStore(useShallow(s => ({ isAdPlaying: s.isAdPlaying, setAdPlaying: s.setAdPlaying, canWatchAd: s.canWatchAd, incrementAdCount: s.incrementAdCount, updateBalance: s.updateBalance, todayCoinsEarned: s.todayCoinsEarned, trackEvent: s.trackEvent })));
  const { config: adPlacement, canShow, recordShown } = useAdPlacement('discover_feed_sponsored_card');
  const adUnitId = useAdUnitId(adPlacement?.adUnitKey ?? 'REWARDED_DISCOVER', TestIds.REWARDED);
  const discoverCoins = useConfigStore(s => s.adRewardRules['REWARDED_DISCOVER']?.coinsAwarded ?? 50);

  const titleString = useContent('discover.title', 'Discover');
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState('');
  
  const [categories, setCategories] = useState<{name: string, imageUrl?: string}[]>([]);
  const [sources, setSources] = useState<{name: string, imageUrl?: string}[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);
  const [coinRain, setCoinRain] = useState({ visible: false, amount: 0 });
  const [loadingAdId, setLoadingAdId] = useState<string | null>(null);
  const [shatteringAdId, setShatteringAdId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const itemsSinceLastAd = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pre-loaded rewarded ad for instant display (avoids 10s+ load delay)
  const preloadedRewardedRef = useRef<any>(null);
  const preloadedRewardedReadyRef = useRef(false);

  const preloadRewardedAd = () => {
    if (!adUnitId) return;
    preloadedRewardedReadyRef.current = false;
    const ad = RewardedAd.createForAdRequest(adUnitId, { 
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED_DISCOVER`
      }
    });
    const unsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      preloadedRewardedRef.current = ad;
      preloadedRewardedReadyRef.current = true;
      unsub();
    });
    ad.load();
  };

  // Track watched ad card IDs so we can remove them
  const watchedAdIds = useRef<Set<string>>(new Set());

  // Intercept app state to cancel ad rewards if backgrounded mid-ad
  const appStateRef = useRef(AppState.currentState);
  const adAbortedRef = useRef(false);
  // Track which ad card triggered the current rewarded ad
  const currentAdCardId = useRef<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (isAdPlaying && state === 'background') {
        adAbortedRef.current = true;
      }
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, [isAdPlaying]);

  const loadData = async (isLoadMore = false, catOverride?: string | null, srcOverride?: string | null) => {
    if (isLoadMore && (!cursor || fetchingMore)) return;
    // Cancel whatever's still in flight (e.g. a filter change superseding
    // the previous page fetch) before starting a new one.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      setError('');
      if (isLoadMore) setFetchingMore(true);
      else setLoading(true);

      const currentCategory = catOverride !== undefined ? catOverride : selectedCategory;
      const currentSource = srcOverride !== undefined ? srcOverride : selectedSource;

      const res = await fetchNews(isLoadMore ? cursor! : undefined, 30, currentCategory ?? undefined, currentSource ?? undefined, controller.signal);

      // Map items
      let fetchedItems: any[] = (res?.data || []).map((item: any) => {
        const date = new Date(item.publishedAt || Date.now());
        const diffMs = Date.now() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        let timeAgo = diffHrs > 24 ? `${Math.floor(diffHrs / 24)}d ago` : `${diffHrs}h ago`;
        if (diffHrs === 0) timeAgo = 'Just now';

        const sourceName = item.sourceName || 'News';
        const imageUrl = item.imageUrl || 'https://via.placeholder.com/400';

        return {
          id: item.id.toString(),
          title: item.title,
          description: item.description || '',
          imageUri: imageUrl,
          authorUsername: sourceName,
          authorAvatar: getSourceAvatar(sourceName),
          sourcesCount: 1,
          timeAgo,
          bullets: [],
          bgColor: getCardColor(item.title || item.id.toString()),
          isAd: false,
          sourceUrl: item.sourceUrl || '',
        };
      });

      // Explicitly Preload Images into cache so next/previous cards are ready instantly
      fetchedItems.forEach(item => {
        if (item.imageUri && item.imageUri !== 'https://via.placeholder.com/400') {
          Image.prefetch(item.imageUri).catch(() => {});
        }
      });

      // Ad Injection: Uses remote config parameters
      if (fetchedItems.length > 0) {
        const totalItems = data.length + fetchedItems.length;
        itemsSinceLastAd.current += fetchedItems.length;
        
        // Check if we can show an ad here based on items since last ad and session count
        if (canShow(itemsSinceLastAd.current, totalItems)) {
          fetchedItems.splice(Math.floor(Math.random() * fetchedItems.length), 0, {
            id: `ad_${Date.now()}`,
            isAd: true,
            bgColor: getRandomAdColor(),
            coins: discoverCoins,
          });
          recordShown();
          itemsSinceLastAd.current = 0; // Reset counter after injecting an ad
        }
      }

      setData(prev => {
        const merged = isLoadMore ? [...prev, ...fetchedItems] : fetchedItems;
        // Clean up duplicates (RSS feeds often re-sync the exact same articles)
        const seenTitles = new Set();
        return merged.filter(item => {
          if (item.isAd) return true;
          if (seenTitles.has(item.title)) return false;
          seenTitles.add(item.title);
          return true;
        });
      });
      setCursor(res.nextCursor);
    } catch (error) {
      // Aborted (unmount, or superseded by a newer call, e.g. a filter
      // change) — a newer request already owns state, or there's nothing
      // left to update.
      if (axios.isCancel(error)) return;
      if (isLoadMore) {
        // Pagination error: don't destroy the feed — just show the error state
        // and the footer's retry. The user's existing items remain visible.
      } else {
        setError('Could not load stories.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setFetchingMore(false);
      }
    }
  };

  useEffect(() => {
    // Categories/sources rarely change — instant on remount, revalidates in the background.
    fetchCached('discover:filters', () => fetchNewsFilters(), { ttlMs: 60_000, staleMs: 30 * 60_000 }).then(res => {
      setCategories(res?.categories || []);
      setSources(res?.sources || []);
    }).catch(() => {
      setCategories([]);
      setSources([]);
    }).finally(() => {
      setFiltersLoading(false);
    });
    loadData();
    getDeviceId().then(setDeviceId).catch(() => {});
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (deviceId) {
      preloadRewardedAd();
    }
  }, [deviceId, adUnitId]);

  const onCategoryPress = (cat: string) => {
    const newCat = selectedCategory === cat ? null : cat;
    setSelectedCategory(newCat);
    setCursor(null);
    setData([]);
    loadData(false, newCat, selectedSource);
  };

  const onSourcePress = (src: string) => {
    const newSrc = selectedSource === src ? null : src;
    setSelectedSource(newSrc);
    setCursor(null);
    setData([]);
    loadData(false, selectedCategory, newSrc);
  };

  const triggerRewardedAd = useCallback((adCardId: string) => {
    if (isAdPenalized()) {
      triggerHaptic('warning');
      Alert.alert('Slow down a bit', formatAdPenaltyMessage(getAdPenaltyRemainingSeconds()));
      return;
    }

    if (!adUnitId) {
      triggerHaptic('warning');
      Alert.alert('Ad unavailable', 'Please try again later.');
      return;
    }

    if (!canWatchAd()) {
      triggerHaptic('warning');
      Alert.alert('Daily limit reached', "You've reached your daily ad limit. Come back tomorrow.");
      return;
    }
    if (isAdPlaying) return;

    setAdPlaying(true);
    setLoadingAdId(adCardId);
    adAbortedRef.current = false;
    currentAdCardId.current = adCardId;

    const sessionId = `discover-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    reportAdEvent({
      placementKey: 'discover_feed_sponsored_card',
      adType: 'REWARDED_DISCOVER',
      eventType: 'REQUESTED',
      screen: 'DISCOVER',
      sessionId,
    });

    // Use pre-loaded ad for instant display; fall back to fresh request if not ready
    const rewarded = preloadedRewardedReadyRef.current && preloadedRewardedRef.current
      ? preloadedRewardedRef.current
      : RewardedAd.createForAdRequest(adUnitId, { 
          requestNonPersonalizedAdsOnly: true,
          serverSideVerificationOptions: {
            customData: `${useAppStore.getState().user?.id || 0}:${deviceId || 'null'}:REWARDED_DISCOVER`
          }
        });

    const wasPreloaded = preloadedRewardedReadyRef.current;
    preloadedRewardedRef.current = null;
    preloadedRewardedReadyRef.current = false;

    const showAd = () => {
      reportAdEvent({
        placementKey: 'discover_feed_sponsored_card',
        adType: 'REWARDED_DISCOVER',
        eventType: 'LOADED',
        screen: 'DISCOVER',
        sessionId,
      });
      rewarded.show();
    };

    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, showAd);

    const unsubscribeEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        if (!adAbortedRef.current) {
          // SSV handles backend DB. Optimistic UI update.
          updateBalance(discoverCoins);
          incrementAdCount();
          trackEvent('ADS_WATCHED_DISCOVER', 1);
          trackEvent('AD_WATCHED', 1);
          setCoinRain({ visible: true, amount: discoverCoins });
          triggerHaptic('success', 'haptics_ad_reward');
          
          reportAdEvent({
            placementKey: 'discover_feed_sponsored_card',
            adType: 'REWARDED_DISCOVER',
            eventType: 'EARNED_REWARD',
            screen: 'DISCOVER',
            sessionId,
          });

          if (currentAdCardId.current) watchedAdIds.current.add(currentAdCardId.current);
        } else {
          triggerHaptic('error');
          Alert.alert('Reward cancelled', 'Watch the full video without switching apps to earn VIB.');
        }
      },
    );

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      reportAdEventWithPenaltyCheck({
        placementKey: 'discover_feed_sponsored_card',
        adType: 'REWARDED_DISCOVER',
        eventType: 'DISMISSED',
        screen: 'DISCOVER',
        sessionId,
      });
      setAdPlaying(false);
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();

      // Trigger shatter animation instead of immediate removal
      if (currentAdCardId.current) {
        setShatteringAdId(currentAdCardId.current);
        watchedAdIds.current.delete(currentAdCardId.current);
      }
      currentAdCardId.current = null;
      setLoadingAdId(null);
      // Pre-load the next ad right after close for instant next display
      preloadRewardedAd();
    });

    if (wasPreloaded) {
      showAd();
    } else {
      rewarded.load();
    }
    // preloadRewardedAd is intentionally omitted: it's a plain closure
    // recreated every render, but its behavior is fully determined by
    // adUnitId/deviceId, both already listed below — including it would
    // force a new triggerRewardedAd (and defeat DiscoverCard's memo) every
    // render for no behavioral difference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adUnitId, canWatchAd, isAdPlaying, setAdPlaying, deviceId, discoverCoins, updateBalance, incrementAdCount, trackEvent]);

  const handleCardPress = useCallback((cardData: any, layout: CardLayout) => {
    // Haptic feedback on card press
    triggerHaptic('impact-medium', 'haptics_navigation');

    if (cardData.isAd) {
      triggerRewardedAd(cardData.id);
      return;
    }
    trackEvent('NEWS_READ', 1);
    setSelectedCard(cardData);
    setCardLayout(layout);
  }, [triggerRewardedAd, trackEvent]);

  const handleCloseDetail = () => {
    triggerHaptic('impact-light', 'haptics_navigation');
    setSelectedCard(null);
    setTimeout(() => setCardLayout(null), 300);
  };

  // Every row is a fixed CARD_HEIGHT + ITEM_SPACING (ITEM_SIZE), so this lets
  // FlatList skip a measurement pass per row — same optimization ShortsFeed
  // already applies to its own fixed-height feed.
  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ITEM_SIZE, offset: ITEM_SIZE * index, index,
  }), []);
  const snapToOffsets = useMemo(
    () => data.map((_, i) => i * ITEM_SIZE),
    [data.length]
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>{titleString}</Text>
      </View>

      <View style={[styles.filterSection, { top: insets.top + 60 }]}>
        {filtersLoading ? (
          <View style={styles.shimmerChipsContainer}>
            <View style={styles.shimmerChip} />
            <View style={styles.shimmerChip} />
            <View style={styles.shimmerChip} />
            <View style={styles.shimmerChip} />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
              {categories.map(cat => (
                <TouchableOpacity key={cat.name} style={[styles.chip, selectedCategory === cat.name && styles.chipActive]} onPress={() => onCategoryPress(cat.name)}>
                  {cat.imageUrl && <Image source={{ uri: cat.imageUrl }} style={styles.chipImage} />}
                  <Text style={[styles.chipText, selectedCategory === cat.name && styles.chipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
              {sources.map(src => (
                <TouchableOpacity key={src.name} style={[styles.chip, selectedSource === src.name && styles.chipActive]} onPress={() => onSourcePress(src.name)}>
                  {src.imageUrl && <Image source={{ uri: src.imageUrl }} style={styles.chipImage} />}
                  <Text style={[styles.chipText, selectedSource === src.name && styles.chipTextActive]}>{src.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>
      
      <View style={styles.feedContainer}>
        {error && !loading ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText} onPress={() => loadData()}>Tap to retry</Text>
          </View>
        ) : loading ? (
          <View style={{ marginTop: OFFSET, alignItems: 'center' }}>
            <ShimmerCard style={{ marginBottom: ITEM_SPACING }} />
            <ShimmerCard />
          </View>
        ) : (
          <Animated.FlatList
            data={data}
            keyExtractor={(item) => item.id}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            snapToOffsets={snapToOffsets}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onEndReached={() => loadData(true)}
            onEndReachedThreshold={2.5}
            initialNumToRender={5}
            windowSize={7}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === 'android'}
            getItemLayout={getItemLayout}
            ListHeaderComponent={<View style={{ height: OFFSET }} />}
            ListFooterComponent={
              <View style={{ height: OFFSET, alignItems: 'center', justifyContent: 'flex-start' }}>
                {fetchingMore && <ShimmerCard />}
                {error && data.length > 0 && (
                  <TouchableOpacity
                    style={styles.paginationRetryBtn}
                    onPress={() => loadData(true)}
                  >
                    <Text style={styles.paginationRetryText}>Tap to load more</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={({ item, index }) => (
              <DiscoverCard 
                data={item} 
                index={index} 
                scrollY={scrollY}
                onPress={handleCardPress}
                isLoading={loadingAdId === item.id}
                isShattered={shatteringAdId === item.id}
                onShatterComplete={() => {
                  setData(prev => prev.filter(i => i.id !== item.id));
                  if (shatteringAdId === item.id) setShatteringAdId(null);
                }}
              />
            )}
          />
        )}
      </View>

      {cardLayout && selectedCard && (
        <DiscoverDetail 
          data={selectedCard} 
          layout={cardLayout}
          onClose={handleCloseDetail} 
        />
      )}
      <CoinRain visible={coinRain.visible} amount={coinRain.amount} onComplete={() => setCoinRain({ visible: false, amount: 0 })} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, zIndex: 20,
  },
  title: { color: '#FFF', fontSize: 24, fontWeight: '700', marginLeft: 8 },
  earnedText: { color: '#FFD700', fontSize: 12, fontWeight: '700', marginRight: 8 },
  filterSection: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  chipsContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(34, 34, 34, 0.85)', marginRight: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  chipActive: { backgroundColor: 'rgba(255,215,0,0.1)', borderColor: '#FFD700' },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFD700' },
  chipImage: { width: 18, height: 18, borderRadius: 9, marginRight: 6, backgroundColor: '#333' },
  shimmerChipsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  shimmerChip: { width: 80, height: 35, borderRadius: 20, backgroundColor: 'rgba(34, 34, 34, 0.85)' },
  feedContainer: { flex: 1, position: 'relative', marginTop: 8 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  retryText: { color: '#FFD700', fontWeight: '700' },
  paginationRetryBtn: {
    backgroundColor: 'rgba(255,77,26,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,26,0.4)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  paginationRetryText: {
    color: '#FF4D1A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
