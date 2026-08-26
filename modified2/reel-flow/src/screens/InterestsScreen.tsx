import { useShallow } from 'zustand/react/shallow';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Gamepad2, Clapperboard, Cpu, Trophy, Laugh } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import AppButton from '../components/ui/AppButton';
import QuestBoxHero from '../components/ui/QuestBoxHero';
import { useAppStore } from '../store/useAppStore';

const OPTIONS = [
  { key: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { key: 'entertainment', label: 'Entertainment', icon: Clapperboard },
  { key: 'technology', label: 'Technology', icon: Cpu },
  { key: 'sports', label: 'Sports', icon: Trophy },
  { key: 'funny', label: 'Funny', icon: Laugh },
];

/**
 * UI SHELL — selections are saved to useAppStore/selectedInterests and
 * persisted, but nothing downstream (Discover/Shorts ranking) reads them
 * yet. Wiring real personalization means tagging Discover/Shorts content by
 * category first — see the report before treating this as "done."
 */
export const InterestsScreen = ({ onContinue }: { onContinue: () => void }) => {
  const { selectedInterests, setSelectedInterests } = useAppStore(useShallow(s => ({ selectedInterests: s.selectedInterests, setSelectedInterests: s.setSelectedInterests })));
  const [selected, setSelected] = useState<string[]>(selectedInterests?.length ? selectedInterests : ['gaming', 'sports']);

  const toggle = (key: string) => {
    setSelected((current) => (
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    ));
  };

  const handleContinue = () => {
    setSelectedInterests(selected);
    onContinue();
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <View style={{ alignItems: 'center', marginBottom: SPACING.md }}>
          <QuestBoxHero size={120} autoPlay={true} />
        </View>
        <Text style={styles.title}>Pick your interests</Text>
        <Text style={styles.subtitle}>Select what you like to get a better experience</Text>

        <View style={styles.list}>
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = selected.includes(option.key);
            return (
              <Pressable key={option.key} style={styles.row} onPress={() => toggle(option.key)} accessibilityRole="checkbox" accessibilityState={{ checked: isActive }}>
                <View style={styles.rowLeft}>
                  <View style={styles.iconCircle}>
                    <Icon size={18} color={COLORS.white_80} />
                  </View>
                  <Text style={styles.rowLabel}>{option.label}</Text>
                </View>
                <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                  {isActive ? <Check size={14} color="#111111" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <AppButton label="Continue" onPress={handleContinue} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary, padding: SPACING.xxxl, justifyContent: 'space-between' },
  content: { flex: 1 },
  title: { ...TYPOGRAPHY.hero, fontSize: 26, color: COLORS.white },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.white_55, marginTop: SPACING.sm, marginBottom: SPACING.xxl },
  list: { gap: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.md,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg_input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...TYPOGRAPHY.h3, color: COLORS.white },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border_card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.yellow, borderColor: COLORS.yellow },
});

export default InterestsScreen;
