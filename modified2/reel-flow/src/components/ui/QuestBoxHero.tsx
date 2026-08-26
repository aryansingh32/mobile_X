import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

type QuestBoxHeroProps = {
  size?: number;
  onOpened?: () => void;
  autoPlay?: boolean;
};

export const QuestBoxHero: React.FC<QuestBoxHeroProps> = ({ size = 200, onOpened, autoPlay = true }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.7)).current;
  const lift = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    if (!autoPlay) return;

    // Pulse rings endlessly
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();

    // Pop in and slightly lift
    Animated.parallel([
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(lift, {
        toValue: 0,
        tension: 30,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onOpened?.();
    });

  }, [autoPlay, pulseAnim, imageScale, lift, onOpened]);

  const pulseScale1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5]
  });
  const pulseOpacity1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0]
  });

  const pulseScale2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8]
  });
  const pulseOpacity2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0]
  });

  return (
    <Animated.View style={[styles.container, { width: size, height: size, transform: [{ scale: imageScale }, { translateY: lift }] }]}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale1 }], opacity: pulseOpacity1 }]} />
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale2 }], opacity: pulseOpacity2 }]} />
      
      <Image 
        source={require('../../../assets/images/chest.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFD700',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
});

export default QuestBoxHero;
