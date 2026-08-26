import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Award, Film, Gamepad2, Star, Users as UsersIcon } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import AnimatedProgressBar from '../components/ui/AnimatedProgressBar';

/**
 * UI SHELL — mock milestone data below. Real thresholds/progress should come
 * from existing counters (videos watched, games played, missions completed,
 * referrals made) once a backend "achievements" endpoint exists. No new
 * backend concept is required beyond counting actions you likely already
 * track — see the report for details.
 */
const MOCK_ACHIEVEMENTS = [
  { id: 'video', icon: Film, title: 'Video Watcher', current: 500, target: 500 },
  { id: 'game', icon: Gamepad2, title: 'Game Master', current: 25, target: 50 },
  { id: 'mission', icon: Star, title: 'Mission Expert', current: 10, target: 50 },
  { id: 'referral', icon: UsersIcon, title: 'Referral Star', current: 1, target: 10 },
];

export const AchievementScreen = ({ onBack }: { onBack: () => void }) => {
  return (
    <View style={styles.root}>
      <ScreenHeader title="Achievement" kicker="Milestones" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Complete tasks and unlock achievements.</Text>
        {MOCK_ACHIEVEMENTS.map((achievement) => {
          const Icon = achievement.icon;
          const complete = achievement.current >= achievement.target;
          return (
            <View key={achievement.id} style={styles.card}>
              <View style={[styles.iconCircle, complete && styles.iconCircleComplete]}>
                <Icon size={20} color={complete ? '#111111' : COLORS.white_80} />
              </View>
              <View style={styles.body}>
                <View style={styles.rowBetween}>
                  <Text style={styles.title}>{achievement.title}</Text>
                  {complete ? <Award size={16} color={COLORS.yellow} /> : null}
                </View>
                <AnimatedProgressBar progress={achievement.current / achievement.target} height={6} />
                <Text style={styles.progressLabel}>{achievement.current}/{achievement.target}</Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary },
  content: { padding: SPACING.lg },
  intro: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginBottom: SPACING.lg },
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { ...TYPOGRAPHY.h3, color: COLORS.white },
  progressLabel: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 6, textAlign: 'right' },
});

export default AchievementScreen;
