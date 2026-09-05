import { StatusBar } from 'expo-status-bar';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { isRealDevice } from './src/utils/deviceSafety';
import { useAppStore } from './src/store/useAppStore';
import SplashScreen from './src/screens/SplashScreen';
import { RemoteConfigProvider } from './src/providers/RemoteConfigProvider';
import { ScreenFocusProvider } from './src/providers/ScreenFocusContext';
import { useAdPlacement, isAdPenalized } from './src/hooks/useAdPlacement';
import { AppOpenAd, InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { reportAdEvent } from './src/api/config';
import { useAdUnitId } from './src/hooks/useAdUnitId';
import { useFeatureFlag } from './src/hooks/useFeatureFlag';
import { useTelemetry } from './src/hooks/useTelemetry';

// Screens
import BottomNavBar, { TabId } from './src/components/BottomNavBar';
import { HomeScreen, HomeScreenHandle } from './src/screens/HomeScreen';
import { DiscoverScreen } from './src/components/discover/DiscoverScreen';
import { ShortsFeed } from './src/components/shorts/ShortsFeed';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { GamesScreen, GamesScreenHandle } from './src/screens/GamesScreen';
import { TabTooltip } from './src/components/onboarding/TabTooltip';
import { trackActivity, registerFingerprint } from './src/api/user';
import { ToastProvider } from './src/components/ui/Toast';
import { ProfileScreen, ProfileDestination } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { HelpSupportScreen } from './src/screens/HelpSupportScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { AchievementScreen } from './src/screens/AchievementScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ReferEarnScreen } from './src/screens/ReferEarnScreen';
import { DailyMissionsScreen } from './src/screens/DailyMissionsScreen';
import { MaintenanceScreen } from './src/screens/MaintenanceScreen';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { NoInternetScreen } from './src/screens/NoInternetScreen';
import { fetchPublicStatus } from './src/api/config';

type OverlayScreen = ProfileDestination | 'profile';

