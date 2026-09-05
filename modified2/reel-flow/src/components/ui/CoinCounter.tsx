import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { triggerHaptic } from '../../utils/haptics';
import { VIBIcon } from './VIBIcon';
import { COLORS } from '../../constants/theme';

type CoinCounterProps = {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'hero';
};

const fontSizes = {
  sm: 14,
  md: 20,
  lg: 32,
  hero: 48,
};

const CoinCounter = ({ value, size = 'md' }: CoinCounterProps) => {
  // Driven by Reanimated so the count-up tween itself runs on the UI thread
  // (immune to JS-thread congestion elsewhere in the app) instead of the old
  // Animated API, which computed the eased value on the JS thread every
  // frame via a bridge listener. The rounded integer is still pushed into
  // React state (unavoidable — Text content can't be set without React) but
  // only when it actually changes, via runOnJS from a UI-thread reaction.
  const animatedValue = useSharedValue(0);
  const previousValue = useRef(0);
  const lastHapticBucket = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);

  const handleRoundedChange = (rounded: number) => {
    setDisplayValue(rounded);
    const bucket = Math.floor(rounded / 10);
    if (bucket > lastHapticBucket.current) {
      lastHapticBucket.current = bucket;
      triggerHaptic('impact-light');
    }
  };

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (rounded, previousRounded) => {
      if (rounded !== previousRounded) {
        runOnJS(handleRoundedChange)(rounded);
      }
    },
  );

  useEffect(() => {
    lastHapticBucket.current = Math.floor(previousValue.current / 10);
    animatedValue.value = previousValue.current;
    animatedValue.value = withTiming(
      value,
      { duration: 800, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setDisplayValue)(value);
        }
      },
    );
    previousValue.current = value;
  }, [value, animatedValue]);

  return (
    <View style={styles.row}>
      <Text style={[styles.value, { fontSize: fontSizes[size] }]}>{displayValue.toLocaleString()}</Text>
      <VIBIcon size={fontSizes[size]} style={styles.coin} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    color: COLORS.yellow,
    fontWeight: '800',
  },
  coin: {
    marginLeft: 6,
  },
});

export default CoinCounter;
