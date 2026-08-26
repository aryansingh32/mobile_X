import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedProgressBar from '../components/ui/AnimatedProgressBar';
import { COLORS, SPACING } from '../constants/theme';
import { FallingEmbers } from '../components/ui/FallingEmbers';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Redesigned Premium Splash Screen
 * Inspired by the Welcome Screen's dynamic, fiery aesthetics.
 */
const SplashScreen = ({ onFinish }: { onFinish?: () => void }) => {
  const [animFinished, setAnimFinished] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const TOTAL_IMAGES = 2;

  useEffect(() => {
    if (animFinished && imagesLoaded >= TOTAL_IMAGES) {
      onFinish?.();
    }
  }, [animFinished, imagesLoaded, onFinish]);

  // ── Animated values ──────────────────────────────────────────────────
  const heroScale = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(24)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const [counterValue, setCounterValue] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // ── Main animation sequence ─────────────────────────────────────
    Animated.sequence([
      Animated.parallel([
        Animated.spring(heroScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      // 3. Optional staggered elements if any (kept empty as we removed text)
      Animated.stagger(200, []),
    ]).start();

    // ── Gentle pulse on the background rings ──────────────────────────
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();

    // ── Pre-loader timeout ────────────────────────────────────
    const timers = [
      setTimeout(() => setAnimFinished(true), 2500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [
    heroScale,
    heroOpacity,
    titleY,
    titleOpacity,
    taglineOpacity,
    bottomOpacity,
    pulseAnim,
  ]);

  const pulseScale1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5]
  });
  const pulseOpacity1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0]
  });

  const pulseScale2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8]
  });
  const pulseOpacity2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0]
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden translucent backgroundColor="transparent" />

      {/* Hidden image preloader to ensure Welcome/Auth screens render instantly without shimmering. 
          The splash screen will remain visible until these are cached! */}
      <View style={{ position: 'absolute', left: -10000, width: 1, height: 1 }} pointerEvents="none">
        <Image 
          source={require('../../assets/images/chest.png')} 
          onLoad={() => setImagesLoaded(c => c + 1)}
          onError={() => setImagesLoaded(c => c + 1)} // fallback to proceed anyway
        />
        <Image 
          source={require('../../assets/images/welcome-hero.png')} 
          onLoad={() => setImagesLoaded(c => c + 1)}
          onError={() => setImagesLoaded(c => c + 1)}
        />
      </View>

      {/* Fiery Gradient Background fading into dark theme */}
      <LinearGradient 
        colors={['#e75d0b', '#0d0002', '#000000', '#000000']} 
        locations={[0, 0.4, 0.65, 1]}
        style={StyleSheet.absoluteFill} 
      />
      
      {/* Falling Sparks/Embers Effect */}
      <FallingEmbers topToBottom={true} />

      {/* Center content */}
      <View style={styles.center}>
        
        <View style={styles.heroSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale1 }], opacity: pulseOpacity1 }]} />
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale2 }], opacity: pulseOpacity2 }]} />
          
          <Animated.Image 
            source={require('../../assets/images/welcome-hero.png')} 
            style={[
              styles.heroImage,
              {
                opacity: heroOpacity,
                transform: [{ scale: heroScale }]
              }
            ]}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
};



// ── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D17',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SCREEN_HEIGHT * 0.05,
  },
  heroSection: {
    width: '130%', 
    height: SCREEN_HEIGHT * 0.40, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#FFD700',
    zIndex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandText: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tagline: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: '#A296BA',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: 60,
    alignItems: 'center',
    gap: SPACING.xl,
  },
  counterCard: {
    backgroundColor: 'rgba(231, 93, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(231, 93, 11, 0.25)',
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    minWidth: SCREEN_WIDTH * 0.55,
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A296BA',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFD700',
  },
  counterCoin: {
    fontSize: 28,
  },
  progressWrapper: {
    width: '100%',
  },
});

export default SplashScreen;
