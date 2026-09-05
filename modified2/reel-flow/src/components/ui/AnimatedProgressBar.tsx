import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  // `width` is a layout property — the old Animated API can only animate it
  // on the JS thread (useNativeDriver: false), so this rode the bridge every
  // frame and could stutter whenever the JS thread was busy elsewhere.
  // Reanimated's worklets run on the UI thread regardless of which style
  // property they touch, so this now stays smooth under JS-thread load.
  const progressAnim = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const safeProgress = clamp(progress);
  const fillColor = color || (safeProgress < 0.3 ? COLORS.red : safeProgress <= 0.7 ? COLORS.yellow : COLORS.green);
  const bgTrackColor = trackColor || COLORS.bg_input;

  useEffect(() => {
    progressAnim.value = withTiming(safeProgress, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [safeProgress, progressAnim]);

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: progressAnim.value * trackWidth,
  }));

  return (
    <View>
      <View onLayout={onLayout} style={[styles.track, { height, borderRadius: RADIUS.full, backgroundColor: bgTrackColor }]}>
        <Animated.View style={[styles.fill, fillStyle, { backgroundColor: fillColor, borderRadius: RADIUS.full }]} />
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
