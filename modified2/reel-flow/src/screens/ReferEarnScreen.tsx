import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Share } from 'react-native';
import { Pressable } from 'react-native';
import { Copy, Gift, Users } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { getReferralStats } from '../api/referral';
import { useAppStore } from '../store/useAppStore';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import AppButton from '../components/ui/AppButton';
import { useToast } from '../components/ui/Toast';

const STEPS = [
  'Share your referral code with a friend',
  'Friend signs up using your code',
  'Friend completes their first missions',
  'You both earn coins',
];

export const ReferEarnScreen = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAppStore(useShallow(s => ({ user: s.user })));
  const { showToast } = useToast();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    getReferralStats().then((res) => { if (mounted) setStats(res); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const code = user?.referralCode || '—';

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    showToast('Referral code copied', 'success');
  };

  const shareNow = async () => {
    try {
      await Share.share({ message: `Join me and earn real rewards \u2014 use my code ${code} when you sign up!` });
    } catch {
      // Share sheet dismissed; nothing to do.
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Refer & Earn" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Users size={28} color={COLORS.yellow} />
          <Text style={styles.heroTitle}>Invite Your Friends</Text>
          <Text style={styles.heroSubtitle}>Invite friends and earn coins together</Text>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{code}</Text>
            <Pressable style={styles.copyButton} onPress={copyCode} accessibilityRole="button" accessibilityLabel="Copy referral code">
              <Copy size={16} color={COLORS.white} />
              <Text style={styles.copyButtonText}>Copy</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.totalReferrals ?? 0}</Text>
            <Text style={styles.statLabel}>Friends Referred</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.earnedCoins ?? 0}</Text>
            <Text style={styles.statLabel}>VIB Earned</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>How it Works?</Text>
        <View style={styles.stepsCard}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <AppButton label="Share Now" onPress={shareNow} icon={<Gift size={18} color="#111111" />} style={{ marginTop: SPACING.xl }} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary },
  content: { padding: SPACING.lg },
  heroCard: {
    alignItems: 'center',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_active,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  heroTitle: { ...TYPOGRAPHY.h2, color: COLORS.white, marginTop: SPACING.sm },
  heroSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 2, textAlign: 'center' },
  codeCard: {
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  codeLabel: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginBottom: SPACING.sm },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeText: { ...TYPOGRAPHY.h1, color: COLORS.white, letterSpacing: 2 },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg_input,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },
  copyButtonText: { ...TYPOGRAPHY.caption, color: COLORS.white, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.border_card },
  statValue: { ...TYPOGRAPHY.h1, color: COLORS.yellow },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 4 },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.white, marginBottom: SPACING.md },
  stepsCard: {
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.lg,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.yellow_dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  stepBadgeText: { color: COLORS.yellow, fontWeight: '800', fontSize: 12 },
  stepText: { ...TYPOGRAPHY.body, color: COLORS.white_80, flex: 1 },
});

export default ReferEarnScreen;
