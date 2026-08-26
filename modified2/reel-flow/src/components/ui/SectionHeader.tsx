import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

/**
 * Standard section header used across Home, Games, Wallet, Rewards.
 * Replaces the duplicated `sectionHeader`/`gamesHeader` inline styles.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, actionLabel, onActionPress }) => {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable onPress={onActionPress} style={styles.action} hitSlop={8} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <ChevronRight size={16} color={COLORS.white_55} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleWrap: {
    flexShrink: 1,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.white,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white_55,
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white_55,
    fontWeight: '600',
  },
});

export default SectionHeader;
