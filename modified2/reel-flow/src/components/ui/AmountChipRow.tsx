import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

type AmountChipRowProps = {
  options: number[];
  selected: number | null;
  onSelect: (value: number) => void;
  prefix?: string;
};

/**
 * Row of preset-amount chips (e.g. ₹10, ₹50, ₹100, ₹500). Reduces free-text
 * input errors versus a raw amount TextInput. Purely presentational —
 * the screen using this still owns validation against the real catalog/API.
 */
export const AmountChipRow: React.FC<AmountChipRowProps> = ({ options, selected, onSelect, prefix = '\u20b9' }) => {
  return (
    <View style={styles.row}>
      {options.map((value) => {
        const isActive = selected === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            style={({ pressed }) => [styles.chip, isActive && styles.chipActive, pressed && styles.pressedDim]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{prefix}{value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    backgroundColor: COLORS.bg_input,
  },
  chipActive: {
    backgroundColor: COLORS.yellow,
    borderColor: COLORS.yellow,
  },
  chipText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.white_80,
  },
  chipTextActive: {
    color: '#111111',
    fontWeight: '800',
  },
  pressedDim: {
    opacity: 0.75,
  },
});

export default AmountChipRow;
