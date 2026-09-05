import React, { useCallback, useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import {
  Heart,
  Play,
  Plus,
  Music2,
} from 'lucide-react-native';
import { triggerHaptic } from '../../utils/haptics';
import { VIBIcon } from '../ui/VIBIcon';

// ── Configuration Constants ──────────────────────────────────────────────
// Set to true to show username, avatar, caption, sound UI
const SHOW_AUTHOR_INFO = false;
// Fraction of player height left clear above/below the tap-gesture zone so the
// native YouTube title/watermark (top) and progress-bar/controls (bottom)
// stay reachable — required by YouTube API TOS (controls must not be obscured).
const GESTURE_ZONE_TOP_INSET = 0.12;
const GESTURE_ZONE_BOTTOM_INSET = 0.22;
// Gives each video a "card" feel instead of an edge-to-edge rectangle: a
// sliver of the screen's own black background shows above the video, whose
// top corners are rounded into it, with a soft dark gradient easing the seam
// — a hint that there's a boundary here (like the next card peeking on the
// Discover feed) without literally revealing the next video underneath it,
// which would spoil it. TO ADJUST: tweak these two.
const CARD_TOP_INSET = 12;
const CARD_RADIUS = 24;

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
  // Only meaningful when isPreload is true: whether this item is the
  // immediate upcoming (not-yet-watched) neighbor vs. anything further out.
  // See the playback effect below for why this distinction matters.
  preloadAhead: boolean;
  playerHeight: number;
  playerWidth: number;
}

export interface ShortItemHandle {
  // Imperative, synchronous-as-possible mute+pause — called directly by
  // ShortsFeed the instant the active index changes, instead of waiting for
  // this component's own isActive prop to flow through a re-render and its
  // effect to fire. That extra hop is where audio bleed was slipping through:
  // if mounting the newly-active item's WebView is itself expensive (a cold
  // iframe boot), it can delay the JS thread long enough that the outgoing
  // item's own prop-driven mute effect doesn't run until well after the
  // swipe, during which its audio keeps playing. Calling this straight from
  // the scroll handler skips that queue.
  pauseAndMute: () => void;
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
export const ShortItem = React.memo(forwardRef<ShortItemHandle, ShortItemProps>(function ShortItem({
  data,
  isActive,
  isPreload,
  preloadAhead,
  playerHeight,
  playerWidth,
}, ref) {
  const shouldRenderWebView = (isActive || isPreload) && (!data.type || data.type === 'NORMAL');

  // ── State ────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState(false);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  // `ready` fires when YouTube's player API has finished initializing —
  // it does NOT mean a video frame has actually painted yet; the media
  // itself can still take a moment to buffer after that. Hiding the shimmer
  // on `ready` left a real gap (shimmer gone, nothing painted yet → black
  // screen) between API-ready and the first visible frame. `hasPlayed`
  // tracks the stronger signal — the player actually reporting PLAYING —
  // and is what the shimmer is gated on below.
  const [ready, setReady] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────
  const webviewRef = useRef<WebView>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated values
  const likeScale = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    pauseAndMute: () => {
      setPlaying(false);
      webviewRef.current?.injectJavaScript(`
        if (player) {
          if (player.mute) player.mute();
          if (player.pauseVideo) player.pauseVideo();
        }
        true;
      `);
    },
  }), []);

  // ── Effects ──────────────────────────────────────────────────────────

  // Reset when WebView unmounts (item leaves preload range)
  useEffect(() => {
    if (!shouldRenderWebView) {
      setReady(false);
      setHasPlayed(false);
    }
  }, [shouldRenderWebView]);

