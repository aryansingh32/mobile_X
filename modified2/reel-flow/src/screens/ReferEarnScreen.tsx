import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, Share } from 'react-native';
import { Pressable } from 'react-native';
import { Copy, Gift, Users } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { getReferralStats } from '../api/referral';
import { useAppStore } from '../store/useAppStore';
import { COLORS, MOTION, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import AppButton from '../components/ui/AppButton';
import { useToast } from '../components/ui/Toast';

const STEPS = [
  'Share your referral code with a friend',
  'Friend signs up using your code',
  'Friend completes their first missions',
  'You both earn VIB',
];

export const ReferEarnScreen = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAppStore(useShallow(s => ({ user: s.user })));
  const { showToast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);
  const copyScale = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);

  const loadStats = () => {
    setStatsError(false);
    getReferralStats()
      .then((res) => { if (mountedRef.current) setStats(res); })
      .catch(() => { if (mountedRef.current) setStatsError(true); });
  };

  useEffect(() => {
    mountedRef.current = true;
    loadStats();
    return () => { mountedRef.current = false; };
  }, []);

  const code = user?.referralCode || '—';

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(code);
      showToast('Referral code copied', 'success');
    } catch {
      // Previously unhandled — a failure here meant the user tapped "Copy"
      // and, from their side, nothing happened at all.
      showToast('Could not copy — try again', 'error');
    }
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
          <Text style={styles.heroSubtitle}>Invite friends and earn VIB together</Text>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{code}</Text>
            <Animated.View style={{ transform: [{ scale: copyScale }] }}>
              <Pressable
                style={styles.copyButton}
                onPress={copyCode}
                onPressIn={() => Animated.spring(copyScale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
                onPressOut={() => Animated.spring(copyScale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
                accessibilityRole="button"
                accessibilityLabel="Copy referral code"
              >
                <Copy size={16} color={COLORS.white} />
                <Text style={styles.copyButtonText}>Copy</Text>
              </Pressable>
            </Animated.View>
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
        {statsError ? (
          <Pressable onPress={loadStats} accessibilityRole="button" accessibilityLabel="Retry loading referral stats">
            <Text style={styles.statsRetryText}>Couldn't load your latest stats — tap to retry</Text>
          </Pressable>
        ) : null}

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
  statsRetryText: { ...TYPOGRAPHY.caption, color: COLORS.yellow, textAlign: 'center', marginTop: SPACING.sm },
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