const TAB_IDS: TabId[] = ['home', 'discover', 'hot', 'rewards', 'wallet'];

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  // Tabs are lazy-mounted on first visit, then kept mounted forever and just
  // hidden (display:none) on subsequent switches — switching tabs used to
  // fully unmount/remount the screen (losing scroll position, local UI
  // state, and re-running every mount-time fetch/shimmer), which is what
  // made navigating between tabs feel like a full page reload each time.
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(['home']));
  const [showGames, setShowGames] = useState(false);
  const [showDailyMissions, setShowDailyMissions] = useState(false);
  const [overlayStack, setOverlayStack] = useState<OverlayScreen[]>([]);
  const [shortsStartVideoId, setShortsStartVideoId] = useState<string | null>(null);
  const pushOverlay = useCallback((screen: OverlayScreen) => setOverlayStack((s) => [...s, screen]), []);
  const popOverlay = useCallback(() => setOverlayStack((s) => s.slice(0, -1)), []);
  const currentOverlay = overlayStack.length ? overlayStack[overlayStack.length - 1] : null;
  const { isAdPlaying, setAdPlaying, canWatchAd } = useAppStore();
  const homeScreenRef = useRef<HomeScreenHandle>(null);
  const gamesScreenRef = useRef<GamesScreenHandle>(null);

  useEffect(() => {
    setMountedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  useTelemetry(); // Initialize background telemetry and screentime heartbeat

  useEffect(() => {
    registerFingerprint().catch(err => console.warn('Fingerprint registration failed:', err));
  }, []);

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      if (showDailyMissions) {
        setShowDailyMissions(false);
        return true;
      }
      if (showGames) {
        // If a game is actually open inside GamesScreen, let it run its own
        // ad-gated exit flow first (same as the in-app back arrow) instead
        // of always closing the whole Games screen in one jump.
        if (gamesScreenRef.current?.handleBack()) return true;
        setShowGames(false);
        return true;
      }
      if (activeTab === 'home' && homeScreenRef.current?.handleBack()) {
        // Home has its own "quick play" game entry point, invisible to the
        // rest of this handler — without this check, hardware-back while
        // such a game was open fell through to "exit the app" instead of
        // closing the game.
        return true;
      }
      if (overlayStack.length > 0) {
        popOverlay();
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // Let Android exit the app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showDailyMissions, showGames, overlayStack, activeTab]);
  
  const { config: navAdConfig, canShow, recordShown } = useAdPlacement('nav_transition_interstitial');
  const { config: appOpenConfig, canShow: canShowAppOpen, recordShown: recordAppOpenShown } = useAdPlacement('app_open');
  const { config: walletAdConfig, canShow: canShowWallet, recordShown: recordWalletShown } = useAdPlacement('wallet_interstitial');
  const navAdsEnabled = useFeatureFlag('nav_ads_enabled', true);
  const navInterstitialUnitId = useAdUnitId(navAdConfig?.adUnitKey ?? 'GAME_COMPLETION', TestIds.INTERSTITIAL);
  const appOpenUnitId = useAdUnitId(appOpenConfig?.adUnitKey ?? 'APP_OPEN', TestIds.APP_OPEN);
  const walletAdUnitId = useAdUnitId(walletAdConfig?.adUnitKey ?? 'WALLET_INTERSTITIAL', TestIds.INTERSTITIAL);
  const actionsSinceAd = useRef(0);
  const totalActions = useRef(0);
  const appOpenRequestedRef = useRef(false);
  const lastAppOpenShownRef = useRef(0);
  const MIN_APP_OPEN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Pre-loaded ad references for navigation and wallet interstitials (avoids delay)
  const preloadedNavAdRef = useRef<InterstitialAd | null>(null);
  const preloadedNavReadyRef = useRef(false);
  const preloadedWalletAdRef = useRef<InterstitialAd | null>(null);
  const preloadedWalletReadyRef = useRef(false);
  const preloadedAppOpenAdRef = useRef<AppOpenAd | null>(null);
  const preloadedAppOpenReadyRef = useRef(false);

  const preloadNavAd = useCallback(() => {
    if (!navInterstitialUnitId) return;
    preloadedNavReadyRef.current = false;
    const ad = InterstitialAd.createForAdRequest(navInterstitialUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    const unsub = ad.addAdEventListener(AdEventType.LOADED, () => {
      preloadedNavAdRef.current = ad;
      preloadedNavReadyRef.current = true;
      unsub();
    });
    ad.load();
  }, [navInterstitialUnitId]);

  const preloadWalletAd = useCallback(() => {
    if (!walletAdUnitId) return;
    preloadedWalletReadyRef.current = false;
    const ad = InterstitialAd.createForAdRequest(walletAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    const unsub = ad.addAdEventListener(AdEventType.LOADED, () => {
      preloadedWalletAdRef.current = ad;
      preloadedWalletReadyRef.current = true;
      unsub();
    });
    ad.load();
  }, [walletAdUnitId]);

  useEffect(() => {
    if (navInterstitialUnitId) preloadNavAd();
  }, [navInterstitialUnitId, preloadNavAd]);

  const preloadAppOpenAd = useCallback(() => {
    if (!appOpenUnitId) return;
    preloadedAppOpenReadyRef.current = false;
    const ad = AppOpenAd.createForAdRequest(appOpenUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    const unsub = ad.addAdEventListener(AdEventType.LOADED, () => {
      preloadedAppOpenAdRef.current = ad;
      preloadedAppOpenReadyRef.current = true;
      unsub();
    });
    ad.load();
  }, [appOpenUnitId]);

  useEffect(() => {
    if (appOpenUnitId) preloadAppOpenAd();
  }, [appOpenUnitId, preloadAppOpenAd]);

  useEffect(() => {
    if (walletAdUnitId) preloadWalletAd();
  }, [walletAdUnitId, preloadWalletAd]);

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab === activeTab) return;
    
    actionsSinceAd.current += 1;
    totalActions.current += 1;

    // Check Wallet interstitial when switching to wallet tab
    if (tab === 'wallet' && walletAdUnitId && canWatchAd() && !isAdPlaying && !isAdPenalized() && canShowWallet(1, 1)) {
      setAdPlaying(true);
      const sessionId = `wallet-nav-${Date.now()}`;
      
      reportAdEvent({
        placementKey: 'wallet_interstitial',
        adType: 'INTERSTITIAL',
        eventType: 'REQUESTED',
        screen: 'GLOBAL',
        sessionId,
      });

      if (preloadedWalletReadyRef.current && preloadedWalletAdRef.current) {
        setAdPlaying(true);
        const ad = preloadedWalletAdRef.current;
        preloadedWalletAdRef.current = null;
        preloadedWalletReadyRef.current = false;

        const showAd = () => {
          reportAdEvent({
            placementKey: 'wallet_interstitial',
            adType: 'INTERSTITIAL',
            eventType: 'LOADED', // already loaded but for metrics
            screen: 'GLOBAL',
            sessionId,
          });
          ad.show();
        };

        const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          reportAdEvent({
            placementKey: 'wallet_interstitial',
            adType: 'INTERSTITIAL',
            eventType: 'DISMISSED',
            screen: 'GLOBAL',
            sessionId,
          });
          setAdPlaying(false);
          setActiveTab(tab);
          recordWalletShown();
          unsubscribeClosed();
          preloadWalletAd();
        });

        const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
          reportAdEvent({
            placementKey: 'wallet_interstitial',
            adType: 'INTERSTITIAL',
            eventType: 'FAILED_TO_LOAD',
            screen: 'GLOBAL',
            sessionId,
            errorCode: error?.message,
          });
          setAdPlaying(false);
          setActiveTab(tab);
          unsubscribeClosed();
          unsubscribeError();
        });
        showAd();
      } else {
        // Fallback if ad is not ready: skip ad, go to tab immediately, trigger preload for next time
        preloadWalletAd();
        setActiveTab(tab);
      }
      return;
    }

    // Nav transition interstitial — exempt Shorts tab to avoid interrupting video playback
    if (tab !== 'hot' && navAdsEnabled && navInterstitialUnitId && canWatchAd() && !isAdPlaying && !isAdPenalized() && canShow(actionsSinceAd.current, totalActions.current)) {
      setAdPlaying(true);
      const sessionId = `nav-${Date.now()}`;
      
      reportAdEvent({
        placementKey: 'nav_transition_interstitial',
        adType: 'INTERSTITIAL',
        eventType: 'REQUESTED',
        screen: 'GLOBAL',
        sessionId,
      });

      if (preloadedNavReadyRef.current && preloadedNavAdRef.current) {
        setAdPlaying(true);
        const ad = preloadedNavAdRef.current;
        preloadedNavAdRef.current = null;
        preloadedNavReadyRef.current = false;

        const showAd = () => {
          reportAdEvent({
            placementKey: 'nav_transition_interstitial',
            adType: 'INTERSTITIAL',
            eventType: 'LOADED',
            screen: 'GLOBAL',
            sessionId,
          });
          ad.show();
        };

        const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          reportAdEvent({
            placementKey: 'nav_transition_interstitial',
            adType: 'INTERSTITIAL',
            eventType: 'DISMISSED',
            screen: 'GLOBAL',
            sessionId,
          });
          setAdPlaying(false);
          setActiveTab(tab);
          recordShown();
          actionsSinceAd.current = 0;
          unsubscribeClosed();
          preloadNavAd();
        });

        const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
          reportAdEvent({
            placementKey: 'nav_transition_interstitial',
            adType: 'INTERSTITIAL',
            eventType: 'FAILED_TO_LOAD',
            screen: 'GLOBAL',
            sessionId,
            errorCode: error?.message,
          });
          setAdPlaying(false);
          setActiveTab(tab);
          unsubscribeClosed();
          unsubscribeError();
        });
        
        showAd();
      } else {
        // Fallback: don't block UI if ad not ready, trigger preload and navigate immediately
        preloadNavAd();
        setActiveTab(tab);
      }
    } else {
      setActiveTab(tab);
    }
  }, [
    activeTab,
    walletAdUnitId,
    canWatchAd,
    isAdPlaying,
    canShowWallet,
    setAdPlaying,
    recordWalletShown,
    preloadWalletAd,
    navAdsEnabled,
    navInterstitialUnitId,
    canShow,
    recordShown,
    preloadNavAd,
  ]);

  useEffect(() => {
    const initializeAds = async () => {
      try {
        // On a non-dev emulator: do not initialize ad SDK
        const realDevice = await isRealDevice();
        if (!realDevice && !__DEV__) {
          console.warn('Ad SDK disabled: running on emulator');
          return;
        }

        // Request ATT permission on iOS first
        await requestTrackingPermissionsAsync();

        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.G,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });

        await mobileAds().initialize();
      } catch (err) {
        console.warn('Failed to initialize AdMob SDK:', err);
      }
    };

    initializeAds();
  }, []);

  useEffect(() => {
    const showAppOpenAd = () => {
      // First-launch grace: skip AppOpen ad if the user just launched the app (totalActions is 0)
      if (!appOpenUnitId || appOpenRequestedRef.current || isAdPlaying || isAdPenalized() || !canShowAppOpen(1, 1) || totalActions.current === 0) {
        return;
      }
      if (Date.now() - lastAppOpenShownRef.current < MIN_APP_OPEN_INTERVAL_MS) {
        return;
      }

      if (preloadedAppOpenReadyRef.current && preloadedAppOpenAdRef.current) {
        setAdPlaying(true);
        appOpenRequestedRef.current = true;
        const sessionId = `app-open-${Date.now()}`;

        reportAdEvent({
          placementKey: 'app_open',
          adType: 'APP_OPEN',
          eventType: 'REQUESTED',
          screen: 'GLOBAL',
          sessionId,
        });

        const appOpenAd = preloadedAppOpenAdRef.current;
        preloadedAppOpenAdRef.current = null;
        preloadedAppOpenReadyRef.current = false;

        const cleanup = () => {
          setAdPlaying(false);
          appOpenRequestedRef.current = false;
          preloadAppOpenAd();
        };

        const unsubscribeClosed = appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
          reportAdEvent({
            placementKey: 'app_open',
            adType: 'APP_OPEN',
            eventType: 'DISMISSED',
            screen: 'GLOBAL',
            sessionId,
          });
          lastAppOpenShownRef.current = Date.now();
          recordAppOpenShown();
          unsubscribeClosed();
          unsubscribeError();
          cleanup();
        });

        const unsubscribeError = appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
          reportAdEvent({
            placementKey: 'app_open',
            adType: 'APP_OPEN',
            eventType: 'FAILED_TO_LOAD',
            screen: 'GLOBAL',
            sessionId,
            errorCode: error?.message,
          });
          unsubscribeClosed();
          unsubscribeError();
          cleanup();
        });

        reportAdEvent({
          placementKey: 'app_open',
          adType: 'APP_OPEN',
          eventType: 'LOADED',
          screen: 'GLOBAL',
          sessionId,
        });
        appOpenAd.show();
      } else {
        preloadAppOpenAd();
      }
    };

    showAppOpenAd();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        showAppOpenAd();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appOpenUnitId, canShowAppOpen, isAdPlaying, recordAppOpenShown, setAdPlaying]);

  useEffect(() => {
    let mounted = true;
    const sendActivity = () => {
      if (!mounted) return;
      trackActivity(activeTab).catch(() => {});
    };

    sendActivity();
    const interval = setInterval(sendActivity, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  const chromeHidden = showGames || !!currentOverlay || showDailyMissions;

  // Stable identities: HomeScreen/ShortsFeed are React.memo'd so their prop
  // callbacks must not change reference every MainApp render (which now
  // happens for every mounted tab, since tabs stay mounted forever) — an
  // inline arrow prop would defeat the memo and reconcile the whole
  // (possibly off-screen) tab tree on every unrelated state change.
  const handleOpenGames = useCallback(() => setShowGames(true), []);
  const handleOpenProfile = useCallback(() => pushOverlay('profile'), [pushOverlay]);
  const handleOpenNotifications = useCallback(() => pushOverlay('notifications'), [pushOverlay]);
  const handleOpenDailyMissions = useCallback(() => setShowDailyMissions(true), []);
  const handleOpenShortsWithVideo = useCallback((videoId: string) => {
    setShortsStartVideoId(videoId);
    handleTabChange('hot');
  }, [handleTabChange]);
  const handleShortsVideoStarted = useCallback(() => setShortsStartVideoId(null), []);

  const renderTabContent = useCallback((tab: TabId) => {
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            ref={homeScreenRef}
            onNavigate={handleTabChange}
            onOpenGames={handleOpenGames}
            onOpenProfile={handleOpenProfile}
            onOpenNotifications={handleOpenNotifications}
            onOpenDailyMissions={handleOpenDailyMissions}
            onOpenShortsWithVideo={handleOpenShortsWithVideo}
          />
        );
      case 'discover':
        return <DiscoverScreen />;
      case 'hot':
        return (
          <ShortsFeed
            startVideoId={shortsStartVideoId}
            onVideoStarted={handleShortsVideoStarted}
            // Kept mounted in the background when another tab is active, so
            // its video playback must be gated on focus explicitly instead
            // of relying on unmount to stop it. isAdPlaying matters here too:
            // a nav-transition interstitial defers the actual setActiveTab
            // until the ad closes, so activeTab is still 'hot' for the whole
            // time the ad is on screen — without this check the shorts video
            // kept playing (audibly) behind the ad the entire time.
            isFocused={activeTab === 'hot' && !chromeHidden && !isAdPlaying}
          />
        );
      case 'rewards':
        return <RewardsScreen />;
      case 'wallet':
        return <WalletScreen />;
      default:
        return null;
    }
  }, [
    handleTabChange,
    handleOpenGames,
    handleOpenProfile,
    handleOpenNotifications,
    handleOpenDailyMissions,
    handleOpenShortsWithVideo,
    shortsStartVideoId,
    handleShortsVideoStarted,
    activeTab,
    chromeHidden,
    isAdPlaying,
  ]);

  const renderOverlayContent = () => {
    if (showDailyMissions) {
      return <DailyMissionsScreen onBack={() => setShowDailyMissions(false)} />;
    }
    if (showGames) {
      return <GamesScreen ref={gamesScreenRef} onBack={() => setShowGames(false)} />;
    }
    if (currentOverlay) {
      switch (currentOverlay) {
        case 'profile':
          return <ProfileScreen onBack={popOverlay} onNavigate={(destination) => pushOverlay(destination)} />;
        case 'settings':
          return <SettingsScreen onBack={popOverlay} onOpenHelp={() => pushOverlay('help')} />;
        case 'notifications':
          return <NotificationsScreen onBack={popOverlay} />;
        case 'help':
          return <HelpSupportScreen onBack={popOverlay} />;
        case 'leaderboard':
          return <LeaderboardScreen onBack={popOverlay} />;
        case 'achievements':
          return <AchievementScreen onBack={popOverlay} />;
        case 'referEarn':
          return <ReferEarnScreen onBack={popOverlay} />;
        default:
          return null;
      }
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={false} translucent={true} />
      <View style={StyleSheet.absoluteFill} pointerEvents={chromeHidden ? 'none' : 'box-none'}>
        {TAB_IDS.filter((tab) => mountedTabs.has(tab)).map((tab) => (
          <View
            key={tab}
            style={[StyleSheet.absoluteFill, { display: tab === activeTab && !chromeHidden ? 'flex' : 'none' }]}
          >
            <ScreenFocusProvider value={tab === activeTab && !chromeHidden}>
              {renderTabContent(tab)}
            </ScreenFocusProvider>
          </View>
        ))}
      </View>
      {chromeHidden ? <View style={StyleSheet.absoluteFill}>{renderOverlayContent()}</View> : null}
      {!chromeHidden ? <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} /> : null}
      {!chromeHidden ? <TabTooltip tab={activeTab} onDismiss={() => {}} /> : null}
    </View>
  );
}

