import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { VIBIcon } from './VIBIcon';
import { COLORS, RADIUS } from '../../constants/theme';
import { triggerHaptic } from '../../utils/haptics';

type GiftBoxBurstProps = {
  size?: number;
  onOpened?: () => void;
};

const COIN_COUNT = 10;

/**
 * Plays automatically on mount, once:
 *   1. Box fades/scales in
 *   2. Box shakes side to side while the glow ring behind it ramps up
 *   3. Lid pops open (rotates + flies up + fades) from the box's center —
 *      coins burst outward/upward from that same point at the same moment
 *   4. The whole illustration settles ~16px higher to make room for the
 *      text/buttons that animate in after (see WelcomeScreen/AllSetScreen —
 *      they start their own text stagger in `onOpened`)
 *
 * Built from plain Views + emoji coin particles (no illustration assets
 * exist in the project) — see the report for why a licensed illustration
 * set would get closer to the reference images' exact look.
 */
export const GiftBoxBurst: React.FC<GiftBoxBurstProps> = ({ size = 140, onOpened }) => {
  const boxScale = useRef(new Animated.Value(0.7)).current;
  const boxOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const lidRotate = useRef(new Animated.Value(0)).current;
  const lidTranslateY = useRef(new Animated.Value(0)).current;
  const lidOpacity = useRef(new Animated.Value(1)).current;
  const bodyBounce = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  const coins = useMemo(
    () => Array.from({ length: COIN_COUNT }, (_, index) => {
      const angle = (index / COIN_COUNT) * Math.PI - Math.PI / 2 - 0.3; // fan upward/outward
      const distance = size * (0.55 + (index % 3) * 0.12);
      return {
        id: index,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - size * 0.2,
        rotation: `${((index * 47) % 360) - 180}deg`,
        delay: (index % 4) * 40,
      };
    }),
    [size],
  );
  const coinAnims = useRef(coins.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Entrance
      Animated.parallel([
        Animated.spring(boxScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
        Animated.timing(boxOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // 2. Shake + glow ramping up (anticipation before opening)
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(shakeX, { toValue: -8, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 8, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -6, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 6, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -3, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 55, useNativeDriver: true }),
        ]),
      ]),
      // 3. Open: lid flies up/off from the box's center while coins burst
      Animated.parallel([
        Animated.timing(lidRotate, { toValue: -32, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lidTranslateY, { toValue: -34, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lidOpacity, { toValue: 0, duration: 320, delay: 80, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(bodyBounce, { toValue: 1.08, duration: 160, useNativeDriver: true }),
          Animated.spring(bodyBounce, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        ]),
        Animated.timing(glowScale, { toValue: 1.35, duration: 380, useNativeDriver: true }),
        ...coinAnims.map((anim, index) => Animated.timing(anim, {
          toValue: 1,
          duration: 650,
          delay: coins[index].delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })),
      ]),
      // 4. Settle — lift the whole illustration to make room for text below
      Animated.parallel([
        Animated.spring(lift, { toValue: -16, useNativeDriver: true, tension: 60, friction: 9 }),
        Animated.timing(glowOpacity, { toValue: 0.5, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    triggerHaptic('impact-light', 'haptics_welcome');
    const openHapticTimer = setTimeout(() => {
      triggerHaptic('success', 'haptics_welcome');
      onOpened?.();
    }, 900);

    return () => clearTimeout(openHapticTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.root,
        { width: size, height: size, opacity: boxOpacity, transform: [{ translateY: lift }, { scale: boxScale }] },
      ]}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
        {/* Bow */}
        <View style={styles.bow} />

        {/* Lid — rotates/flies up and fades as the box "opens" */}
        <Animated.View
          style={[
            styles.lid,
            {
              width: size * 0.62,
              opacity: lidOpacity,
              transform: [
                { translateY: lidTranslateY },
                { rotate: lidRotate.interpolate({ inputRange: [-32, 0], outputRange: ['-32deg', '0deg'] }) },
              ],
            },
          ]}
        />

        {/* Body */}
        <Animated.View
          style={[
            styles.body,
            { width: size * 0.56, height: size * 0.38, transform: [{ scale: bodyBounce }] },
          ]}
        >
          <View style={styles.ribbon} />
          <Sparkles color="#111111" size={16} style={{ opacity: 0.5 }} />
        </Animated.View>
      </Animated.View>

      {/* Coins bursting from the box's opening point */}
      {coins.map((coin, index) => {
        const anim = coinAnims[index];
        const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, coin.x] });
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, coin.y] });
        const scale = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 1.15, 0.2] });
        const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={coin.id}
            style={[
              styles.coin,
              { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: coin.rotation }] },
            ]}
          >
            <VIBIcon size={24} animated={false} />
          </Animated.View>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: COLORS.yellow_dim,
    borderWidth: 1,
    borderColor: COLORS.border_active,
  },
  bow: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.orange,
    zIndex: 2,
  },
  lid: {
    height: 18,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.yellow,
    alignSelf: 'center',
    marginBottom: -4,
    zIndex: 1,
  },
  body: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ribbon: {
    position: 'absolute',
    width: 10,
    height: '100%',
    backgroundColor: COLORS.orange,
    opacity: 0.7,
  },
  coin: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
});

export default GiftBoxBurst;
