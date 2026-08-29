import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS, MOTION, SPACING, TYPOGRAPHY } from '../constants/theme';
import AppButton from '../components/ui/AppButton';
import QuestBoxHero from '../components/ui/QuestBoxHero';
import { useAppStore } from '../store/useAppStore';

export const AllSetScreen = ({ onExplore }: { onExplore: () => void }) => {
  const [opened, setOpened] = useState(false);
  // The gift-box animation used to open onto a literal zero balance — no
  // signup bonus existed anywhere. Now the backend credits one on account
  // creation (see authController.ts), and coinBalance already reflects it
  // by the time this screen renders (set from the login response).
  const coinBalance = useAppStore((s) => s.coinBalance);
  const textFade = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(14)).current;
  const footerFade = useRef(new Animated.Value(0)).current;

  const handleOpened = () => {
    setOpened(true);
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(textFade, { toValue: 1, duration: MOTION.base, useNativeDriver: true }),
        Animated.spring(textY, { toValue: 0, useNativeDriver: true, ...MOTION.spring_soft }),
      ]),
      Animated.timing(footerFade, { toValue: 1, duration: MOTION.base, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <QuestBoxHero size={160} onOpened={handleOpened} />
        <Animated.View style={{ opacity: textFade, transform: [{ translateY: textY }] }}>
          <Text style={styles.title}>You're all set! 🎉</Text>
          <Text style={styles.subtitle}>
            {coinBalance > 0
              ? `You've been gifted ${coinBalance} coins to get started!`
              : "Let's start your earning journey with ReelFlow"}
          </Text>
        </Animated.View>
      </View>
      <Animated.View style={{ opacity: footerFade }} pointerEvents={opened ? 'auto' : 'none'}>
        <AppButton label="Explore App" onPress={onExplore} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary, padding: SPACING.xxxl, justifyContent: 'space-between' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPOGRAPHY.hero, fontSize: 26, color: COLORS.white, textAlign: 'center', marginTop: SPACING.xxl },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.white_55, marginTop: SPACING.sm, textAlign: 'center' },
});

export default AllSetScreen;
