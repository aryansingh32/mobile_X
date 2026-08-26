import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

type DailyStreakRowProps = {
  streak: number;
  claimedToday: boolean;
  onClaim?: () => void;
};

const DailyStreakRow = ({ streak, claimedToday, onClaim }: DailyStreakRowProps) => {
  const currentDay = Math.min(7, Math.max(1, (streak % 7) || 7));
  const bonus = Math.min(50, currentDay * 5);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {Array.from({ length: 7 }, (_, index) => {
          const day = index + 1;
          const isPast = day < currentDay || (day === currentDay && claimedToday);
          const isCurrent = day === currentDay && !claimedToday;

          return (
            <View key={day} style={styles.day}>
              <View style={[styles.circle, isPast && styles.circlePast, isCurrent && styles.circleCurrent]}>
                {isPast ? <Check size={16} color={COLORS.white} /> : <Text style={styles.dayNumber}>{day}</Text>}
              </View>
              <Text style={styles.label}>Day {day}</Text>
            </View>
          );
        })}
      </View>

      {!claimedToday && (
        <View style={styles.claimRow}>
          <Text style={styles.claimText}>Claim Today: +{bonus} coins</Text>
          {onClaim && (
            <Pressable style={styles.claimButton} onPress={onClaim}>
              <Text style={styles.claimButtonText}>Claim</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    backgroundColor: COLORS.bg_card,
    padding: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.white_30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg_elevated,
  },
  circlePast: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.green,
  },
  circleCurrent: {
    borderColor: COLORS.yellow,
    backgroundColor: COLORS.yellow_dim,
  },
  dayNumber: {
    color: COLORS.white_80,
    fontSize: 12,
    fontWeight: '800',
  },
  label: {
    ...TYPOGRAPHY.small,
    color: COLORS.white_55,
    marginTop: SPACING.xs,
  },
  claimRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  claimText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.yellow,
    flex: 1,
  },
  claimButton: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.yellow,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  claimButtonText: {
    color: COLORS.bg_primary,
    fontWeight: '900',
  },
});

export default DailyStreakRow;
