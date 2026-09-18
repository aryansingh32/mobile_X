import React, { useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { FallingEmbers } from '../components/ui/FallingEmbers';
import { useReducedMotion } from '../hooks/useReducedMotion';

const { height } = Dimensions.get('window');

type WelcomeScreenProps = {
  onGetStarted: () => void;
  onLogin: () => void;
};

// One line of the "Welcome to / ReelFlow / tagline / subtitle" stack — each
// enters on its own staggered beat instead of the whole block fading in at
// once, so the brand name gets a beat of its own to land.
const StaggeredLine = ({ anim, style, children }: { anim: Animated.Value; style?: any; children: React.ReactNode }) => (
  <Animated.View
    style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
    }}
  >
    <Text style={style}>{children}</Text>
  </Animated.View>
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted, onLogin }) => {
  const reducedMotion = useReducedMotion();

  // WelcomeScreen always mounts immediately after SplashScreen, which already
  // played the hero's pop-in (centered, full scale/opacity) and has the same
  // gradient/embers running. Replaying that pop-in here (starting the hero
  // back at scale 0) made the hero visibly vanish and re-grow right after
  // splash — the "blank gap" between splash and content. So the hero starts
  // already fully visible/at-rest here, and only the shift-up + text-reveal
  // (which splash never showed) plays, continuing the same animation instead
  // of restarting it.
  const heroTranslateY = useRef(new Animated.Value(height * 0.18)).current; // Start lowered (centered)
  const footerFade = useRef(new Animated.Value(0)).current;
  const footerSlide = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const lineAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!reducedMotion) {
      // Pulse background rings + breathing atmosphere glow — endless, purely
      // decorative, skipped entirely under Reduce Motion.
      const pulseLoop = Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      );
      pulseLoop.start();
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      glowLoop.start();
      return () => {
        pulseLoop.stop();
        glowLoop.stop();
      };
    }
  }, [pulseAnim, glowAnim, reducedMotion]);

  useEffect(() => {
    // Shift hero UP, then reveal each text line on its own beat, then the
    // footer — a one-shot entrance sequence, plays regardless of Reduce
    // Motion (it's a single transition, not a persistent loop).
    Animated.sequence([
      Animated.parallel([
        Animated.spring(heroTranslateY, { toValue: 0, friction: 14, tension: 20, useNativeDriver: true }),
        Animated.stagger(90, lineAnims.map((a) => Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }))),
      ]),
      Animated.parallel([
        Animated.timing(footerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(footerSlide, { toValue: 0, friction: 14, tension: 20, useNativeDriver: true }),
      ]),
    ]).start();
  }, [heroTranslateY, footerFade, footerSlide, lineAnims]);

  const pulseScale1 = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const pulseOpacity1 = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const pulseScale2 = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const pulseOpacity2 = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.32] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.root}>
      {/* Depth 0 — Fiery Gradient Background */}
      <LinearGradient
        colors={['#e75d0b', '#0d0002', '#000000', '#000000']}
        locations={[0, 0.4, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Depth 1 — atmosphere: breathing glow behind the text stack, faked as
          3 concentric falloff rings since RN has no blur without a native
          module, plus embers */}
      <Animated.View pointerEvents="none" style={[styles.atmosphereGlowWrap, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
        <View style={[styles.atmosphereGlowRing, { width: 420, height: 420, borderRadius: 210, opacity: 0.10 }]} />
        <View style={[styles.atmosphereGlowRing, { width: 300, height: 300, borderRadius: 150, opacity: 0.16 }]} />
        <View style={[styles.atmosphereGlowRing, { width: 180, height: 180, borderRadius: 90, opacity: 0.22 }]} />
      </Animated.View>
      {!reducedMotion && <FallingEmbers topToBottom />}

      {/* Depth 2/3 — Hero Section (Animates from center to top) */}
      <Animated.View style={[styles.content, { paddingBottom: 0, paddingTop: height * 0.05, flex: 0, transform: [{ translateY: heroTranslateY }] }]}>
        <View style={styles.heroSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale1 }], opacity: pulseOpacity1 }]} />
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale2 }], opacity: pulseOpacity2 }]} />

          <Image
            source={require('../../assets/images/welcome-hero.webp')}
            style={styles.heroImage}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
      </Animated.View>

      {/* Depth 4 — Text, staggered line by line */}
      <View style={[styles.content, { paddingTop: 0, zIndex: 2 }]}>
        <View style={styles.textContainer}>
          <StaggeredLine anim={lineAnims[0]} style={styles.welcomeText}>Welcome to</StaggeredLine>
          <View style={styles.brandRow}>
            <StaggeredLine anim={lineAnims[1]} style={styles.brandText}>ReelFlow</StaggeredLine>
          </View>
          <StaggeredLine anim={lineAnims[2]} style={styles.tagline}>Watch. Earn. Repeat.</StaggeredLine>
          <StaggeredLine anim={lineAnims[3]} style={styles.subtitle}>Turn your screen time into real rewards.</StaggeredLine>
        </View>
      </View>

      <Animated.View style={[styles.footer, { opacity: footerFade, transform: [{ translateY: footerSlide }] }]}>
        <TouchableOpacity style={styles.button} onPress={onGetStarted} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Get Started</Text>
          <ArrowRight color="#000" size={18} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onLogin} style={{ marginTop: 16 }}>
           <Text style={styles.loginLink}>Have an account? <Text style={{ color: '#FFD700', fontWeight: '800' }}>Login</Text></Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0D17',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: height * 0.05,
  },
  atmosphereGlowWrap: {
    position: 'absolute',
    top: height * 0.34 - 210,
    left: '50%',
    marginLeft: -210,
    width: 420,
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atmosphereGlowRing: {
    position: 'absolute',
    backgroundColor: '#FFD700',
  },
  heroSection: {
    width: '130%',
    height: height * 0.40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  pulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: '#FFD700',
    zIndex: 1,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 50,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#FFD700',
    width: '100%',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  loginLink: {
    color: '#A296BA',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default WelcomeScreen;
