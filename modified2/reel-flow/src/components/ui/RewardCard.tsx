import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Gem } from 'lucide-react-native';
import { MOTION } from '../../constants/theme';

type RewardCardProps = {
  coins: number;
  onWatch: () => void;
  onSkip?: () => void;
  duration?: string;
  claimed?: boolean;
  claimedSubtitle?: string;
};

const RewardCard = ({ coins, onWatch, onSkip, duration = '~30 seconds', claimed = false, claimedSubtitle }: RewardCardProps) => {
  const watchScale = useRef(new Animated.Value(1)).current;
  const onWatchPressIn = () => {
    Animated.spring(watchScale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  const onWatchPressOut = () => {
    Animated.spring(watchScale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };

  // A slow breathing glow behind the badge — the one thing on this card that
  // should never sit perfectly still while it's still asking to be tapped.
  // Pure opacity/scale (GPU-safe), stopped and unmounted once claimed.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (claimed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [claimed, pulseAnim]);
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <LinearGradient
      colors={claimed ? ['#2A2113', '#181209'] : ['#3A1508', '#1C0A16', '#0E0A16']}
      locations={claimed ? undefined : [0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, claimed && styles.cardClaimed]}
    >
      {/* Atmosphere — soft warm glow anchored top-right, never fully flat */}
      <View pointerEvents="none" style={[styles.glowBlob, claimed && styles.glowBlobClaimed]} />

      {/* Badge — a drawn gem, not a brand mark, so this card never depends on
          any specific logo asset to read as "reward". */}
      <View style={styles.iconContainer}>
        {!claimed && (
          <Animated.View
            pointerEvents="none"
            style={[styles.pulseRing, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
          />
        )}
        <LinearGradient
          colors={claimed ? ['rgba(160,112,32,0.28)', 'rgba(160,112,32,0.08)'] : ['#FFE47A', '#FFB800']}
          style={[styles.iconGlow, claimed && styles.iconGlowClaimed]}
        >
          <Gem size={22} color={claimed ? '#A07020' : '#3A1C00'} strokeWidth={2.2} fill={claimed ? 'transparent' : '#3A1C00'} fillOpacity={claimed ? 0 : 0.12} />
        </LinearGradient>
      </View>

      {/* Middle Text Area */}
      <View style={styles.textContainer}>
        <View style={[styles.sponsoredPill, claimed && styles.sponsoredPillClaimed]}>
          <Text style={[styles.sponsoredPillText, claimed && styles.sponsoredPillTextClaimed]}>SPONSORED</Text>
        </View>
        {claimed ? (
          <Text style={styles.title}>Reward Claimed</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.title}>Watch & Earn {coins}</Text>
            <Gem size={12} color="#FFD700" style={{ marginLeft: 4 }} />
          </View>
        )}
        <Text style={styles.subtitle}>
          {claimed ? (claimedSubtitle || 'Come back tomorrow for more rewards') : "Don't skip — watch all the way"}
        </Text>
        {!claimed && <Text style={styles.duration}>{duration}</Text>}
      </View>

      {/* Right Area */}
      <View style={styles.rightContainer}>
        <View style={styles.gemAmountRow}>
          <Gem size={13} color="#FFD700" style={{ marginRight: 3 }} />
          <Text style={styles.reward}>{coins}</Text>
        </View>
        {claimed ? (
          <View style={styles.claimedBadge}>
            <CheckCircle size={14} color="#A07020" style={{ marginRight: 4 }} />
            <Text style={styles.claimedText}>Claimed</Text>
          </View>
        ) : (
          <>
            <Animated.View style={{ transform: [{ scale: watchScale }] }}>
              <Pressable
                style={styles.watchButton}
                onPress={onWatch}
                onPressIn={onWatchPressIn}
                onPressOut={onWatchPressOut}
              >
                <Text style={styles.watchText}>Watch Now</Text>
              </Pressable>
            </Animated.View>
            {onSkip && (
              <Pressable onPress={onSkip} style={({ pressed }) => [styles.skipBtn, pressed && styles.pressedDim]}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.35)',
    overflow: 'hidden',
  },
  cardClaimed: {
    borderColor: 'rgba(160, 112, 32, 0.3)',
  },
  glowBlob: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 140, 0, 0.16)',
  },
  glowBlobClaimed: {
    backgroundColor: 'rgba(160, 112, 32, 0.08)',
  },
  iconContainer: {
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  iconGlow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  iconGlowClaimed: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(160, 112, 32, 0.4)',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  sponsoredPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 184, 0, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  sponsoredPillClaimed: {
    backgroundColor: 'rgba(160, 112, 32, 0.12)',
    borderColor: 'rgba(160, 112, 32, 0.3)',
  },
  sponsoredPillText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sponsoredPillTextClaimed: {
    color: '#A07020',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
    lineHeight: 18,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    lineHeight: 15,
  },
  duration: {
    color: 'rgba(255,215,0,0.65)',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
  rightContainer: {
    alignItems: 'center',
    marginLeft: 10,
    gap: 7,
  },
  gemAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reward: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '800',
  },
  watchButton: {
    backgroundColor: '#FF4D1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  watchText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(160, 112, 32, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(160, 112, 32, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  claimedText: {
    color: '#A07020',
    fontSize: 12,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 2,
  },
  skipText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  pressedDim: {
    opacity: 0.75,
  },
});

export default RewardCard;
