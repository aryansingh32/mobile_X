import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle } from 'lucide-react-native';
import { VIBIcon } from './VIBIcon';
import { MOTION } from '../../constants/theme';

type RewardCardProps = {
  coins: number;
  onWatch: () => void;
  onSkip?: () => void;
  duration?: string;
  claimed?: boolean;
};

const RewardCard = ({ coins, onWatch, onSkip, duration = '~30 seconds', claimed = false }: RewardCardProps) => {
  const watchScale = useRef(new Animated.Value(1)).current;
  const onWatchPressIn = () => {
    Animated.spring(watchScale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  const onWatchPressOut = () => {
    Animated.spring(watchScale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  return (
    <LinearGradient
      colors={
        claimed
          ? ['rgba(120, 80, 20, 0.25)', 'rgba(80, 50, 10, 0.1)']
          : ['rgba(255, 77, 26, 0.15)', 'rgba(231, 93, 11, 0.05)']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, claimed && styles.cardClaimed]}
    >
      {/* Left Icon Area — VIB logo */}
      <View style={styles.iconContainer}>
        <View style={[styles.iconGlow, claimed && styles.iconGlowClaimed]}>
          <VIBIcon size={36} />
        </View>
      </View>

      {/* Middle Text Area */}
      <View style={styles.textContainer}>
        <Text style={styles.label}>SPONSORED</Text>
        <Text style={styles.title}>
          {claimed ? `Reward Claimed` : (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={{color: '#FFFFFF', fontSize: 13, fontWeight: '700'}}>Watch & Earn {coins} </Text>
              <VIBIcon size={14} style={{ transform: [{ translateY: 0 }] }} />
            </View>
          )}
        </Text>
        <Text style={styles.subtitle}>
          {claimed ? 'Come back tomorrow for more rewards' : "Don't skip — watch all the way"}
        </Text>
        {!claimed && <Text style={styles.duration}>{duration}</Text>}
      </View>

      {/* Right Area */}
      <View style={styles.rightContainer}>
        <View style={styles.vibAmountRow}>
          <VIBIcon size={14} style={{ marginRight: 3 }} />
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
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 26, 0.4)',
  },
  cardClaimed: {
    borderColor: 'rgba(160, 112, 32, 0.35)',
  },
  iconContainer: {
    marginRight: 14,
  },
  iconGlow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  iconGlowClaimed: {
    backgroundColor: 'rgba(160, 112, 32, 0.15)',
    borderColor: 'rgba(160, 112, 32, 0.4)',
    shadowColor: '#A07020',
  },
  vibIcon: {
    width: 36,
    height: 36,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
    lineHeight: 18,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    lineHeight: 15,
  },
  duration: {
    color: 'rgba(255,215,0,0.6)',
    fontSize: 10,
    marginTop: 3,
  },
  rightContainer: {
    alignItems: 'center',
    marginLeft: 10,
    gap: 7,
  },
  vibAmountRow: {
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