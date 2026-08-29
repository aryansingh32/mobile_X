import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated, Linking, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { DiscoverCardData } from '../../data/discoverMock';
import { ShatterWrapper } from '../ui/ShatterWrapper';
import { LinearGradient } from 'expo-linear-gradient';
import { VIBIcon } from '../ui/VIBIcon';
import { MOTION } from '../../constants/theme';

export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  data: DiscoverCardData;
  index: number;
  scrollY: Animated.Value;
  onPress: (data: DiscoverCardData, layout: CardLayout) => void;
  isLoading?: boolean;
  isShattered?: boolean;
  onShatterComplete?: () => void;
}

const { width, height: windowHeight } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
export const CARD_HEIGHT = windowHeight * 0.67; // 60% of screen height to fit previous/next perfectly
export const ITEM_SPACING = 5;
export const ITEM_SIZE = CARD_HEIGHT + ITEM_SPACING;

export const DiscoverCard: React.FC<Props> = ({ data, index, scrollY, onPress, isLoading, isShattered, onShatterComplete }) => {
  const containerRef = useRef<View>(null);
  const adCtaScale = useRef(new Animated.Value(1)).current;
  const footerScale = useRef(new Animated.Value(1)).current;
  const [adButtonActive, setAdButtonActive] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const imageShimmerAnim = React.useRef(new Animated.Value(0)).current;
  const rewardCoins = Number((data as any).coins || 0);

  // Shimmer pulse animation for unloaded images
  React.useEffect(() => {
    if (data.isAd || imageLoaded) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(imageShimmerAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(imageShimmerAnim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [data.isAd, imageLoaded, imageShimmerAnim]);

  const shimmerOpacity = imageShimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });


  React.useEffect(() => {
    if (data.isAd) {
      // 5-second delay before CTA button activates
      const timer = setTimeout(() => {
        setAdButtonActive(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [data.isAd]);

  const inputRange = [
    (index - 1) * ITEM_SIZE,
    index * ITEM_SIZE,
    (index + 1) * ITEM_SIZE,
  ];

  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.9, 1, 0.9],
    extrapolate: 'clamp',
  });

  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.4, 1, 0.4],
    extrapolate: 'clamp',
  });

  const blurOpacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.7, 0, 0.7], // Stronger fade for previous/next cards
    extrapolate: 'clamp',
  });

  const handlePress = () => {
    containerRef.current?.measure((fx, fy, w, h, px, py) => {
      onPress(data, { x: px, y: py, width: w, height: h });
    });
  };

  return (
    <Animated.View style={[
      { height: CARD_HEIGHT, width: CARD_WIDTH, alignSelf: 'center', marginBottom: ITEM_SPACING, transform: [{ scale }], opacity },
      {
        shadowColor: data.bgColor,
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
        elevation: 10, // Was 30 — that forced an oversized offscreen shadow buffer per card, per frame, for every visible card in the feed
      }
    ]}>
      <ShatterWrapper
        isShattered={!!isShattered}
        onAnimationComplete={onShatterComplete}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        glassColor={data.bgColor || '#1A1A2E'}
      >
        <Pressable
          ref={containerRef as any}
          style={({ pressed }) => [
            styles.container,
            { backgroundColor: data.bgColor || (data.isAd ? '#1A1A2E' : '#2A2A2A') },
            data.isAd && styles.adContainer,
            pressed && !data.isAd && { opacity: 0.75 },
          ]}
          onPress={data.isAd ? undefined : handlePress}
          // Ad cards have their own CTA button below and aren't tappable as a
          // whole, so only the article cards announce as buttons.
          accessibilityRole={data.isAd ? undefined : 'button'}
          accessibilityLabel={data.isAd ? undefined : `${data.title || 'Article'}. Tap to read.`}
        >
        {data.isAd ? (
          <View style={styles.adContent}>
            <Text style={styles.adLabel}>Sponsored</Text>
            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <View style={styles.adPlayIconContainer}>
                <Text style={{ fontSize: 32 }}>▶</Text>
              </View>
              <Text style={styles.adTitle}>
                {rewardCoins > 0 ? (
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={{color: '#FFF', fontSize: 13, fontWeight: '700'}}>Watch Video, Earn {rewardCoins} </Text>
                    <VIBIcon size={22} style={{ marginHorizontal: 2 }} />
                  </View>
                ) : 'Watch Sponsored Video'}
              </Text>
              <Text style={styles.adSubtitle}>Watch the full video without skipping to claim your reward</Text>
              
              <View style={styles.adRewardChip}>
                <Text style={styles.adRewardText}>
                  {rewardCoins > 0 ? (
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={{color: '#FFD700', fontSize: 12, fontWeight: '700'}}>{rewardCoins} </Text>
                      <VIBIcon size={14} style={{ marginHorizontal: 2 }} />
                      <Text style={{color: '#FFD700', fontSize: 12, fontWeight: '700'}}> Reward</Text>
                    </View>
                  ) : 'Reward Video'}
                </Text>
              </View>
            </View>
            
            <Animated.View style={{ marginTop: 'auto', transform: [{ scale: adCtaScale }] }}>
              <Pressable
                style={[styles.adCtaButton, (!adButtonActive || isLoading) && styles.adCtaButtonDisabled]}
                disabled={!adButtonActive || isLoading}
                onPressIn={() => Animated.spring(adCtaScale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
                onPressOut={() => Animated.spring(adCtaScale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
                onPress={() => onPress(data, { x: 0, y: 0, width: 0, height: 0 })}
                accessibilityRole="button"
                accessibilityState={{ disabled: !adButtonActive || isLoading, busy: isLoading }}
                accessibilityLabel={
                  isLoading
                    ? 'Loading advertisement'
                    : adButtonActive
                      ? `Watch a sponsored video${rewardCoins > 0 ? ` to earn ${rewardCoins} coins` : ''}`
                      : 'Sponsored video not ready yet'
                }
              >
                {isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFD700" />
                    <Text style={[styles.adCtaText, { color: '#FFD700' }]}>Loading Ad...</Text>
                  </View>
                ) : (
                  <Text style={styles.adCtaText}>{adButtonActive ? 'Watch Video →' : 'Wait...'}</Text>
                )}
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <>
            {/* Top Image Section */}
            <View style={styles.imageWrapper}>
              {data.imageUri && !data.imageUri.includes('placeholder.com') ? (
                <>
                  <Image
                    source={{ uri: data.imageUri }}
                    style={styles.image}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="normal"
                    transition={200}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)} // Treat error as loaded to stop shimmer
                  />
                  {/* Image loading shimmer overlay — hides once image is loaded */}
                  {!imageLoaded && (
                    <Animated.View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: '#2A2A2A', borderRadius: 12, opacity: shimmerOpacity },
                      ]}
                      pointerEvents="none"
                    />
                  )}
                </>
              ) : (
                /* No image: render colored gradient background with title overlay */
                <View style={[styles.image, styles.noImagePlaceholder, { backgroundColor: data.bgColor || '#2A2A3E' }]}>
                  <View style={styles.noImageIconRow}>
                    <Text style={styles.noImageIcon}>📰</Text>
                  </View>
                  <Text style={styles.noImageLabel} numberOfLines={3}>{data.title}</Text>
                </View>
              )}
            </View>


            {/* Content Section */}
            <View style={styles.content}>
              <View>
                <Text style={styles.title} numberOfLines={2}>{data.title}</Text>
                <Text style={styles.description} numberOfLines={3}>{data.description}</Text>
              </View>
              <Animated.View style={{ transform: [{ scale: footerScale }] }}>
                <Pressable
                  style={styles.footer}
                  onPressIn={() => Animated.spring(footerScale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
                  onPressOut={() => Animated.spring(footerScale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start()}
                  onPress={() => {
                    if (data.sourceUrl) {
                      Linking.openURL(data.sourceUrl).catch(err => console.error("Failed to open source URL", err));
                    }
                  }}
                >
                  <Image source={{ uri: data.authorAvatar }} style={styles.avatar} cachePolicy="memory-disk" />
                  <Text style={styles.username}>{data.authorUsername}</Text>
                </Pressable>
              </Animated.View>
            </View>
          </>
        )}
        
        {/* Blur/Dark overlay for unfocused cards */}
        <Animated.View style={[styles.blurOverlay, { opacity: blurOpacity }]} pointerEvents="none" />
        </Pressable>
      </ShatterWrapper>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageWrapper: {
    height: '60%', // <-- HOW TO INCREASE IMAGE SIZE: Increase this to '60%' or '65%' (and reduce content height below so it equals 100%)
    width: '100%',
    padding: 10, // <-- HOW TO ADJUST BORDER AROUND IMAGE: Change this (e.g. 8 for thinner border, 16 for thicker border)
    paddingBottom: 4,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12, // Round inner image corners
  },
  noImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    opacity: 0.9,
  },
  noImageIconRow: {
    marginBottom: 12,
  },
  noImageIcon: {
    fontSize: 36,
    opacity: 0.7,
  },
  noImageLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'serif',
  },
  content: {
    height: '40%', // <-- If you increase image height above, decrease this so they still equal 100%
    padding: 16,
    paddingTop: 12,
    justifyContent: 'space-between', // This automatically spaces elements to fill the height
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: 'serif',
    marginBottom: 12, // <-- HOW TO ADJUST SPACING: Increase this to add more gap between the Headline and Description
    lineHeight: 26,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'serif',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12, // <-- HOW TO ADJUST SPACING: Increase this to add more gap between Description and Footer
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#CCC',
  },
  username: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  adContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  adContent: {
    flex: 1,
    padding: 24,
  },
  adLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    position: 'absolute',
    top: 16,
    left: 16,
  },
  adPlayIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,215,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  adTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  adSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  adRewardChip: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  adRewardText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
  },
  adCtaButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  adCtaButtonDisabled: {
    backgroundColor: '#333',
  },
  adCtaText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
