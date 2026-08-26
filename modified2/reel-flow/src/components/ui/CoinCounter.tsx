import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
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
  const animatedValue = useRef(new Animated.Value(0)).current;
  const previousValue = useRef(0);
  const lastHapticBucket = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: current }) => {
      const rounded = Math.round(current);
      setDisplayValue(rounded);
      const bucket = Math.floor(rounded / 10);
      if (bucket > lastHapticBucket.current) {
        lastHapticBucket.current = bucket;
        triggerHaptic('impact-light');
      }
    });

    return () => animatedValue.removeListener(listenerId);
  }, [animatedValue]);

  useEffect(() => {
    lastHapticBucket.current = Math.floor(previousValue.current / 10);
    animatedValue.setValue(previousValue.current);
    Animated.timing(animatedValue, {
      toValue: value,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      previousValue.current = value;
      setDisplayValue(value);
    });
  }, [animatedValue, value]);

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
