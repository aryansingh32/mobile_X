import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

type ScreenHeaderProps = {
  title: string;
  kicker?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

/**
 * Shared header for full-screen destinations that live above the bottom nav
 * (Profile, Settings, Notifications, Help & Support, Leaderboard, Achievements,
 * Refer & Earn, Offerwall networks, Daily Missions detail). Matches the
 * back-button pattern already used in GamesScreen.tsx so every "drill-in"
 * screen in the app feels the same.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, kicker, onBack, right }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {onBack ? (
        <Pressable style={styles.iconButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft color={COLORS.white} size={22} />
        </Pressable>
      ) : (
        <View style={styles.iconButton} />
      )}
      <View style={styles.copy}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md + 2,
    backgroundColor: COLORS.bg_elevated,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg_input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  kicker: {
    ...TYPOGRAPHY.caption,
    color: COLORS.yellow,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.white,
  },
  rightSlot: {
    minWidth: 42,
    alignItems: 'flex-end',
  },
});

export default ScreenHeader;