export default function App() {
  const { token, hydrated, hasCompletedOnboarding, isOffline } = useAppStore();
  const maintenanceMode = useFeatureFlag('maintenance_mode', false);
  // SplashScreen's own onFinish only fires once its entrance animation AND
  // its hero-image preload both complete — previously this was never
  // passed in, so the splash was dismissed purely on `hydrated` (an
  // AsyncStorage/SecureStore read that's often faster than the animation),
  // silently breaking the "no shimmer on Welcome/Auth" guarantee the
  // preloader exists for. This can only make the splash last >= as long as
  // before, never hang: SplashScreen calls onFinish even on an image load
  // error, and the animation timer always fires.
  const [splashReady, setSplashReady] = useState(false);

  // For logged-in users, this shows briefly during hydration.
  // For logged-out users, WelcomeScreen handles the interactive splash phase.
  if (!hydrated || !splashReady) {
    return (
      <ErrorBoundary>
        <SplashScreen onFinish={() => setSplashReady(true)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <RemoteConfigProvider>
            {maintenanceMode ? (
              <MaintenanceScreen />
            ) : !hasCompletedOnboarding ? (
              // Scoped to pre-auth only: Onboarding/Auth are 100%
              // network-dependent already (nothing to do without a
              // connection), unlike MainApp, which is deliberately built to
              // keep working on cached/bundled defaults when offline — a
              // full-screen block there would regress that.
              isOffline ? <NoInternetScreen onRetry={() => { fetchPublicStatus(); }} /> : <OnboardingFlow />
            ) : !token ? (
              isOffline ? <NoInternetScreen onRetry={() => { fetchPublicStatus(); }} /> : <AuthScreen />
            ) : (
              <MainApp />
            )}
          </RemoteConfigProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  splash: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
});
