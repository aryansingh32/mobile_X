import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Dimensions, Easing } from 'react-native';

const { width, height } = Dimensions.get('window');

const Ember = ({ topToBottom }: { topToBottom?: boolean }) => {
  const fallAnim = useRef(new Animated.Value(0)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Use refs to keep random values stable across renders
  const config = useRef({
    startY: topToBottom ? -(Math.random() * 50) - 20 : (Math.random() * height * 0.25) + height * 0.25,
    startX: Math.random() * width,
    size: Math.random() * 4 + 4, // 4px to 8px
    scaleX: Math.random() * 0.6 + 0.7, // 0.7 to 1.3 for uneven stretching
    scaleY: Math.random() * 0.6 + 0.7,
    rotate: `${Math.random() * 360}deg`,
    br1: Math.random() * 6 + 2, // randomized border radii for organic uneven shape
    br2: Math.random() * 6 + 2,
    br3: Math.random() * 6 + 2,
    br4: Math.random() * 6 + 2,
    duration: Math.random() * 3000 + 3500, // 3.5s to 6.5s fall time
    driftDistance: (Math.random() - 0.5) * 80, // Horizontal sway
    delay: Math.random() * 4000
  }).current;

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const startAnimation = () => {
      fallAnim.setValue(0);
      driftAnim.setValue(0);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fallAnim, { toValue: 1, duration: config.duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(driftAnim, { toValue: 1, duration: config.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: Math.random() * 0.4 + 0.2, duration: config.duration * 0.2, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: Math.random() * 0.4 + 0.2, duration: config.duration * 0.6, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: config.duration * 0.2, useNativeDriver: true })
        ])
      ]).start(({ finished }) => {
        if (finished) startAnimation();
      });
    };

    timeout = setTimeout(startAnimation, config.delay);
    return () => clearTimeout(timeout);
  }, [fallAnim, driftAnim, opacityAnim, config]);

  const translateY = fallAnim.interpolate({ inputRange: [0, 1], outputRange: [config.startY, height] });
  const translateX = driftAnim.interpolate({ inputRange: [0, 1], outputRange: [config.startX, config.startX + config.driftDistance] });

  return (
    <Animated.View style={{
      position: 'absolute',
      opacity: opacityAnim,
      transform: [{ translateY }, { translateX }],
      shadowColor: '#e75d0b', 
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8, 
      shadowRadius: config.size, 
      elevation: 2,
    }}>
      <View style={{
        width: config.size * config.scaleX, 
        height: config.size * config.scaleY, 
        borderTopLeftRadius: config.br1,
        borderTopRightRadius: config.br2,
        borderBottomLeftRadius: config.br3,
        borderBottomRightRadius: config.br4,
        backgroundColor: '#e75d0b', 
        transform: [{ rotate: config.rotate }]
      }} />
    </Animated.View>
  );
};

export const FallingEmbers = ({ topToBottom }: { topToBottom?: boolean }) => {
  // Generate 20 falling spark particles
  const embers = Array.from({ length: 20 }).map((_, i) => i);
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]} pointerEvents="none">
      {embers.map(i => <Ember key={i} topToBottom={topToBottom} />)}
    </View>
  );
};
