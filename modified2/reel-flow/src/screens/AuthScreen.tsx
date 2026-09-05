import { useShallow } from 'zustand/react/shallow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, Text, StyleSheet, Alert, Linking, Dimensions, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { ShieldCheck, PlayCircle, LogIn } from 'lucide-react-native';
import { VIBIcon } from '../components/ui/VIBIcon';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAppStore } from '../store/useAppStore';
import { loginWithGoogle } from '../api/auth';
import { applyReferralCode } from '../api/referral';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOTION } from '../constants/theme';
import { FallingEmbers } from '../components/ui/FallingEmbers';
import { Shimmer } from '../components/ui/Shimmer';
import AutoMarquee from '../components/ui/AutoMarquee';

const FloatingChip = ({ text, delay = 0, style }: { text: React.ReactNode, delay?: number, style?: any }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Restarts itself forever via the .start() completion callback — 7 of
    // these chips are mounted at once on AuthScreen, none of it was ever
    // stopped on unmount, so navigating away (e.g. after a successful
    // login) left every chip's animation still ticking in the background.
    let stopped = false;
    let current: Animated.CompositeAnimation | null = null;

    const startFloating = () => {
      if (stopped) return;
      current = Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        })
      ]);
      current.start(({ finished }) => {
        if (finished && !stopped) startFloating();
      });
    };

    const timer = setTimeout(startFloating, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
      current?.stop();
    };
  }, [floatAnim, delay]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10]
  });

  const { transform: staticTransform, ...positionStyle } = style || {};

  return (
    <Animated.View style={[positionStyle, { position: 'absolute', zIndex: 10, transform: [{ translateY }] }]}>
      <View style={[styles.floatingChip, { position: 'relative', transform: staticTransform }]}>
        <Text style={styles.floatingChipText}>{text}</Text>
      </View>
    </Animated.View>
  );
};


const { width, height } = Dimensions.get('window');

