import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useScreenFocus } from '../../providers/ScreenFocusContext';

const VIB_SOURCE = require('../../../assets/images/vib.webp');

export const VIBIcon = ({ size = 14, style, animated }: { size?: number; style?: StyleProp<ViewStyle>; animated?: boolean }) => {
  const isScreenFocused = useScreenFocus();
  // animated left unset (the common case, ~30 call sites app-wide) => follow
  // the owning tab's focus, via ScreenFocusContext: icons animate only on
  // whichever tab is currently on screen. This matters because App.tsx's
  // tabs stay mounted forever rather than unmounting on switch — without
  // this, every icon on every previously-visited tab would keep decoding
  // its animation loop in the background indefinitely (display:none doesn't
  // pause it), which is what caused the earlier sustained low frame rate.
  // Pass animated={false} explicitly at dense-burst sites (CoinRain's 12
  // particles, GiftBoxBurst's 10 coins) to force it off even while focused —
  // that many simultaneous decodes is real cost regardless of visibility.
  const shouldAnimate = animated ?? isScreenFocused;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image source={VIB_SOURCE} style={styles.image} contentFit="contain" autoplay={shouldAnimate} />
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
