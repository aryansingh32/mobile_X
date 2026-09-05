import React from 'react';
import { View, StyleSheet, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';

const VIB_SOURCE = require('../../../assets/images/vib.webp');

export const VIBIcon = ({
  size = 14,
  style,
  animated = false,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
  /**
   * vib.webp is an animated multi-frame WebP (a rotating diamond — VIB's
   * brand identity). It's used at 50+ call sites app-wide, many of them
   * small inline mentions embedded in sentences, plus CoinRain's burst of
   * 12 simultaneous particles — animating every instance would mean that
   * many decoding/playing animations at once, real CPU cost on a low-end
   * device for motion nobody's actually looking at. So this defaults to a
   * static first frame, and only the prominent, low-concurrency spots
   * (balance ticker, hero card icons, reward-row icons) opt in explicitly.
   */
  animated?: boolean;
}) => (
  <View style={[{ width: size, height: size }, style]}>
    <Image source={VIB_SOURCE} style={styles.image} contentFit="contain" autoplay={animated} />
  </View>
);

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
