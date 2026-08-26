import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import AppButton from './AppButton';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

/**
 * Standard empty/placeholder state: icon + title + subtitle + optional CTA.
 * Use for empty missions, empty notifications, empty transaction history, etc.
 * instead of a single line of gray text.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, actionLabel, onActionPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel ? (
        <AppButton label={actionLabel} onPress={onActionPress || (() => {})} variant="secondary" fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg_elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.white,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white_55,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  action: {
    marginTop: SPACING.lg,
  },
});

export default EmptyState;
