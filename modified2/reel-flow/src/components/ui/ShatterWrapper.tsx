import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

interface ShatterWrapperProps {
  children: React.ReactNode;
  isShattered: boolean;
  onAnimationComplete?: () => void;
  width: number;
  height: number;
  glassColor?: string;
}

interface Shard {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  translateX: number;
  translateY: number;
  rotation: number;
  scale: number;
  delay: number;
  isSparkle: boolean;
  isGold: boolean;
  isHighlight: boolean;
}

// Tune these to trade off polish vs perf. Density adapts to card size (see
// buildShards) instead of a fixed grid, so a 90px reward strip and a
// full-screen short don't pay the same shard count.
const TARGET_SHARD_PX = 38;
const MAX_SHARDS = 54;
const ANTICIPATION_MS = 70; // tiny squash-in before impact sells the "crack"
const FLASH_MS = 90;        // quick white "impact" flash before the break
const SHATTER_MS = 620;     // shards flying apart
const COLLAPSE_MS = 380;    // card height collapsing to reveal item below

function buildShards(width: number, height: number): Shard[] {
  if (width <= 0 || height <= 0) return [];

  let cols = Math.max(3, Math.round(width / TARGET_SHARD_PX));
  let rows = Math.max(3, Math.round(height / TARGET_SHARD_PX));
  if (cols * rows > MAX_SHARDS) {
    const scale = Math.sqrt(MAX_SHARDS / (cols * rows));
    cols = Math.max(3, Math.round(cols * scale));
    rows = Math.max(3, Math.round(rows * scale));
  }

  // Pick a random "impact point" — shards fly radially outward from here,
  // which is what makes it read as glass breaking instead of confetti.
  const impactX = width * (0.3 + Math.random() * 0.4);
  const impactY = height * (0.3 + Math.random() * 0.4);

  const shardW = width / cols;
  const shardH = height / rows;
  const maxDist = Math.hypot(width, height);
  const pieces: Shard[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * shardW + shardW / 2;
      const cy = r * shardH + shardH / 2;
      const dx = cx - impactX;
      const dy = cy - impactY;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Pieces near the impact fly further & spin faster; far pieces are
      // bigger, slower, and drop more (gravity-ish drift).
      const proximity = 1 - Math.min(dist / maxDist, 1);
      const flight = 130 + dist * 0.85 + Math.random() * 130;
      const gravityDrop = 55 + proximity * 110;

      const isSparkle = Math.random() > 0.9;
      const isGold = !isSparkle && Math.random() > 0.88;
      const isHighlight = !isSparkle && !isGold && Math.random() > 0.6;

      pieces.push({
        id: `${r}-${c}`,
        left: c * shardW,
        top: r * shardH,
        width: shardW * (isSparkle ? 0.4 : 0.55 + Math.random() * 0.5),
        height: shardH * (isSparkle ? 0.4 : 0.55 + Math.random() * 0.5),
        translateX: ux * flight + (Math.random() - 0.5) * 55,
        translateY: uy * flight + gravityDrop,
        rotation: (Math.random() - 0.5) * (380 + proximity * 640),
        scale: Math.random() * 0.4 + (isSparkle ? 1.3 : 0.5),
        delay: Math.random() * 40, // tiny stagger so it doesn't pop as one block
        isSparkle,
        isGold,
        isHighlight,
      });
    }
  }
  return pieces;
}

