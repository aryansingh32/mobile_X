import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, StyleProp, ViewStyle, Dimensions } from 'react-native';

interface ShimmerProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Shimmer: React.FC<ShimmerProps> = ({ width, height, borderRadius = 4, style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.7,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.3,
        duration: 900,
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(pulse).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.shimmer,
        { width: width as any, height: height as any, borderRadius, opacity },
        style,
      ]}
    />
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
