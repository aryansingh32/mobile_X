import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { Gift } from 'lucide-react-native';
import { claimDailyMissions, getDailyMissions } from '../api/user';
import { useAppStore } from '../store/useAppStore';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import AppButton from '../components/ui/AppButton';
import AnimatedProgressBar from '../components/ui/AnimatedProgressBar';
import CoinRain from '../components/ui/CoinRain';
import { Shimmer } from '../components/ui/Shimmer';
import { useToast } from '../components/ui/Toast';
import { VIBIcon } from '../components/ui/VIBIcon';

export const DailyMissionsScreen = ({ onBack }: { onBack: () => void }) => {
  const { updateBalance } = useAppStore(useShallow(s => ({ updateBalance: s.updateBalance })));
  const { showToast } = useToast();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [rainAmount, setRainAmount] = useState(0);
  const [showRain, setShowRain] = useState(false);

  useEffect(() => {
    let mounted = true;
    getDailyMissions()
      .then((data) => { if (mounted) setMissions(data || []); })
      .catch(() => { if (mounted) setMissions([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const allComplete = missions.length > 0 && missions.every((m) => m.completed || (m.progress || 0) >= (m.targetCount || m.target || 1));
  const totalReward = missions.reduce((sum, m) => sum + (m.rewardCoins ?? m.reward ?? 0), 0);

  const claimBonus = async () => {
    setClaiming(true);
    try {
      const result = await claimDailyMissions();
      if (result.claimed && result.coinsEarned) {
        updateBalance(result.coinsEarned);
        setRainAmount(result.coinsEarned);
        setShowRain(true);
      } else {
        showToast(result.message || 'Bonus already claimed today', 'info');
      }
    } catch {
      showToast('Could not claim bonus right now', 'error');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Daily Mission" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Gift size={32} color={COLORS.yellow} />
          <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginTop: SPACING.sm}}>
            <Text style={[styles.heroTitle, {marginTop: 0}]}>Complete all missions to get {totalReward || 100} bonus </Text>
            <VIBIcon size={16} />
          </View>
        </View>

        {loading ? (
          [0, 1, 2].map((i) => <Shimmer key={i} width="100%" height={72} borderRadius={16} style={{ marginBottom: 12 }} />)
        ) : (
          missions.map((mission) => {
            const target = mission.targetCount || mission.target || 1;
            const progress = mission.progress || 0;
            const reward = mission.rewardCoins ?? mission.reward ?? 0;
            return (
              <View key={mission.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{mission.title}</Text>
                  <Text style={styles.cardReward}>+{reward}</Text>
                </View>
                <AnimatedProgressBar progress={progress / target} height={6} />
                <Text style={styles.cardProgress}>{progress}/{target}</Text>
              </View>
            );
          })
        )}

        <AppButton
          label={allComplete ? 'Claim Bonus' : 'Complete all missions to claim'}
          onPress={claimBonus}
          disabled={!allComplete}
          loading={claiming}
          style={{ marginTop: SPACING.lg }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
      <CoinRain visible={showRain} amount={rainAmount} onComplete={() => setShowRain(false)} />
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
  heroTitle: { ...TYPOGRAPHY.h3, color: COLORS.white, marginTop: SPACING.sm, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardTitle: { ...TYPOGRAPHY.h3, color: COLORS.white },
  cardReward: { ...TYPOGRAPHY.h3, color: COLORS.yellow, fontWeight: '800' },
  cardProgress: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 6, textAlign: 'right' },
});

export default DailyMissionsScreen;
