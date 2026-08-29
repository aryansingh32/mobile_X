import React from 'react';
import { View, StyleSheet, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';

const VIB_SOURCE = require('../../../assets/images/vib.webp');

export const VIBIcon = ({ size = 14, style }: { size?: number; style?: StyleProp<ImageStyle> }) => (
  <View style={[{ width: size, height: size }, style]}>
    {/* vib.webp is an animated multi-frame WebP. Used as a static coin icon at
        30+ call sites app-wide (including up to a dozen at once in CoinRain),
        autoplay would mean every one of them is continuously decoding/playing
        an animation nobody asked for — real, constant CPU cost on a low-end
        device. autoplay=false renders just the first frame. */}
    <Image source={VIB_SOURCE} style={styles.image} contentFit="contain" autoplay={false} />
  </View>
);

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