  // Consolidated playback state management.
  //
  // Three states, not two:
  //  - active: seek to 0, unmute, play — the video the user is watching.
  //  - preload-ahead (the next, not-yet-watched neighbor): muted + playing,
  //    so it's already buffered by the time the user swipes to it — this is
  //    what makes the forward swipe feel instant instead of showing a loading
  //    spinner on every video.
  //  - everything else (the previous video just swiped away from, or any
  //    other non-active slot): muted + PAUSED, not muted-and-still-playing.
  //    A paused video categorically cannot leak audio, whereas relying on a
  //    mute() JS-bridge call alone left a window where the outgoing video's
  //    audio was still audible while the new one was loading in front of it.
  //    This costs nothing on re-activation since becoming active always
  //    seeks to 0 first anyway (every visit replays from the start).
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
    } else if (preloadAhead) {
      webviewRef.current?.injectJavaScript(`
        if (player) {
          if (player.mute) player.mute();
          if (player.playVideo) player.playVideo();
        }
        true;
      `);
      setPlaying(false);
    } else {
      webviewRef.current?.injectJavaScript(`
        if (player) {
          if (player.mute) player.mute();
          if (player.pauseVideo) player.pauseVideo();
        }
        true;
      `);
      setPlaying(false);
    }
  }, [isActive, preloadAhead, ready]);

  // ── Handlers ─────────────────────────────────────────────────────────

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
          // First real signal that a frame is actually on screen — set once
          // and never cleared while this WebView is alive, whether this fires
          // while active or while preload-buffering muted in the background
          // (a video promoted from preload straight to active already has
          // frames rendered, so it correctly skips the shimmer entirely).
          setHasPlayed(true);
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
          /* Full-bleed cover for a vertical (9:16) Short: most phone screens
             are proportionally TALLER than 9:16 (e.g. 19.5:9), so sizing this
             box to exactly 100vw x 100vh — a non-9:16 shape — made YouTube's
             player letterbox the video to preserve its real aspect ratio,
             leaving a black gap below it. Instead size the box to the actual
             9:16 shape, tall enough to fill 100vh, and let it overflow
             horizontally — #player-container's overflow:hidden crops the
             (small, ~10%) excess on the sides instead of leaving a vertical
             gap. This is the same "cover" trick as CSS background-size:cover.
             TO ADJUST: change 9/16 below to whatever the source video's
             actual aspect ratio is, or to 100vw/calc(100vw*16/9) (no crop,
             letterboxed) if you'd rather see the whole frame than crop it. */
          #player {
            position: absolute;
            height: 100vh;
            width: calc(100vh * 9 / 16);
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
                // Must stay 1 — YouTube API TOS prohibits disabling/hiding the
                // native player controls (progress bar, YT logo/watermark,
                // volume). See the gestureZone below for how we keep our own
                // tap gestures without covering them.
                controls: 1,
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
      <View
        style={[
          StyleSheet.absoluteFill,
          { top: CARD_TOP_INSET, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS, overflow: 'hidden' },
        ]}
        pointerEvents="box-none"
      >
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
              domStorageEnabled
              startInLoadingState={false}
              overScrollMode="never"
            />
            {/* Shimmer overlay while the WebView cold-loads. Gated on
                hasPlayed rather than ready: `ready` only means the player API
                finished initializing, not that a frame has actually painted
                — hiding the shimmer that early left a black-screen gap while
                the video was still buffering its first frame. */}
            {(isActive || isPreload) && !hasPlayed && (
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
        {/* Soft dark seam at the card's top edge — reads as a rounded card
            boundary rather than a hard cut, echoing Discover's card styling
            without revealing anything about the next video. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
          style={styles.cardTopSeam}
          pointerEvents="none"
        />
      </View>

      {/* ── Layer 1: Gesture interceptor ──────────── */}
      {/* This invisible layer intercepts single/double taps for our own
          play/pause + like gestures. Now that the native YouTube controls
          are enabled (controls: 1, required by TOS — see playerVars above),
          this MUST leave the top title/channel/watermark area and the
          bottom progress-bar/controls area reachable — it only covers the
          vertical middle band of the player, not the full height. */}
      {/* TO ADJUST: change GESTURE_ZONE_TOP_INSET / GESTURE_ZONE_BOTTOM_INSET below. */}
      {isActive && (
        <Pressable
          style={[
            styles.gestureZone,
            {
              top: playerHeight * GESTURE_ZONE_TOP_INSET,
              height: playerHeight * (1 - GESTURE_ZONE_TOP_INSET - GESTURE_ZONE_BOTTOM_INSET),
            },
          ]}
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
}));

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  cardTopSeam: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },

  // Gesture zone covers top 80% of screen; bottom 20% passes through to WebView
  gestureZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },

  // Pause overlay — top offset matches CARD_TOP_INSET so the icon centers on
  // the actual visible video area, not the full (slightly taller) container.
  pausedOverlay: {
    position: 'absolute',
    top: CARD_TOP_INSET,
    left: 0,
    right: 0,
    bottom: 0,
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

  // Like burst — centered using absoluteFillObject + flex centering instead of top/left '50%'
  // (New Architecture/Fabric requires numeric values for layout props on absolute elements)
  likeBurst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
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
    left: 12, // avatar width 44px / 2 − badge width 20px / 2 = 12 (replaces left:'50%' + marginLeft:-10)
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
