import React, { useRef, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Image, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { FallingEmbers } from '../components/ui/FallingEmbers';

const { height } = Dimensions.get('window');

type WelcomeScreenProps = {
  onGetStarted: () => void;
  onLogin: () => void;
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted, onLogin }) => {
  // Splash phase: Hero image centered
  // Welcome phase: Hero image shifted up, text faded in
  const [isSplashPhase, setIsSplashPhase] = useState(true);

  // Animated values
  const heroScale = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(height * 0.18)).current; // Start lowered (centered)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Initial Splash Animation (Hero Pop-In - slower)
    Animated.spring(heroScale, {
      toValue: 1,
      tension: 25,
      friction: 12,
      useNativeDriver: true,
    }).start();

    // 2. Pulse background rings endlessly
    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    pulseLoop.start();

    // 3. Transition to Welcome Phase (Shift UP & Fade In)
    const transitionTimer = setTimeout(() => {
      setIsSplashPhase(false);
      
      Animated.parallel([
        // Smoothly shift the hero image UP to its final position (slower spring)
        Animated.spring(heroTranslateY, {
          toValue: 0,
          friction: 14,
          tension: 20,
          useNativeDriver: true,
        }),
        // Fade in the text and buttons (slower fade)
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        // Slide up the text and buttons (slower spring)
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 14,
          tension: 20,
          useNativeDriver: true,
        }),
      ]).start();
    }, 2000); // Hold splash for 2 seconds

    return () => {
      clearTimeout(transitionTimer);
      pulseLoop.stop();
    };
  }, [heroScale, heroTranslateY, fadeAnim, slideAnim, pulseAnim]);

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
    <View style={styles.root}>
      {/* Fiery Gradient Background */}
      <LinearGradient 
        colors={['#e75d0b', '#0d0002', '#000000', '#000000']} 
        locations={[0, 0.4, 0.65, 1]}
        style={StyleSheet.absoluteFill} 
      />
      
      {/* Falling Sparks/Embers Effect - Top to bottom while in splash phase */}
      <FallingEmbers topToBottom={isSplashPhase} />
      
      {/* Hero Section (Animates from center to top) */}
      <Animated.View style={[styles.content, { paddingBottom: 0, paddingTop: height * 0.05, flex: 0, transform: [{ translateY: heroTranslateY }] }]}>
        <View style={styles.heroSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale1 }], opacity: pulseOpacity1 }]} />
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale2 }], opacity: pulseOpacity2 }]} />
          
          <Animated.Image 
            source={require('../../assets/images/welcome-hero.png')} 
            style={[styles.heroImage, { transform: [{ scale: heroScale }] }]}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Text and Button Section (Fades in after shifting up) */}
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingTop: 0, zIndex: 2 }]}>
        <View style={styles.textContainer}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>ReelFlow</Text>
          </View>
          <Text style={styles.tagline}>Watch. Earn. Repeat.</Text>
          <Text style={styles.subtitle}>Turn your screen time into real rewards.</Text>
        </View>

        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
  dotsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  dot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  dotActive: {
    backgroundColor: '#FFD700',
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
