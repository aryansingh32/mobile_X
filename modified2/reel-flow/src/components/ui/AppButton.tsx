import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { COLORS, MOTION, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { triggerHaptic } from '../../utils/haptics';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  hapticStyle?: 'impact-light' | 'impact-medium' | 'success' | null;
};

/**
 * Single button primitive for the whole app. Replaces raw TouchableOpacity used
 * as a CTA. Every primary action (Home referral button, Wallet redeem, Rewards
 * claim, Games "Play Now", onboarding "Continue") should use this instead of a
 * one-off styled TouchableOpacity so press feedback and disabled/loading states
 * are consistent everywhere.
 */
export const AppButton: React.FC<AppButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  hapticStyle = 'impact-light',
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  const handlePress = () => {
    if (isDisabled) return;
    if (hapticStyle) triggerHaptic(hapticStyle);
    onPress();
  };

  const variantStyle = VARIANT_STYLES[variant];

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { width: '100%' }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled }}
        style={[styles.base, variantStyle.container, isDisabled && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyle.text.color as string} />
        ) : (
          <View style={styles.content}>
            {icon && iconPosition === 'left' ? <View style={styles.iconWrap}>{icon}</View> : null}
            <Text style={[styles.label, variantStyle.text]} numberOfLines={1}>
              {label}
            </Text>
            {icon && iconPosition === 'right' ? <View style={styles.iconWrap}>{icon}</View> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const VARIANT_STYLES = {
  primary: {
    container: { backgroundColor: COLORS.yellow },
    text: { color: '#111111' },
  },
  secondary: {
    container: { backgroundColor: COLORS.bg_elevated, borderWidth: 1, borderColor: COLORS.border_card },
    text: { color: COLORS.white },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: COLORS.yellow },
  },
  danger: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)' },
    text: { color: COLORS.red },
  },
} as const;

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginHorizontal: SPACING.xs,
  },
  label: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
  },
});

export default AppButton;
