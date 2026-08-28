import { StatusBar } from 'expo-status-bar';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { isRealDevice } from './src/utils/deviceSafety';
import { useAppStore } from './src/store/useAppStore';
import SplashScreen from './src/screens/SplashScreen';
import { RemoteConfigProvider } from './src/providers/RemoteConfigProvider';
import { useAdPlacement, isAdPenalized } from './src/hooks/useAdPlacement';
import { AppOpenAd, InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { reportAdEvent } from './src/api/config';
import { useAdUnitId } from './src/hooks/useAdUnitId';
import { useFeatureFlag } from './src/hooks/useFeatureFlag';
import { useTelemetry } from './src/hooks/useTelemetry';

// Screens
import BottomNavBar, { TabId } from './src/components/BottomNavBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { DiscoverScreen } from './src/components/discover/DiscoverScreen';
import { ShortsFeed } from './src/components/shorts/ShortsFeed';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { GamesScreen } from './src/screens/GamesScreen';
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

type OverlayScreen = ProfileDestination | 'profile';

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [showGames, setShowGames] = useState(false);
  const [showDailyMissions, setShowDailyMissions] = useState(false);
  const [overlayStack, setOverlayStack] = useState<OverlayScreen[]>([]);
  const [shortsStartVideoId, setShortsStartVideoId] = useState<string | null>(null);
  const pushOverlay = (screen: OverlayScreen) => setOverlayStack((s) => [...s, screen]);
  const popOverlay = () => setOverlayStack((s) => s.slice(0, -1));
  const currentOverlay = overlayStack.length ? overlayStack[overlayStack.length - 1] : null;
  const { isAdPlaying, setAdPlaying, canWatchAd } = useAppStore();
  
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
        setShowGames(false);
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

  const preloadNavAd = () => {
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
  };

  const preloadWalletAd = () => {
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
  };

  useEffect(() => {
    if (navInterstitialUnitId) preloadNavAd();
  }, [navInterstitialUnitId]);

  const preloadAppOpenAd = () => {
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
  };

  useEffect(() => {
    if (appOpenUnitId) preloadAppOpenAd();
  }, [appOpenUnitId]);

  useEffect(() => {
    if (walletAdUnitId) preloadWalletAd();
  }, [walletAdUnitId]);

  const handleTabChange = (tab: TabId) => {
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
  };

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

  const renderScreen = () => {
    if (showGames) {
      return <GamesScreen onBack={() => setShowGames(false)} />;
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

    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            onNavigate={handleTabChange}
            onOpenGames={() => setShowGames(true)}
            onOpenProfile={() => pushOverlay('profile')}
            onOpenNotifications={() => pushOverlay('notifications')}
            onOpenDailyMissions={() => setShowDailyMissions(true)}
            onOpenShortsWithVideo={(videoId) => {
              setShortsStartVideoId(videoId);
              handleTabChange('hot');
            }}
          />
        );
      case 'discover':
        return <DiscoverScreen />;
      case 'hot':
        return <ShortsFeed startVideoId={shortsStartVideoId} onVideoStarted={() => setShortsStartVideoId(null)} onBack={() => handleTabChange('home')} />;
      case 'rewards':
        return <RewardsScreen />;
      case 'wallet':
        return <WalletScreen />;
      default:
        return null;
    }
  };

  const chromeHidden = showGames || !!currentOverlay || showDailyMissions;

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={false} translucent={true} />
      {showDailyMissions ? (
        <DailyMissionsScreen onBack={() => setShowDailyMissions(false)} />
      ) : (
        renderScreen()
      )}
      {!chromeHidden ? <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} /> : null}
      {!chromeHidden ? <TabTooltip tab={activeTab} onDismiss={() => {}} /> : null}
    </View>
  );
}

export default function App() {
  const { token, hydrated, hasCompletedOnboarding } = useAppStore();
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
              <OnboardingFlow />
            ) : !token ? (
              <AuthScreen />
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
