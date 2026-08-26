import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  ShieldCheck,
  Star,
  Trash2,
  UserCog,
  BellRing,
} from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { deleteAccount } from '../api/user';
import { useAppStore } from '../store/useAppStore';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';

type SettingsScreenProps = {
  onBack: () => void;
  onOpenHelp: () => void;
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onOpenHelp }) => {
  const { logout, hapticsEnabled, setHapticsEnabled } = useAppStore(useShallow(s => ({ logout: s.logout, hapticsEnabled: s.hapticsEnabled, setHapticsEnabled: s.setHapticsEnabled })));
  const { showToast } = useToast();

  const openLegal = (url?: string) => {
    if (!url) {
      showToast('This link has not been configured yet.', 'info');
      return;
    }
    Linking.openURL(url).catch(() => showToast('Could not open link', 'error'));
  };

  const confirmAccountDeletion = () => {
    Alert.alert(
      'Delete your account?',
      'Your profile and personal identifiers will be removed. Transaction records required for payout and fraud auditing will be retained in anonymized form.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'This cannot be undone',
            'Pending withdrawals must be resolved first. Delete this account permanently?',
            [
              { text: 'Keep account', style: 'cancel' },
              {
                text: 'Delete permanently',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount();
                    await GoogleSignin.signOut().catch(() => {});
                    logout();
                  } catch (error: any) {
                    Alert.alert('Account not deleted', error.response?.data?.error || 'Please try again.');
                  }
                },
              },
            ],
          ),
        },
      ],
    );
  };

  const rows: Array<{ icon: React.ReactNode; label: string; onPress: () => void }> = [
    { icon: <UserCog size={18} color={COLORS.white_80} />, label: 'Account Settings', onPress: () => showToast('Account settings coming soon', 'info') },
    { icon: <ShieldCheck size={18} color={COLORS.white_80} />, label: 'Privacy Policy', onPress: () => openLegal(process.env.EXPO_PUBLIC_PRIVACY_URL) },
    { icon: <FileText size={18} color={COLORS.white_80} />, label: 'Terms & Conditions', onPress: () => openLegal(process.env.EXPO_PUBLIC_TERMS_URL) },
    { icon: <HelpCircle size={18} color={COLORS.white_80} />, label: 'Help & Support', onPress: onOpenHelp },
    { icon: <Star size={18} color={COLORS.white_80} />, label: 'Rate Us', onPress: () => showToast('Thanks! Opening the store listing…', 'success') },
    { icon: <Info size={18} color={COLORS.white_80} />, label: 'About App', onPress: () => showToast('Version 1.0.0', 'info') },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Settings" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {rows.map((row, index) => (
            <Pressable key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]} onPress={row.onPress}>
              <View style={styles.rowLeft}>
                {row.icon}
                <Text style={styles.rowLabel}>{row.label}</Text>
              </View>
              <ChevronRight size={18} color={COLORS.white_30} />
            </Pressable>
          ))}
        </View>

        {/* Haptics toggle — replaces the non-functional dark mode toggle */}
        <View style={styles.card}>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowLeft}>
              <BellRing size={18} color={COLORS.white_80} />
              <View>
                <Text style={styles.rowLabel}>Haptic Feedback</Text>
                <Text style={styles.rowSubLabel}>Vibration on interactions</Text>
              </View>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={(val) => {
                setHapticsEnabled(val);
                // Small inline toast so user knows it took effect immediately
                showToast(val ? 'Haptics enabled' : 'Haptics disabled', 'info');
              }}
              trackColor={{ false: COLORS.bg_input, true: COLORS.yellow }}
              thumbColor={COLORS.white}
              accessibilityLabel="Toggle haptic feedback"
            />
          </View>
        </View>

        <Pressable style={styles.dangerRow} onPress={confirmAccountDeletion}>
          <Trash2 size={16} color={COLORS.red} />
          <Text style={styles.dangerText}>Delete Account</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary },
  content: { padding: SPACING.lg },
  card: {
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border_subtle,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowLabel: { ...TYPOGRAPHY.h3, color: COLORS.white },
  rowSubLabel: { ...TYPOGRAPHY.caption, color: COLORS.white_55, fontSize: 11, marginTop: 1 },
  dangerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  dangerText: { ...TYPOGRAPHY.caption, color: COLORS.red, fontWeight: '700' },
});

export default SettingsScreen;
