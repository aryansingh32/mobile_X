import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { VIBIcon } from './VIBIcon';
import { triggerHaptic } from '../../utils/haptics';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';

type CoinRainProps = {
  visible: boolean;
  amount: number;
  onComplete?: () => void;
};

const { width, height } = Dimensions.get('window');

const CoinRain = ({ visible, amount, onComplete }: CoinRainProps) => {
  const [rendered, setRendered] = useState(false);
  const particles = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      id: index,
      x: (Math.random() - 0.5) * width * 0.75,
      y: -80 - Math.random() * height * 0.28,
      rotation: `${Math.round((Math.random() - 0.5) * 360)}deg`,
      delay: Math.random() * 90,
    })),
    [],
  );
  const particleAnims = useRef(particles.map(() => new Animated.Value(0))).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    setRendered(true);
    triggerHaptic('success', 'haptics_ad_reward');
    particleAnims.forEach(anim => anim.setValue(0));
    badgeAnim.setValue(0);

    Animated.parallel([
      ...particleAnims.map((anim, index) => Animated.timing(anim, {
        toValue: 1,
        duration: 800,
        delay: particles[index].delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })),
      Animated.timing(badgeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      setRendered(false);
      onComplete?.();
    }, 1200);

    return () => clearTimeout(timer);
  }, [badgeAnim, onComplete, particleAnims, particles, visible]);

  if (!rendered) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.center}>
        {particles.map((particle, index) => {
          const anim = particleAnims[index];
          const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x] });
          const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y] });
          const scale = anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.5, 1.2, 0] });
          const opacity = anim.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 0.9, 0] });

          return (
            <Animated.View
              key={particle.id}
              style={[
                styles.particle,
                { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: particle.rotation }] },
              ]}
            >
              <VIBIcon size={32} animated={false} />
            </Animated.View>
          );
        })}

        <Animated.View
          style={[
            styles.badge,
            {
              opacity: badgeAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, -80] }) }],
            },
          ]}
        >
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.badgeText}>+{amount} </Text>
            <VIBIcon size={18} style={{ transform: [{ translateY: 0 }] }} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  badge: {
    position: 'absolute',
    minWidth: 112,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border_active,
    backgroundColor: COLORS.bg_elevated,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    ...SHADOW.glow_yellow,
  },
  badgeText: {
    color: COLORS.yellow,
    fontSize: 18,
    fontWeight: '900',
  },
});

export default CoinRain;
