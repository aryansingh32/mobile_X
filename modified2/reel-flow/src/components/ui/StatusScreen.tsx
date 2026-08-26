import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import AppButton from './AppButton';

type StatusScreenProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

/**
 * Full-screen status state (No Internet, Maintenance). Distinct from
 * EmptyState: this fills the entire screen (used when the whole app can't
 * load), whereas EmptyState is used inline for a single section/list.
 */
export const StatusScreen: React.FC<StatusScreenProps> = ({ icon, title, subtitle, actionLabel, onActionPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel ? (
        <AppButton
          label={actionLabel}
          onPress={onActionPress || (() => {})}
          variant="primary"
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.border_active,
    backgroundColor: COLORS.yellow_dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white_55,
    textAlign: 'center',
  },
  action: {
    marginTop: SPACING.xxl,
    paddingHorizontal: SPACING.xxxl,
  },
});

export default StatusScreen;
