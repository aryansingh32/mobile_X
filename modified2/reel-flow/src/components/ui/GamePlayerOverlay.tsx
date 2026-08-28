import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { isAdPenalized, useAdPlacement } from '../../hooks/useAdPlacement';
import { useAdUnitId } from '../../hooks/useAdUnitId';
import { useAppStore } from '../../store/useAppStore';
import { reportAdEvent } from '../../api/config';
import { Game, gameUrl } from '../../api/games';

type Props = {
  selectedGame: Game | null;
  onExit: () => void;
};

// Exposes the same ad-gated exit flow the in-app back arrow uses, so the
// Android hardware back button can trigger it too instead of a parent
// screen closing itself outright and skipping it — see handleBack below.
export interface GamePlayerOverlayHandle {
  handleBack: () => boolean;
}

export const GamePlayerOverlay = React.forwardRef<GamePlayerOverlayHandle, Props>(({ selectedGame, onExit }, ref) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { isAdPlaying, setAdPlaying } = useAppStore(useShallow(s => ({ isAdPlaying: s.isAdPlaying, setAdPlaying: s.setAdPlaying })));
  const { config: gameCompletionPlacement, canShow, recordShown } = useAdPlacement('game_completion_interstitial');
  const gameCompletionAdUnitId = useAdUnitId(gameCompletionPlacement?.adUnitKey ?? 'GAME_COMPLETION', TestIds.INTERSTITIAL);
  const exitCountRef = useRef(0);
  // Guards against a rapid double-tap on the back button firing two
  // concurrent exit/ad flows: isAdPlaying only updates on the *next* render,
  // so two onPress calls in the same tick both see the stale (false) value.
  // This ref is checked and set synchronously, independent of React's render
  // cycle, so the second tap is a genuine no-op.
  const exitInFlightRef = useRef(false);
  // Ad event listener unsubscribers for the in-flight exit flow, if any —
  // torn down on unmount so a screen change while an ad is still loading
  // doesn't leave a late callback firing against a gone component.
  const unsubscribersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];
    };
  }, []);

  // This component stays mounted across game selections (callers just toggle
  // `selectedGame` between an object and null) — reset per-game load state
  // whenever the game changes, or a previous game's load error would
  // permanently hide the WebView for every game selected afterward.
  useEffect(() => {
    setLoading(true);
    setLoadError(false);
  }, [selectedGame?.id]);

  const handleGameExit = () => {
    if (exitInFlightRef.current) return;

    exitCountRef.current += 1;

    if (!gameCompletionAdUnitId || isAdPlaying || isAdPenalized() || !canShow(1, exitCountRef.current)) {
      onExit();
      return;
    }

    exitInFlightRef.current = true;
    setAdPlaying(true);
    const sessionId = `game-completion-${Date.now()}`;

    reportAdEvent({
      placementKey: 'game_completion_interstitial',
      adType: 'INTERSTITIAL',
      eventType: 'REQUESTED',
      screen: 'GAMES',
      sessionId,
    });

    const ad = InterstitialAd.createForAdRequest(gameCompletionAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const cleanup = () => {
      exitInFlightRef.current = false;
      setAdPlaying(false);
      onExit();
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      unsubscribersRef.current = [];
    };

    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      reportAdEvent({
        placementKey: 'game_completion_interstitial',
        adType: 'INTERSTITIAL',
        eventType: 'LOADED',
        screen: 'GAMES',
        sessionId,
      });
      ad.show();
    });

    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      reportAdEvent({
        placementKey: 'game_completion_interstitial',
        adType: 'INTERSTITIAL',
        eventType: 'DISMISSED',
        screen: 'GAMES',
        sessionId,
      });
      recordShown();
      cleanup();
    });

    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      reportAdEvent({
        placementKey: 'game_completion_interstitial',
        adType: 'INTERSTITIAL',
        eventType: 'FAILED_TO_LOAD',
        screen: 'GAMES',
        sessionId,
        errorCode: error?.message,
      });
      cleanup();
    });

    unsubscribersRef.current = [unsubscribeLoaded, unsubscribeClosed, unsubscribeError];

    // Guard against ad.load() itself throwing synchronously (unusual, but
    // seen with misconfigured ad units) — without this the exit flow would
    // hang with exitInFlightRef stuck true and the user unable to leave.
    try {
      ad.load();
    } catch {
      cleanup();
    }
  };

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      if (!selectedGame) return false;
      handleGameExit();
      return true;
    },
  }), [selectedGame]);

  if (!selectedGame) return null;

  return (
    <View style={styles.playerRoot}>
      <View style={[styles.playerHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={handleGameExit} accessibilityRole="button" accessibilityLabel="Back to games">
          <ArrowLeft color="#FFF" size={22} />
        </TouchableOpacity>
        <View style={styles.playerTitleWrap}>
          <Text style={styles.playerTitle} numberOfLines={1}>{selectedGame.title}</Text>
          <Text style={styles.playerSubtitle}>HTML5 game</Text>
        </View>
      </View>
      <View style={styles.webViewWrap}>
        {!loadError && (
          <WebView
            key={reloadKey}
            source={{ uri: gameUrl(selectedGame) }}
            style={styles.webView}
            allowsInlineMediaPlayback
            bounces={false}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            javaScriptEnabled
            domStorageEnabled
            onLoadStart={() => { setLoading(true); setLoadError(false); }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setLoadError(true); }}
            onHttpError={() => { setLoading(false); setLoadError(true); }}
          />
        )}
        {loading && !loadError ? (
          <View style={styles.loader}>
            <ActivityIndicator color={selectedGame.accent} />
            <Text style={styles.loaderText}>Loading game</Text>
          </View>
        ) : null}
        {loadError ? (
          <View style={styles.loader}>
            <Text style={styles.loaderText}>Couldn't load this game.</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => { setLoadError(false); setReloadKey((k) => k + 1); }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
});

GamePlayerOverlay.displayName = 'GamePlayerOverlay';

const styles = StyleSheet.create({
  playerRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
    zIndex: 9999,
    elevation: 9999,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#111',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerTitleWrap: {
    marginLeft: 16,
  },
  playerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  playerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  webViewWrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#2A2A2A',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