const GoogleSignInButton = ({ onPress, loading }: { onPress: () => void; loading: boolean }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], width: '100%', marginBottom: 16 }}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
        onPress={onPress}
        disabled={loading}
        style={[styles.googleButton, loading && styles.buttonDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        <Svg width={22} height={22} viewBox="0 0 48 48" style={styles.googleIcon}>
          <Path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
          <Path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
          <Path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
          <Path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
        </Svg>
        <Text style={styles.googleButtonText}>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

export const AuthScreen = () => {
  const insets = useSafeAreaInsets();

  const { setUser } = useAppStore(useShallow(s => ({ setUser: s.setUser })));
  const [loading, setLoading] = useState(false);
  
  // Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const imageScale = useRef(new Animated.Value(0.8)).current;

  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
    });
  }, []);

  useEffect(() => {
    if (isImageLoaded) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.spring(imageScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [fadeAnim, slideAnim, imageScale, isImageLoaded]);

  const handleGoogleLogin = async () => {
    if (loading) return;
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) throw new Error('No ID Token received from Google Sign-In');

      const response = await loginWithGoogle(idToken);
      setUser(response.user, response.token);

      const savedReferral = await AsyncStorage.getItem('pendingReferralCode');
      if (savedReferral) {
        try {
          await applyReferralCode(savedReferral);
          await AsyncStorage.removeItem('pendingReferralCode');
        } catch (err) {
          console.error('Failed to apply referral:', err);
        }
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (error.code === statusCodes.IN_PROGRESS) return;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available or outdated');
      } else {
        Alert.alert('Login Failed', error.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const openLegal = (url?: string) => {
    if (!url) {
      Alert.alert('Link unavailable', 'This legal link has not been configured yet.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Could not open link'));
  };

  return (
    <View style={styles.root}>
      {/* Same Fiery Gradient as WelcomeScreen */}
      <LinearGradient 
        colors={['#e75d0b', '#0d0002', '#000000', '#000000']} 
        locations={[0, 0.4, 0.65, 1]}
        style={StyleSheet.absoluteFill} 
      />
      
      {/* Falling Sparks/Embers Effect - Deferred to prevent JS thread blocking on mount */}
      {isImageLoaded && <FallingEmbers />}
      
      <Animated.View style={[styles.container, { paddingTop: Math.max(insets.top, 60), opacity: fadeAnim, transform: [{ translateY: slideAnim }], zIndex: 2 }]}>
        
        {/* Animated Brand Image Area */}
        <View style={styles.brandArea}>
          <Animated.View style={[styles.imageGlowContainer, { transform: [{ scale: imageScale }] }]}>
            
            {/* Scattered Organic Chips Layer - Deferred */}
            {isImageLoaded && (
              <>
                <FloatingChip text={<View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{color: '#FFD700', fontWeight: 'bold'}}>+500 </Text><VIBIcon size={14} /></View>} delay={0} style={{ top: 15, left: -10, transform: [{ rotate: '-5deg' }, { scale: 1.05 }] }} />
                <FloatingChip text="Daily Quests" delay={600} style={{ bottom: 40, left: -25, transform: [{ rotate: '8deg' }, { scale: 0.95 }] }} />
                <FloatingChip text="Rewards" delay={1200} style={{ top: 60, right: -15, transform: [{ rotate: '12deg' }, { scale: 1.1 }] }} />
                
                <FloatingChip text="🔥 Hot" delay={300} style={{ top: -45, left: 30, transform: [{ rotate: '-18deg' }, { scale: 0.85 }] }} />
                <FloatingChip text="🎬 Shorts" delay={1500} style={{ top: 90, left: -85, transform: [{ rotate: '5deg' }, { scale: 0.9 }] }} />
                
                <FloatingChip text="📰 News" delay={900} style={{ top: -10, right: -85, transform: [{ rotate: '-8deg' }, { scale: 1.05 }] }} />
                <FloatingChip text="🎭 Entertainment" delay={2000} style={{ bottom: 10, right: -70, transform: [{ rotate: '14deg' }, { scale: 0.85 }] }} />
              </>
            )}

            {/* The Quest Box Image */}
            <Image
              source={require('../../assets/images/chest.webp')}
              style={styles.heroImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              onLoad={() => setIsImageLoaded(true)}
            />
          </Animated.View>
          <Text style={styles.title}>Sign in to ReelFlow</Text>
          <Text style={styles.subtitle}>Unlock daily rewards and exclusive tasks.</Text>
        </View>

        {/* Trust Badges */}
        <View style={styles.badgesContainer}>
          <View style={styles.trustBadge}>
            <PlayCircle size={18} color="#FFD700" />
            <View>
              <Text style={styles.trustBadgeTitle}>Watch & Earn</Text>
              <Text style={styles.trustBadgeSub}>Turn screen time into rewards</Text>
            </View>
          </View>
          
          <View style={styles.trustBadge}>
            <ShieldCheck size={18} color="#FFD700" />
            <View>
              <Text style={styles.trustBadgeTitle}>100% Safe</Text>
              <Text style={styles.trustBadgeSub}>Trusted Platform</Text>
            </View>
          </View>
        </View>

        {/* Running Marquee Text below Badges - Deferred */}
        {isImageLoaded && <AutoMarquee />}

        {/* Login Area */}
        <View style={styles.actionArea}>
          <GoogleSignInButton onPress={handleGoogleLogin} loading={loading} />
          
          <Text style={styles.legalText}>
            By continuing, you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => openLegal(process.env.EXPO_PUBLIC_TERMS_URL)}>Terms</Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => openLegal(process.env.EXPO_PUBLIC_PRIVACY_URL)}>Privacy</Text>.
          </Text>
        </View>

      </Animated.View>

      {/* Shimmer Loading Overlay */}
      {!isImageLoaded && (
        <View style={styles.shimmerOverlay}>
          <View style={styles.brandArea}>
            <Shimmer width={240} height={240} borderRadius={120} style={{ marginBottom: 20 }} />
            <Shimmer width={220} height={32} borderRadius={8} style={{ marginBottom: 12 }} />
            <Shimmer width={180} height={20} borderRadius={4} />
          </View>
          
          <View style={{ paddingHorizontal: 24, marginTop: 20, gap: 12 }}>
            <Shimmer width={'100%'} height={72} borderRadius={16} />
            <Shimmer width={'100%'} height={72} borderRadius={16} />
          </View>

          <View style={styles.actionArea}>
            <Shimmer width={'100%'} height={56} borderRadius={28} style={{ marginBottom: 16 }} />
            <Shimmer width={240} height={16} borderRadius={4} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0D17',
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  brandArea: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
  },
  imageGlowContainer: {
    width: 240, // Reduced from 280
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
  },
  badgesContainer: {
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 24,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  trustBadgeTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  trustBadgeSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  actionArea: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  googleButton: {
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  googleIcon: {
    width: 22,
    height: 22,
    position: 'absolute',
    left: 24, // Keeps icon on the left while text centers perfectly
  },
  googleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  floatingChip: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    zIndex: 10,
  },
  floatingChipText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  legalText: {
    color: '#716687',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
  },
  legalLink: {
    color: '#FFD700',
    fontWeight: '600',
  },
});

export default AuthScreen;
