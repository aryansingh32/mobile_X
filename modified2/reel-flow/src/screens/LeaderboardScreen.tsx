import { useShallow } from 'zustand/react/shallow';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import { Shimmer } from '../components/ui/Shimmer';
import { VIBIcon } from '../components/ui/VIBIcon';

type Period = 'week' | 'month' | 'all';

/**
 * UI SHELL — mock ranking data below. Real ranking requires a backend query
 * (likely rank-by-coinBalance or rank-by-xp, per user.coinBalance/xp already
 * tracked in useAppStore) — see the report before wiring this up for real.
 */
const MOCK_LEADERS = [
  { rank: 1, name: 'Aman', coins: 24500 },
  { rank: 2, name: 'You', coins: 15230, isYou: true },
  { rank: 3, name: 'Neha', coins: 11200 },
  { rank: 4, name: 'Rohit', coins: 9850 },
  { rank: 5, name: 'Priya', coins: 8950 },
  { rank: 6, name: 'Sagar', coins: 7650 },
];

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

export const LeaderboardScreen = ({ onBack }: { onBack: () => void }) => {
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const { user } = useAppStore(useShallow(s => ({ user: s.user })));
  const you = useMemo(() => MOCK_LEADERS.find((l) => l.isYou), []);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setTimeout(() => {
      if (mounted) setLoading(false);
    }, 600);
    return () => { mounted = false; };
  }, [period]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Leaderboard" onBack={onBack} />

      <View style={styles.filterRow}>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{p.label}</Text>
            </Pressable>
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
        ) : (
          MOCK_LEADERS.map((leader) => (
            <View key={leader.rank} style={[styles.row, leader.isYou && styles.rowYou]}>
              <View style={[styles.rankBadge, leader.rank <= 3 && styles.rankBadgeTop]}>
                <Text style={[styles.rankText, leader.rank <= 3 && styles.rankTextTop]}>{leader.rank}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{leader.name[0]}</Text>
              </View>
              <Text style={styles.name}>{leader.name}</Text>
              <View style={styles.coinsWrap}>
                <Text style={styles.coins}>{leader.coins.toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 90 }} />
      </ScrollView>

      {you ? (
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
  name: { ...TYPOGRAPHY.h3, color: COLORS.white, flex: 1 },
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
