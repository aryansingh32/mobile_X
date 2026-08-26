import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import {
  Bell,
  ChevronRight,
  ExternalLink,
  Gift,
  HelpCircle,
  LogOut,
  Settings as SettingsIcon,
  Trophy,
  Users,
} from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAppStore } from '../store/useAppStore';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';

export type ProfileDestination = 'referEarn' | 'notifications' | 'help' | 'settings' | 'leaderboard' | 'achievements';

type ProfileScreenProps = {
  onBack: () => void;
  onNavigate: (destination: ProfileDestination) => void;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onNavigate }) => {
  const { user, logout, todayCoinsEarned } = useAppStore(useShallow(s => ({ user: s.user, logout: s.logout, todayCoinsEarned: s.todayCoinsEarned })));

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign in again with Google.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await GoogleSignin.signOut().catch(() => {});
          logout();
        },
      },
    ]);
  };

  const menuRows: Array<{ icon: React.ReactNode; label: string; onPress: () => void }> = [
    { icon: <Users size={18} color={COLORS.white_80} />, label: 'Refer & Earn', onPress: () => onNavigate('referEarn') },
    { icon: <Trophy size={18} color={COLORS.white_80} />, label: 'Leaderboard', onPress: () => onNavigate('leaderboard') },
    { icon: <Gift size={18} color={COLORS.white_80} />, label: 'Achievements', onPress: () => onNavigate('achievements') },
    { icon: <Bell size={18} color={COLORS.white_80} />, label: 'Notifications', onPress: () => onNavigate('notifications') },
    { icon: <HelpCircle size={18} color={COLORS.white_80} />, label: 'Help & Support', onPress: () => onNavigate('help') },
    { icon: <SettingsIcon size={18} color={COLORS.white_80} />, label: 'Settings', onPress: () => onNavigate('settings') },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profile" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{user?.name?.[0] || 'U'}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user?.coins ?? 0}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{todayCoinsEarned || 0}</Text>
            <Text style={styles.statLabel}>Earned Today</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {menuRows.map((row, index) => (
            <Pressable
              key={row.label}
              style={[styles.menuRow, index === menuRows.length - 1 && styles.menuRowLast]}
              onPress={row.onPress}
              accessibilityRole="button"
            >
              <View style={styles.menuRowLeft}>
                {row.icon}
                <Text style={styles.menuRowLabel}>{row.label}</Text>
              </View>
              <ChevronRight size={18} color={COLORS.white_30} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.signOutButton} onPress={confirmSignOut}>
          <LogOut size={18} color={COLORS.red} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary },
  content: { padding: SPACING.lg },
  identityCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111111',
  },
  name: {
    ...TYPOGRAPHY.h1,
    color: COLORS.white,
  },
  email: {
    ...TYPOGRAPHY.body,
    color: COLORS.white_55,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.border_card },
  statValue: { ...TYPOGRAPHY.h1, color: COLORS.yellow },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 4 },
  menuCard: {
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    paddingHorizontal: SPACING.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border_subtle,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  menuRowLabel: { ...TYPOGRAPHY.h3, color: COLORS.white },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xl,
  },
  signOutText: { ...TYPOGRAPHY.h3, color: COLORS.red, fontWeight: '800' },
});

export default ProfileScreen;
