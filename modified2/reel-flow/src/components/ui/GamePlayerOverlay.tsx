import { useShallow } from 'zustand/react/shallow';
import React, { useRef, useState } from 'react';
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

export const GamePlayerOverlay = ({ selectedGame, onExit }: Props) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const { isAdPlaying, setAdPlaying } = useAppStore(useShallow(s => ({ isAdPlaying: s.isAdPlaying, setAdPlaying: s.setAdPlaying })));
  const { config: gameCompletionPlacement, canShow, recordShown } = useAdPlacement('game_completion_interstitial');
  const gameCompletionAdUnitId = useAdUnitId(gameCompletionPlacement?.adUnitKey ?? 'GAME_COMPLETION', TestIds.INTERSTITIAL);
  const exitCountRef = useRef(0);

  const handleGameExit = () => {
    exitCountRef.current += 1;

    if (!gameCompletionAdUnitId || isAdPlaying || isAdPenalized() || !canShow(1, exitCountRef.current)) {
      onExit();
      return;
    }

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
      setAdPlaying(false);
      onExit();
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
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

    ad.load();
  };

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
        <WebView
          source={{ uri: gameUrl(selectedGame) }}
          style={styles.webView}
          allowsInlineMediaPlayback
          bounces={false}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled
          domStorageEnabled
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
        />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={selectedGame.accent} />
            <Text style={styles.loaderText}>Loading game</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

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
});
