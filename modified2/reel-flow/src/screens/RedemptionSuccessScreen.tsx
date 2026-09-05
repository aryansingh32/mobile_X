import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { VIBIcon } from '../components/ui/VIBIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import AppButton from '../components/ui/AppButton';

export type RedemptionSuccessScreenProps = {
  itemName: string;
  coinsSpent: number;
  detail?: React.ReactNode;
  title?: string;
  onDone: () => void;
};

export const RedemptionSuccessScreen: React.FC<RedemptionSuccessScreenProps> = ({ itemName, coinsSpent, detail, title, onDone }) => {
  return (
    <View style={styles.overlay}>
      <View style={styles.iconCircle}>
        <CheckCircle2 size={56} color={COLORS.green} />
      </View>
      <Text style={styles.title}>{title || 'Congratulations!'}</Text>
      <Text style={styles.subtitle}>You have redeemed {itemName}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {coinsSpent > 0 && (
        <View style={styles.coinsRow}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.coinsText}>-{coinsSpent} </Text>
            <VIBIcon size={24} animated />
          </View>
        </View>
      )}
      <AppButton label="Back to Home" onPress={onDone} fullWidth={false} style={styles.button} />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg_primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
    zIndex: 50,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.success_dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  title: { ...TYPOGRAPHY.h1, color: COLORS.white, textAlign: 'center' },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.white_80, marginTop: SPACING.sm, textAlign: 'center' },
  detail: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: SPACING.sm, textAlign: 'center' },
  coinsRow: { marginTop: SPACING.lg },
  coinsText: { ...TYPOGRAPHY.h2, color: COLORS.yellow, fontWeight: '800' },
  button: { marginTop: SPACING.xxl, paddingHorizontal: SPACING.xxxl },
});

export default RedemptionSuccessScreen;
