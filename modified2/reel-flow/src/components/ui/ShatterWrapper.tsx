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
}

// Tune these to trade off polish vs perf
const COLS = 6;
const ROWS = 8;
const SHATTER_MS = 620;   // shards flying apart
const COLLAPSE_MS = 380;  // card height collapsing to reveal item below
const FLASH_MS = 90;      // quick white "impact" flash before the break

export const ShatterWrapper: React.FC<ShatterWrapperProps> = ({
  children, isShattered, onAnimationComplete, width, height, glassColor = 'rgba(26, 26, 46, 0.95)',
}) => {
  const [shards, setShards] = useState<Shard[]>([]);
  const shatterAnim = useRef(new Animated.Value(0)).current; // native driver
  const flashAnim = useRef(new Animated.Value(0)).current;   // native driver
  const heightAnim = useRef(new Animated.Value(height)).current; // JS driver (layout)

  useEffect(() => {
    // Pick a random "impact point" — shards fly radially outward from here,
    // which is what makes it read as glass breaking instead of confetti.
    const impactX = width * (0.3 + Math.random() * 0.4);
    const impactY = height * (0.3 + Math.random() * 0.4);

    const shardW = width / COLS;
    const shardH = height / ROWS;
    const maxDist = Math.hypot(width, height);
    const pieces: Shard[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
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
        const flight = 140 + dist * 0.85 + Math.random() * 140;
        const gravityDrop = 60 + proximity * 120;

        const isSparkle = Math.random() > 0.88;
        const isGold = Math.random() > 0.88;

        pieces.push({
          id: `${r}-${c}`,
          left: c * shardW,
          top: r * shardH,
          width: shardW * (isSparkle ? 0.4 : (0.55 + Math.random() * 0.5)),
          height: shardH * (isSparkle ? 0.4 : (0.55 + Math.random() * 0.5)),
          translateX: ux * flight + (Math.random() - 0.5) * 60,
          translateY: uy * flight + gravityDrop,
          rotation: (Math.random() - 0.5) * (400 + proximity * 700),
          scale: Math.random() * 0.4 + (isSparkle ? 1.4 : 0.5),
          delay: Math.random() * 40, // tiny stagger so it doesn't pop as one block
          isSparkle,
          isGold,
        });
      }
    }
    setShards(pieces);
  }, [width, height]);

  useEffect(() => {
    if (!isShattered) return;

    Animated.sequence([
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
    ]).start(() => onAnimationComplete?.());
    // Total: ~90 + 620 + 380 ≈ 1.1s — well inside your 2-3s budget with room to spare
  }, [isShattered]);

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
    <Animated.View style={[styles.container, { height: heightAnim, width }]}>
      {/* Clipped layer: just the real card content, keeps rounded corners clean */}
      <Animated.View style={[styles.clip, { opacity: childrenOpacity, transform: [{ scale: childrenScale }] }]}>
        {children}
        {isShattered && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flashOpacity }]} />
        )}
      </Animated.View>

      {/* Unclipped layer: shards need to fly beyond the card's own bounds */}
      {isShattered && (
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
                  borderColor: 'rgba(255,215,0,0.2)',
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