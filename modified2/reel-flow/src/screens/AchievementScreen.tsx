import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Award, Flame, Star, Trophy, Users as UsersIcon, Wallet } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import AnimatedProgressBar from '../components/ui/AnimatedProgressBar';
import { Shimmer } from '../components/ui/Shimmer';
import { getBadges } from '../api/user';

type Badge = {
  id: number;
  name: string;
  description: string;
  conditionType: string;
  conditionValue: number;
  earned: boolean;
  earnedAt: string | null;
};

const ICON_BY_CONDITION: Record<string, any> = {
  STREAK: Flame,
  LEVEL: Star,
  SHORTS_WATCHED: Trophy,
  WITHDRAWAL: Wallet,
  REFERRALS: UsersIcon,
};

export const AchievementScreen = ({ onBack }: { onBack: () => void }) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const data = await getBadges();
      setBadges(data);
    } catch {
      setError('Could not load achievements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Achievement" kicker="Milestones" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Complete tasks and unlock achievements.</Text>
        {loading ? (
          <View>
            {[0, 1, 2, 3].map((i) => (
              <Shimmer key={i} width="100%" height={76} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.md }} />
            ))}
          </View>
        ) : error ? (
          <Text style={styles.emptyText} onPress={load}>{error} Tap to retry.</Text>
        ) : badges.length === 0 ? (
          <Text style={styles.emptyText}>No achievements configured yet.</Text>
        ) : (
          badges.map((badge) => {
            const Icon = ICON_BY_CONDITION[badge.conditionType] || Award;
            return (
              <View key={badge.id} style={styles.card}>
                <View style={[styles.iconCircle, badge.earned && styles.iconCircleComplete]}>
                  <Icon size={20} color={badge.earned ? '#111111' : COLORS.white_80} />
                </View>
                <View style={styles.body}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.title}>{badge.name}</Text>
                    {badge.earned ? <Award size={16} color={COLORS.yellow} /> : null}
                  </View>
                  <Text style={styles.description}>{badge.description}</Text>
                  <AnimatedProgressBar progress={badge.earned ? 1 : 0} height={6} />
                  <Text style={styles.progressLabel}>{badge.earned ? 'Unlocked' : 'Locked'}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary },
  content: { padding: SPACING.lg },
  intro: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginBottom: SPACING.lg },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.white_55, textAlign: 'center', marginTop: SPACING.xl },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg_input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  iconCircleComplete: { backgroundColor: COLORS.yellow },
  body: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { ...TYPOGRAPHY.h3, color: COLORS.white },
  description: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginBottom: SPACING.sm },
  progressLabel: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 6, textAlign: 'right' },
});

export default AchievementScreen;
