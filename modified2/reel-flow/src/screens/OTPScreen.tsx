import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import OTPInput from '../components/ui/OTPInput';
import AppButton from '../components/ui/AppButton';
import { useToast } from '../components/ui/Toast';

type OTPScreenProps = {
  phoneNumber: string;
  onVerified: () => void;
  onBack: () => void;
};

/**
 * UI SHELL — there is no SMS/OTP provider wired up yet (see CHANGES.md).
 * `onVerified` currently fires as soon as 4 digits are entered; before this
 * is real, wire it to an actual verify-OTP API call and only fire on success.
 */
export const OTPScreen: React.FC<OTPScreenProps> = ({ phoneNumber, onVerified, onBack }) => {
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(28);
  const { showToast } = useToast();

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  useEffect(() => {
    if (code.length === 4) {
      onVerified();
    }
  }, [code]);

  const resend = () => {
    if (seconds > 0) return;
    setSeconds(28);
    showToast('OTP resent', 'success');
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>We have sent a 4 digit code to {phoneNumber}</Text>

        <View style={styles.otpWrap}>
          <OTPInput length={4} value={code} onChange={setCode} />
        </View>

        <Text style={styles.resend} onPress={resend}>
          {seconds > 0 ? `Resend OTP in 00:${seconds.toString().padStart(2, '0')}` : 'Resend OTP'}
        </Text>

        <View style={styles.secureBadge}>
          <ShieldCheck color={COLORS.yellow} size={32} />
        </View>
        <Text style={styles.secureTitle}>Secure & Easy</Text>
        <Text style={styles.secureSubtitle}>We keep your data safe</Text>
      </View>

      <AppButton label="Back" onPress={onBack} variant="ghost" style={styles.backButton} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary, padding: SPACING.xxxl, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { ...TYPOGRAPHY.hero, fontSize: 26, color: COLORS.white, alignSelf: 'flex-start' },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.white_55, alignSelf: 'flex-start', marginTop: SPACING.sm, marginBottom: SPACING.xxl },
  otpWrap: { marginBottom: SPACING.lg },
  resend: { ...TYPOGRAPHY.caption, color: COLORS.yellow, fontWeight: '700', marginBottom: SPACING.xxxl },
  secureBadge: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.yellow_dim,
    borderWidth: 1,
    borderColor: COLORS.border_active,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  secureTitle: { ...TYPOGRAPHY.h3, color: COLORS.white },
  secureSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 2 },
  backButton: { marginBottom: SPACING.md },
});

export default OTPScreen;
