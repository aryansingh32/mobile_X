import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS } from '../../constants/theme';

type AnimatedProgressBarProps = {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  showPercentage?: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const AnimatedProgressBar = ({ progress, color, trackColor, height = 8, showPercentage = false }: AnimatedProgressBarProps) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const safeProgress = clamp(progress);
  const fillColor = color || (safeProgress < 0.3 ? COLORS.red : safeProgress <= 0.7 ? COLORS.yellow : COLORS.green);
  const bgTrackColor = trackColor || COLORS.bg_input;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: safeProgress,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progressAnim, safeProgress]);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  return (
    <View>
      <View onLayout={onLayout} style={[styles.track, { height, borderRadius: RADIUS.full, backgroundColor: bgTrackColor }]}>
        <Animated.View style={[styles.fill, { width: animatedWidth, backgroundColor: fillColor, borderRadius: RADIUS.full }]} />
      </View>
      {showPercentage && <Text style={styles.percentage}>{Math.round(safeProgress * 100)}%</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  percentage: {
    marginTop: 4,
    color: COLORS.white_55,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default AnimatedProgressBar;
