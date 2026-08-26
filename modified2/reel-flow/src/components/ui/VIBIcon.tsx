import React from 'react';
import { View, StyleSheet, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';

const VIB_SOURCE = require('../../../assets/images/vib.webp');

export const VIBIcon = ({ size = 14, style }: { size?: number; style?: StyleProp<ImageStyle> }) => (
  <View style={[{ width: size, height: size }, style]}>
    <Image source={VIB_SOURCE} style={styles.image} contentFit="contain" />
  </View>
);

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
