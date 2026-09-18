import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS, MOTION, SPACING, TYPOGRAPHY } from '../constants/theme';
import AppButton from '../components/ui/AppButton';
import QuestBoxHero from '../components/ui/QuestBoxHero';

export const AllSetScreen = ({ onExplore }: { onExplore: () => void }) => {
  const [opened, setOpened] = useState(false);
  const textFade = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(14)).current;
  const footerFade = useRef(new Animated.Value(0)).current;
  // One-shot celebratory glow burst behind the box the instant it opens —
  // not a loop, just a quick flash to sell the "reveal" moment.
  const glowBurst = useRef(new Animated.Value(0)).current;

  const handleOpened = () => {
    setOpened(true);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(glowBurst, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(glowBurst, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
      Animated.stagger(120, [
        Animated.parallel([
          Animated.timing(textFade, { toValue: 1, duration: MOTION.base, useNativeDriver: true }),
          Animated.spring(textY, { toValue: 0, useNativeDriver: true, ...MOTION.spring_soft }),
        ]),
        Animated.timing(footerFade, { toValue: 1, duration: MOTION.base, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const glowOpacity = glowBurst.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });
  const glowScale = glowBurst.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] });

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Animated.View pointerEvents="none" style={[styles.glowBurst, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        <QuestBoxHero size={160} onOpened={handleOpened} />
        <Animated.View style={{ opacity: textFade, transform: [{ translateY: textY }] }}>
          <Text style={styles.title}>You're all set! 🎉</Text>
          <Text style={styles.subtitle}>Let's start your earning journey with ReelFlow</Text>
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
  glowBurst: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.yellow,
  },
  title: { ...TYPOGRAPHY.hero, fontSize: 26, color: COLORS.white, textAlign: 'center', marginTop: SPACING.xxl },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.white_55, marginTop: SPACING.sm, textAlign: 'center' },
});

export default AllSetScreen;