export const ShatterWrapper: React.FC<ShatterWrapperProps> = ({
  children, isShattered, onAnimationComplete, width, height, glassColor = 'rgba(26, 26, 46, 0.95)',
}) => {
  const [shards, setShards] = useState<Shard[]>([]);
  const anticipationAnim = useRef(new Animated.Value(0)).current; // native driver
  const shatterAnim = useRef(new Animated.Value(0)).current;      // native driver
  const flashAnim = useRef(new Animated.Value(0)).current;        // native driver
  const heightAnim = useRef(new Animated.Value(height)).current;  // JS driver (layout)
  const hasShatteredRef = useRef(false);

  useEffect(() => {
    heightAnim.setValue(height);
  }, [height]);

  useEffect(() => {
    if (!isShattered || hasShatteredRef.current) return;
    hasShatteredRef.current = true;

    // Shard geometry is only worth computing for the one card that's
    // actually breaking — not for every off-screen list item mounted
    // nearby, which is what made this expensive before.
    setShards(buildShards(width, height));

    const animation = Animated.sequence([
      // Brief squash toward the impact point — reads as glass "giving" a beat
      // before it cracks, instead of popping straight to shards.
      Animated.timing(anticipationAnim, {
        toValue: 1,
        duration: ANTICIPATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Quick white flash = "impact" cue, cheap but sells the effect
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: FLASH_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: SHATTER_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shatterAnim, {
          toValue: 1,
          duration: SHATTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: COLLAPSE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false, // height is a layout prop, can't be native-driven
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onAnimationComplete?.();
    });

    return () => animation.stop();
    // Total: ~70 + 90 + 620 + 380 ≈ 1.16s — well inside a 2-3s budget with room to spare
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShattered]);

  const anticipationScale = anticipationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });
  const childrenOpacity = shatterAnim.interpolate({
    inputRange: [0, 0.12],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const childrenScale = shatterAnim.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });
  const flashOpacity = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  return (
    <Animated.View style={[styles.container, { height: heightAnim, width, transform: [{ scale: anticipationScale }] }]}>
      {/* Clipped layer: just the real card content, keeps rounded corners clean */}
      <Animated.View style={[styles.clip, { opacity: childrenOpacity, transform: [{ scale: childrenScale }] }]}>
        {children}
        {isShattered && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flashOpacity }]} />
        )}
      </Animated.View>

      {/* Unclipped layer: shards need to fly beyond the card's own bounds */}
      {isShattered && shards.length > 0 && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shardLayer]}>
          {shards.map((shard) => {
            const progress = shatterAnim.interpolate({
              inputRange: [0, shard.delay / SHATTER_MS, 1],
              outputRange: [0, 0, 1],
              extrapolate: 'clamp',
            });
            const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, shard.translateX] });
            const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, shard.translateY] });
            const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${shard.rotation}deg`] });
            const opacity = shatterAnim.interpolate({
              inputRange: [0, 0.08, 0.75, 1],
              outputRange: [0, 1, 1, 0],
              extrapolate: 'clamp',
            });
            const scale = shatterAnim.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [1, shard.scale * 1.15, shard.scale],
              extrapolate: 'clamp',
            });
            const bgColor = shard.isSparkle ? '#FFF' : shard.isGold ? '#FFD700' : glassColor;

            return (
              <Animated.View
                key={shard.id}
                style={{
                  position: 'absolute',
                  left: shard.left,
                  top: shard.top,
                  width: shard.width,
                  height: shard.height,
                  backgroundColor: bgColor,
                  borderRadius: shard.isSparkle ? shard.width / 2 : 1.5,
                  opacity,
                  transform: [{ translateX }, { translateY }, { rotate }, { scale }],
                  borderWidth: shard.isSparkle ? 0 : 0.5,
                  borderTopColor: shard.isHighlight ? 'rgba(255,255,255,0.55)' : 'rgba(255,215,0,0.2)',
                  borderLeftColor: shard.isHighlight ? 'rgba(255,255,255,0.35)' : 'rgba(255,215,0,0.2)',
                  borderRightColor: 'rgba(0,0,0,0.15)',
                  borderBottomColor: 'rgba(0,0,0,0.15)',
                }}
              />
            );
          })}
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
    overflow: 'hidden', // only clips during the final collapse — by then shards are already gone
  },
  clip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 16, // match your card's radius so the clipped content still looks clean
  },
  shardLayer: {
    overflow: 'visible',
  },
});
