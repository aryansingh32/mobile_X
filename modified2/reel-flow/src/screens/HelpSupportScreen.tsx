import React, { useRef, useState } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, HelpCircle } from 'lucide-react-native';
import { COLORS, MOTION, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import AppButton from '../components/ui/AppButton';
import { useToast } from '../components/ui/Toast';

// FAQ card that scales down on press (see AppButton for the reference pattern).
const FaqCard: React.FC<{ onPress: () => void; children: React.ReactNode }> = ({ onPress, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={styles.card} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
};

const FAQS = [
  {
    question: 'How do I earn VIB?',
    answer: 'VIB are awarded for watching rewarded ads inside Games and the Watch & Earn / Discover sponsored cards, completing Offerwall tasks, and daily/referral bonuses. Watching Shorts or reading Discover news articles on their own does not award VIB — only the ad placements do.',
  },
  {
    question: 'How do I redeem rewards?',
    answer: 'Open Wallet, pick a voucher from the Redeem tab, and confirm — coins are deducted immediately and your voucher or cashback request is queued for processing.',
  },
  {
    question: 'Why hasn\u2019t my withdrawal arrived yet?',
    answer: 'Most payouts process within 24\u201372 hours. If it has been longer, check the status in Wallet > History, and contact support below with your transaction ID.',
  },
  {
    question: 'Why didn\u2019t I get coins for a video?',
    answer: 'Only ad placements pay coins. Passive video/article viewing (Shorts, Discover news cards) is not rewarded — this is by design, to prevent reward fraud.',
  },
];

export const HelpSupportScreen = ({ onBack }: { onBack: () => void }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { showToast } = useToast();

  const contactSupport = () => {
    const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@example.com';
    Linking.openURL(`mailto:${email}`).catch(() => showToast('Could not open mail app', 'error'));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Help & Support" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <FaqCard
              key={faq.question}
              onPress={() => setOpenIndex(isOpen ? null : index)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardQuestion}>{faq.question}</Text>
                <ChevronDown
                  size={18}
                  color={COLORS.white_55}
                  style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                />
              </View>
              {isOpen ? <Text style={styles.cardAnswer}>{faq.answer}</Text> : null}
            </FaqCard>
          );
        })}

        <View style={styles.contactCard}>
          <HelpCircle size={28} color={COLORS.yellow} />
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactSubtitle}>Our support team usually replies within a day.</Text>
          <AppButton label="Contact Support" onPress={contactSupport} style={{ marginTop: SPACING.md }} />
        </View>

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
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardQuestion: { ...TYPOGRAPHY.h3, color: COLORS.white, flex: 1, marginRight: SPACING.sm },
  cardAnswer: { ...TYPOGRAPHY.body, color: COLORS.white_55, marginTop: SPACING.sm, lineHeight: 20 },
  contactCard: {
    alignItems: 'center',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.xl,
    marginTop: SPACING.lg,
  },
  contactTitle: { ...TYPOGRAPHY.h3, color: COLORS.white, marginTop: SPACING.sm },
  contactSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 4, textAlign: 'center' },
});

export default HelpSupportScreen;
