import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet, StyleProp, ViewStyle, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ShimmerProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const SWEEP_MS = 1100;

export const Shimmer: React.FC<ShimmerProps> = ({ width, height, borderRadius = 4, style }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    if (!layoutWidth) return;
    translateX.setValue(-layoutWidth);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: layoutWidth,
        duration: SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [layoutWidth, translateX]);

  return (
    <View
      style={[styles.shimmer, { width: width as any, height: height as any, borderRadius }, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - layoutWidth) > 1) setLayoutWidth(w);
      }}
    >
      {layoutWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { width: layoutWidth, transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const CARD_WIDTH = windowWidth - 32;

export const ShimmerCard: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  return (
    <View style={[styles.shimmerCardContainer, style]}>
      <Shimmer width="100%" height="60%" borderRadius={12} />
      <View style={styles.textContent}>
        <Shimmer width="80%" height={24} borderRadius={4} style={{ marginBottom: 12 }} />
        <Shimmer width="60%" height={24} borderRadius={4} style={{ marginBottom: 20 }} />

        <Shimmer width="100%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
        <Shimmer width="90%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
        <Shimmer width="70%" height={16} borderRadius={4} style={{ marginBottom: 20 }} />
      </View>
      <View style={styles.footer}>
        <Shimmer width={32} height={32} borderRadius={16} />
        <Shimmer width={100} height={16} borderRadius={4} style={{ marginLeft: 12 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  shimmerCardContainer: {
    width: CARD_WIDTH,
    height: windowHeight * 0.67,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  textContent: {
    padding: 16,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 'auto',
  }
});
