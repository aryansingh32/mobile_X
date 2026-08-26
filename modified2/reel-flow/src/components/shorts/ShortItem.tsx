import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import {
  Heart,
  Play,
  Plus,
  Music2,
} from 'lucide-react-native';
import { triggerHaptic } from '../../utils/haptics';
import { claimShortReward } from '../../api/rewards';
import { VIBIcon } from '../ui/VIBIcon';


// ── Configuration Constants ──────────────────────────────────────────────
// Set to true to show username, avatar, caption, sound UI
const SHOW_AUTHOR_INFO = false;
// Seconds of active watch time before the Short session is tracked for analytics.
const COIN_REWARD_WATCH_SECONDS = 8;

// ── Types ────────────────────────────────────────────────────────────────
export interface ShortData {
  id: string;
  username: string;
  avatar: string;
  caption: string;
  sound: string;
  likes: number;
  comments: number;
  coins: number;
  type?: 'NORMAL' | 'REWARDED_INTERSTITIAL_TRIGGER' | 'REWARDED_VIDEO_CARD';
}

interface ShortItemProps {
  data: ShortData;
  isActive: boolean;
  isPreload: boolean;
  playerHeight: number;
  playerWidth: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${n}`;
}

// ── ShimmerThumbnail ─────────────────────────────────────────────────────
// Lightweight pulse shimmer using Animated API only (no external libs).
// Shows a low-res YouTube thumbnail behind an opacity-pulsing overlay.
function ShimmerThumbnail({ videoId }: { videoId: string }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={shimmerStyles.root}>
      {/* Low-res thumbnail loads fast (~100ms) from YouTube CDN, cached to disk
          so re-scrolling past a seen video shows it instantly instead of refetching. */}
      <Image
        source={{ uri: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
        transition={150}
      />
      {/* Shimmer pulse overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.08)', opacity }]}
      />
      {/* Play icon hint */}
      <View style={shimmerStyles.playHint}>
        <View style={shimmerStyles.playCircle}>
          <Play size={32} color="#fff" fill="#fff" />
        </View>
      </View>
    </View>
  );
}

const shimmerStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  playHint: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── ShortItem ────────────────────────────────────────────────────────────
export const ShortItem = React.memo(function ShortItem({
  data,
  isActive,
  isPreload,
  playerHeight,
  playerWidth,
}: ShortItemProps) {
  const shouldRenderWebView = (isActive || isPreload) && (!data.type || data.type === 'NORMAL');

  // ── State ────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState(false);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const [ready, setReady] = useState(false);

  const [coinRewarded, setCoinRewarded] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────
  const webviewRef = useRef<WebView>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated values
  const likeScale = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;

  // ── Effects ──────────────────────────────────────────────────────────

  // Reset `ready` when WebView unmounts (item leaves ±1 range)
  useEffect(() => {
    if (!shouldRenderWebView) {
      setReady(false);
    }
  }, [shouldRenderWebView]);

  // Consolidated playback state management
  useEffect(() => {
    if (!ready) return;

    if (isActive) {
      webviewRef.current?.injectJavaScript(`
        if (player) {
          if (player.seekTo) player.seekTo(0);
          if (player.unMute) player.unMute();
          if (player.playVideo) player.playVideo();
        }
        true;
      `);
      setPlaying(true);
    } else {
      // Preloading or out-of-range: keep muted, let autoplay buffer
      webviewRef.current?.injectJavaScript(`
        if (player) {
          if (player.mute) player.mute();
          if (player.playVideo) player.playVideo();
        }
        true;
      `);
      setPlaying(false);
    }
  }, [isActive, ready]);

  // Track one analytics session per video watch.
  useEffect(() => {
    if (isActive && !coinRewarded) {
      watchTimerRef.current = setTimeout(() => {
        triggerCoinReward();
      }, COIN_REWARD_WATCH_SECONDS * 1000);
    } else {
      if (watchTimerRef.current) {
        clearTimeout(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    }
    return () => {
      if (watchTimerRef.current) clearTimeout(watchTimerRef.current);
    };
  }, [isActive, coinRewarded]);

  // Reset coin reward when video ID changes (slot recycled)
  useEffect(() => {
    setCoinRewarded(false);
  }, [data.id]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const triggerCoinReward = useCallback(async () => {
    setCoinRewarded(true);
    try {
      // Track session for analytics only — coins come from ads, not content watching (Option A)
      const sessionId = `short-${data.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await claimShortReward(data.id, COIN_REWARD_WATCH_SECONDS, sessionId);
      // No coin update — backend returns 0 coins for short watches
    } catch {
      // Silently fail — short session tracking is non-critical
    }
  }, [data.id]);

  const togglePlay = useCallback(() => {
    triggerHaptic('impact-light');
    const next = !playing;
    setPlaying(next);
    webviewRef.current?.injectJavaScript(
      next
        ? 'if (player) { if (player.unMute) player.unMute(); if (player.playVideo) player.playVideo(); } true;'
        : 'if (player) { if (player.mute) player.mute(); if (player.pauseVideo) player.pauseVideo(); } true;'
    );
  }, [playing]);


  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setReady(true);
      } else if (msg.type === 'state') {
        // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2
        if (msg.state === 1) {
          setPlaying(true);
          if (isActive) {
            webviewRef.current?.injectJavaScript(`
              if (player) {
                if (player.unMute) player.unMute();
                if (player.setVolume) player.setVolume(100);
              }
              true;
            `);
          }
        }
        else if (msg.state === 0 || msg.state === 2) setPlaying(false);
      }
    } catch {
      // ignore parse errors
    }
  }, [isActive]);

  const doLike = useCallback(() => {
    triggerHaptic('impact-medium');
    setLiked(true);
    setShowLikeBurst(true);

    likeScale.setValue(0.5);
    likeOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(likeScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(likeOpacity, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start(() => setShowLikeBurst(false));
  }, [likeScale, likeOpacity]);

  const handleTap = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      doLike(); // double-tap → like
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      togglePlay(); // single-tap → play/pause
    }, 250);
  }, [doLike, togglePlay]);

  // ── HTML Content (memoized) ──────────────────────────────────────────
  // Always starts muted (mute: 1) — unmuting is handled via injectJavaScript.
  // This prevents htmlContent regeneration when global mute toggles.
  const safeVideoId = useMemo(() => (/^[A-Za-z0-9_-]{11}$/.test(data.id) ? data.id : ''), [data.id]);
  const encodedVideoId = JSON.stringify(safeVideoId);

  const htmlContent = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <!-- Open the connections the iframe API + player will need before it asks for them,
             so DNS/TLS negotiation isn't sitting on the critical path to first frame. -->
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://s.ytimg.com" crossorigin />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <style>
          body, html {
            margin: 0; padding: 0; background: #000;
            overflow: hidden; width: 100vw; height: 100vh;
          }
          #player-container {
            position: fixed;
            top: 0; left: 0;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background: #000;
          }
          /* Full-bleed cover: scale 16:9 iframe to fill 100vh, crop sides */
          /* TO ADJUST HEIGHT/WIDTH:
             Change width to 100vw and height to calc(100vw * 9 / 16) if you want to see the whole video without cropping. */
          #player {
            position: absolute;
            width: 100vw;
            height: 100vh;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            border: none;
            pointer-events: auto;
          }
        </style>
      </head>
      <body>
        <div id="player-container">
          <div id="player"></div>
        </div>
        <!-- Keep-alive: prevents Chromium from throttling off-screen WebViews -->
        <div style="position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden">
          <svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
            <circle cx="0.5" cy="0.5" r="0.5">
              <animate attributeName="r" values="0.5;0.4;0.5" dur="2s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <script>
          if (window.YT) {
            setTimeout(onYouTubeIframeAPIReady, 100);
          } else {
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
          }
        </script>
        <script>
          var reelFlowVideoId = ${encodedVideoId};
          var player;
          function onYouTubeIframeAPIReady() {
            if (!reelFlowVideoId) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', reason: 'invalid_video_id' }));
              return;
            }
            player = new YT.Player('player', {
              videoId: reelFlowVideoId,
              playerVars: {
                autoplay: 1,
                controls: 0,
                mute: 1,
                playsinline: 1,
                loop: 1,
                playlist: reelFlowVideoId,
                rel: 0,
                disablekb: 1,
                fs: 0,
                iv_load_policy: 3,
                origin: 'https://games-9up.pages.dev'
              },
              events: {
                onReady: function(e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
                  e.target.playVideo();
                },
                onStateChange: function(e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state', state: e.data }));
                }
              }
            });
          }
        </script>
      </body>
    </html>
  `,
    [encodedVideoId],
  );

  // ── Render ───────────────────────────────────────────────────────────
  if (data.type === 'REWARDED_INTERSTITIAL_TRIGGER') {
    return (
      <View style={[styles.container, { width: playerWidth, height: playerHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }]}>
        <View style={{ padding: 32, alignItems: 'center', borderWidth: 2, borderColor: '#FFD700', borderRadius: 16, backgroundColor: '#1A1A1A' }}>
          <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>Short break</Text>
          <Text style={{ color: '#FFD700', fontSize: 18, marginBottom: 24 }}>Sponsored reward video</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading video...</Text>
        </View>
      </View>
    );
  }

  if (data.type === 'REWARDED_VIDEO_CARD') {
    return (
      <View style={[styles.container, { width: playerWidth, height: playerHeight, backgroundColor: '#1A1A1A', padding: 24 }]}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, position: 'absolute', top: 40, left: 24 }}>Sponsored</Text>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,215,0,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            <Play size={40} color="#FFD700" fill="#FFD700" />
          </View>
          <Text style={{ color: '#FFF', fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>⭐ Reward Break</Text>
          <View style={{ backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#FFD700', marginBottom: 40 }}>
            <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: 'bold' }}>
              Earn {data.coins} <VIBIcon size={18} style={{ transform: [{ translateY: 3 }] }} />
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            Watch the complete video without skipping or switching apps
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: playerWidth, height: playerHeight }]}>
      {/* ── Layer 0: Video content ─────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {shouldRenderWebView ? (
          <>
            <WebView
              ref={webviewRef}
              source={{ html: htmlContent, baseUrl: 'https://games-9up.pages.dev' }}
              originWhitelist={['https://games-9up.pages.dev', 'https://www.youtube.com', 'https://s.ytimg.com']}
              style={{ flex: 1, backgroundColor: '#000' }}
              scrollEnabled={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback={true}
              onMessage={onMessage}
              cacheEnabled
              cacheMode="LOAD_DEFAULT"
              androidLayerType="hardware"
              renderToHardwareTextureAndroid
              decelerationRate="normal"
              domStorageEnabled
              startInLoadingState={false}
              overScrollMode="never"
            />
            {/* Shimmer overlay while WebView cold-loads (active item only) */}
            {(isActive || isPreload) && !ready && (
              <View style={StyleSheet.absoluteFill}>
                <ShimmerThumbnail videoId={data.id} />
              </View>
            )}
          </>
        ) : (
          <Image
            source={{ uri: `https://img.youtube.com/vi/${data.id}/mqdefault.jpg` }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="low"
            transition={150}
          />
        )}
      </View>

      {/* ── Layer 1: Gesture interceptor ──────────── */}
      {/* This invisible layer intercepts single/double taps. */}
      {/* By default it covers the top 80% (0.8) of the screen, leaving the bottom 20% uncovered */}
      {/* so the YouTube logo and share buttons remain tappable (TOS compliance). */}
      {/* TO ADJUST: Change 0.8 to a different percentage, e.g., 0.9 for 90%, or replace with playerHeight - 150 */}
      {isActive && (
        <Pressable
          style={[styles.gestureZone, { height: playerHeight * 0.8}]}
          pointerEvents={playing ? 'auto' : 'none'}
          onPress={handleTap}
        />
      )}

      {/* ── Layer 2: UI overlays ─────────────────────────────────── */}
      {isActive && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Pause icon */}
          {!playing && ready && (
            <View style={styles.pausedOverlay} pointerEvents="none">
              <View style={styles.playIconContainer}>
                {/* TO ADJUST ICON SIZE: Change size={40} to a larger/smaller number */}
                <Play size={40} color="#fff" fill="#fff" />
              </View>
            </View>
          )}

          {/* Like burst */}
          {showLikeBurst && (
            <Animated.View
              style={[
                styles.likeBurst,
                { transform: [{ scale: likeScale }], opacity: likeOpacity },
              ]}
            >
              <Heart size={120} color="#ff2052" fill="#ff2052" />
            </Animated.View>
          )}


          {/* Bottom-left author info (hidden by default via flag) */}
          {SHOW_AUTHOR_INFO && (
            <View style={styles.bottomInfo}>
              <View style={styles.authorRow}>
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: data.avatar }} style={styles.avatar} cachePolicy="memory-disk" />
                  <View style={styles.plusIcon}>
                    <Plus size={12} color="#fff" strokeWidth={3} />
                  </View>
                </View>
                <Text style={styles.username}>@{data.username}</Text>
              </View>
              <Text style={styles.caption} numberOfLines={2}>
                {data.caption}
              </Text>
              <View style={styles.soundRow}>
                <Music2 size={14} color="#fff" />
                <Text style={styles.soundText}>{data.sound}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  // Gesture zone covers top 80% of screen; bottom 20% passes through to WebView
  gestureZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },

  // Pause overlay
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  // TO ADJUST BACKGROUND CIRCLE SIZE: Change width, height, and borderRadius (borderRadius should be half of width/height)
  playIconContainer: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: 'rgba(0, 0, 0, 0.47)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Like burst
  likeBurst: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -60,
    marginLeft: -60,
    zIndex: 4,
  },

  // Coin reward toast — top-right, above right rail
  coinToast: {
    position: 'absolute',
    top: '35%',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,200,0,0.6)',
  },
  coinToastText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Right action rail — moved up to clear YT controls at bottom
  // TO SHIFT RIGHT RAIL: Adjust 'bottom' or 'right' values below
  rightRail: {
    position: 'absolute',
    bottom: 100,
    right: 12,
    alignItems: 'center',
    gap: 20,
    zIndex: 3,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  discContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ff2052',
    overflow: 'hidden',
    marginTop: 4,
  },
  discImage: {
    width: '100%',
    height: '100%',
  },

  // Author info
  bottomInfo: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 80,
    zIndex: 3,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ff2052',
  },
  plusIcon: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff2052',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 12,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  soundText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
});
