import React, { useRef } from 'react';
import { NativeSyntheticEvent, StyleSheet, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

type OTPInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
};

/**
 * 4-box (default) OTP input — individual bordered squares, auto-advances focus.
 * UI shell only: wire the actual "verify" API call in the screen that uses this.
 */
export const OTPInput: React.FC<OTPInputProps> = ({ length = 4, value, onChange }) => {
  const inputs = useRef<Array<TextInput | null>>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handleChangeText = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');
    if (!clean) {
      const next = digits.slice();
      next[index] = '';
      onChange(next.join(''));
      return;
    }
    const next = digits.slice();
    next[index] = clean[clean.length - 1];
    onChange(next.join(''));
    if (index < length - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => { inputs.current[index] = ref; }}
          style={[styles.box, digit ? styles.boxFilled : null]}
          value={digit}
          onChangeText={(t) => handleChangeText(t, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          accessibilityLabel={`Digit ${index + 1} of ${length}`}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  box: {
    width: 56,
    height: 64,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border_card,
    backgroundColor: COLORS.bg_input,
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
  },
  boxFilled: {
    borderColor: COLORS.yellow,
  },
});

export default OTPInput;
