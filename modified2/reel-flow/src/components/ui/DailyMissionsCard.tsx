import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { Coins, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedProgressBar from './AnimatedProgressBar';
import { VIBIcon } from './VIBIcon';
import QuestBoxHero from './QuestBoxHero';

type Mission = {
  id: string | number;
  title: string;
  progress: number;
  targetCount?: number;
  target?: number;
  rewardCoins?: number;
  reward?: number;
  completed?: boolean;
  claimed?: boolean;
};

type DailyMissionsCardProps = {
  missions: Mission[];
  onMoreMissions: () => void;
  onClaimReward: (missionId: string | number) => void;
};

export const DailyMissionsCard = ({ missions, onMoreMissions, onClaimReward }: DailyMissionsCardProps) => {
  const rippleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rippleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(rippleAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    rippleLoop.start();
    return () => rippleLoop.stop();
  }, [rippleAnim]);

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.6],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  return (
    <LinearGradient
      colors={['rgba(255,215,0,0.15)', 'rgba(231,93,11,0.05)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Yellow left accent border */}
      <View style={styles.leftAccent} />

      {/* Top Header Section */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Daily Missions</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.subtitle}>Complete all missions to get bonus </Text>
            <VIBIcon size={12} animated />
          </View>
          <TouchableOpacity style={styles.moreButton} onPress={onMoreMissions}>
            <Text style={styles.moreButtonText}>View All</Text>
            <ChevronRight color="#A78BFA" size={14} />
          </TouchableOpacity>
        </View>

        <View style={styles.chestContainer}>
          <QuestBoxHero size={110} autoPlay={true} />
        </View>
      </View>

      {/* Mission Items */}
      <View style={styles.missionsContainer}>
        {missions.length === 0 ? (
          <Text style={styles.emptyText}>New missions arrive at midnight!</Text>
        ) : (
          missions.slice(0, 3).map((mission) => {
            const target = mission.targetCount || mission.target || 1;
            const reward = mission.rewardCoins ?? mission.reward ?? 0;
            const progress = mission.progress || 0;
            const pct = Math.min(100, (progress / target) * 100);

            return (
              <View key={mission.id} style={styles.missionItem}>
                <View style={styles.missionLeft}>
                  <Text style={styles.missionTitle} numberOfLines={1}>
                    {mission.title}
                  </Text>
                  <View style={styles.progressBar}>
                    <AnimatedProgressBar
                      progress={pct / 100}
                      height={4}
                      trackColor="rgba(255,255,255,0.15)"
                      color={mission.completed ? '#4CAF50' : '#FFD700'}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {progress}/{target}
                  </Text>
                </View>
                <View style={styles.missionRight}>
                  {mission.completed && !mission.claimed ? (
                    <TouchableOpacity
                      style={styles.claimBtn}
                      onPress={() => onClaimReward(mission.id)}
                    >
                      <Text style={styles.claimText}>Claim</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.rewardBadge}>
                      <VIBIcon size={12} animated />
                      <Text style={styles.rewardText}>{reward}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFD700',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingLeft: 8,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 17,
    marginBottom: 8,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moreButtonText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '600',
  },
  chestContainer: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -10,
    top: -20,
  },

  missionsContainer: {
    gap: 14,
    paddingLeft: 8,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  missionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  missionLeft: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  progressBar: {
    marginBottom: 4,
  },
  progressText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  missionRight: {
    alignItems: 'center',
    minWidth: 55,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
  },
  claimBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  claimText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
});