import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, MOTION, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import { Shimmer } from '../components/ui/Shimmer';
import { VIBIcon } from '../components/ui/VIBIcon';
import { getLeaderboard } from '../api/user';

// Filter chip that scales down on press (see AppButton for the reference pattern).
const FilterChip: React.FC<{ style?: any; onPress: () => void; children: React.ReactNode }> = ({ style, onPress, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={style} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
};

type Period = 'week' | 'month' | 'all';
type Leader = { rank: number; name: string; coins: number; level: number; isYou: boolean };

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

export const LeaderboardScreen = ({ onBack }: { onBack: () => void }) => {
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [you, setYou] = useState<Leader | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    getLeaderboard(period)
      .then((res) => {
        if (!mounted) return;
        setLeaders(res.leaders || []);
        setYou(res.you || null);
      })
      .catch(() => {
        if (mounted) setError('Could not load the leaderboard.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [period]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Leaderboard" onBack={onBack} />

      <View style={styles.filterRow}>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <FilterChip key={p.key} onPress={() => setPeriod(p.key)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{p.label}</Text>
            </FilterChip>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View>
            {[0, 1, 2, 3, 4].map(i => (
              <Shimmer key={i} width="100%" height={70} borderRadius={12} style={{ marginBottom: 8 }} />
            ))}
          </View>
        ) : error ? (
          <Text style={styles.emptyText} onPress={() => setPeriod((p) => p)}>{error}</Text>
        ) : leaders.length === 0 ? (
          <Text style={styles.emptyText}>No earners in this period yet — be the first!</Text>
        ) : (
          leaders.map((leader) => (
            <View key={leader.rank} style={[styles.row, leader.isYou && styles.rowYou]}>
              <View style={[styles.rankBadge, leader.rank <= 3 && styles.rankBadgeTop]}>
                <Text style={[styles.rankText, leader.rank <= 3 && styles.rankTextTop]}>{leader.rank}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{leader.name?.[0] || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{leader.isYou ? 'You' : leader.name}</Text>
                <Text style={styles.levelSub}>Lv. {leader.level}</Text>
              </View>
              <View style={styles.coinsWrap}>
                <Text style={styles.coins}>{leader.coins.toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 90 }} />
      </ScrollView>

      {you && !leaders.some((l) => l.isYou) ? (
        <LinearGradient colors={['rgba(255,215,0,0.15)', 'rgba(255,165,0,0.05)']} style={styles.stickyFooter}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.stickyText}>Your Rank: {you.rank}, {you.coins.toLocaleString()} </Text>
            <VIBIcon size={18} />
          </View>
        </LinearGradient>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  filterChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full, backgroundColor: COLORS.bg_input },
  filterChipActive: { backgroundColor: COLORS.yellow },
  filterText: { ...TYPOGRAPHY.caption, color: COLORS.white_80, fontWeight: '700' },
  filterTextActive: { color: '#111111' },
  content: { paddingHorizontal: SPACING.lg },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.white_55, textAlign: 'center', marginTop: SPACING.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rowYou: { borderColor: COLORS.border_active },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg_input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  rankBadgeTop: { backgroundColor: COLORS.yellow },
  rankText: { ...TYPOGRAPHY.caption, color: COLORS.white_80, fontWeight: '800' },
  rankTextTop: { color: '#111111' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg_input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarInitial: { color: COLORS.white, fontWeight: '800' },
  name: { ...TYPOGRAPHY.h3, color: COLORS.white },
  levelSub: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 2 },
  coinsWrap: { flexDirection: 'row', alignItems: 'center' },
  coins: { ...TYPOGRAPHY.h3, color: COLORS.yellow, fontWeight: '800' },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bg_elevated,
    borderTopWidth: 1,
    borderTopColor: COLORS.border_card,
    paddingVertical: SPACING.lg,
  },
  stickyText: { ...TYPOGRAPHY.h3, color: COLORS.white },
});

export default LeaderboardScreen;
