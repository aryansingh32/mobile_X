import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated, Easing, Modal, Linking, Share } from 'react-native';
import { Image } from 'expo-image';
import { DiscoverCardData } from '../../data/discoverMock';
import { X, Share2, Clock, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CardLayout } from './DiscoverCard';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAppStore } from '../../store/useAppStore';
import { triggerHaptic } from '../../utils/haptics';
import { useAdPlacement } from '../../hooks/useAdPlacement';
import { useAdUnitId } from '../../hooks/useAdUnitId';
import { NativeAdCard } from '../ads/NativeAdCard';
import { MOTION } from '../../constants/theme';

interface Props {
  data: DiscoverCardData | null;
  layout: CardLayout | null;
  onClose: () => void;
}

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

// Small shared press-scale helper — each call owns its own Animated.Value so
// sibling buttons (close/share/source/read-more) animate independently.
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: MOTION.press_scale, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...MOTION.spring_snappy }).start();
  };
  return { scale, onPressIn, onPressOut };
}

export const DiscoverDetail: React.FC<Props> = ({ data, layout, onClose }) => {
  const insets = useSafeAreaInsets();
  const { isAdPlaying } = useAppStore(useShallow(s => ({ isAdPlaying: s.isAdPlaying })));
  const { config: bannerPlacement } = useAdPlacement('news_article_banner');
  const adUnitId = useAdUnitId(bannerPlacement?.adUnitKey ?? 'NEWS_BANNER', TestIds.BANNER);
  const nativeAdUnitId = useAdUnitId('NATIVE', TestIds.NATIVE);
  const [isVisible, setIsVisible] = useState(false);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  const animatedValue = useRef(new Animated.Value(0)).current;
  const closePress = usePressScale();
  const sharePress = usePressScale();
  const sourcePress = usePressScale();
  const readFullPress = usePressScale();

  // We keep track of rendering so the component can unmount after close animation
  useEffect(() => {
    if (data && layout) {
      setIsVisible(true);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else if (!data && isVisible) {
      // Close animation
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setIsVisible(false);
      });
    }
  }, [data, layout]);

  if (!isVisible || !data || !layout) return null;

  // Use the card's bgColor as the theme color for the detail page
  const themeColor = data.bgColor || '#1E1E1E';

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [windowHeight, 0],
  });

  const contentOpacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1], // Delay content fading in until animation is halfway
  });

  const handleOpenSource = () => {
    if (data.sourceUrl) {
      triggerHaptic('impact-light');
      Linking.openURL(data.sourceUrl).catch(err => console.error("Failed to open source URL", err));
    }
  };

  const handleShare = async () => {
    if (!data.sourceUrl) return;
    triggerHaptic('impact-light');
    await Share.share({ message: `${data.title}\n${data.sourceUrl}`, url: data.sourceUrl });
  };

  return (
    <Modal transparent visible={isVisible} animationType="none" presentationStyle="overFullScreen">
      <Animated.View style={[styles.container, { transform: [{ translateY }], top: 0, left: 0, right: 0, bottom: 0, backgroundColor: themeColor }]}>
        
        {/* Sticky Header with Gradient Overlay */}
        <Animated.View style={[styles.headerWrapper, { opacity: contentOpacity }]}>
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
            <Animated.View style={{ transform: [{ scale: closePress.scale }] }}>
              <Pressable
                style={styles.iconButton}
                onPress={onClose}
                onPressIn={closePress.onPressIn}
                onPressOut={closePress.onPressOut}
              >
                <X color="#FFF" size={24} />
              </Pressable>
            </Animated.View>
            <View style={styles.rightIcons}>
              <Animated.View style={{ transform: [{ scale: sharePress.scale }] }}>
                <Pressable
                  style={styles.iconButton}
                  onPress={handleShare}
                  onPressIn={sharePress.onPressIn}
                  onPressOut={sharePress.onPressOut}
                >
                  <Share2 color="#FFF" size={20} />
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        <ScrollView style={styles.scrollView} bounces={false} showsVerticalScrollIndicator={false}>
          {/* Top Image — expo-image so this reuses the memory-disk cache the
              card's own thumbnail already populated, instead of RN's Image
              re-fetching the same URL from scratch on every article open. */}
          <Animated.View style={[styles.imageContainer, { height: windowHeight * 0.45 }]}>
            <Image
              source={{ uri: data.imageUri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
              transition={150}
              onLoad={() => setHeroImageLoaded(true)}
              onError={() => setHeroImageLoaded(true)}
            />
            {!heroImageLoaded && (
              <View style={[StyleSheet.absoluteFill, styles.heroShimmer]} pointerEvents="none" />
            )}
          </Animated.View>

          {/* Content Section - uses theme color as background */}
          <Animated.View style={[styles.contentContainer, { opacity: contentOpacity, backgroundColor: themeColor }]}>
            <Text style={styles.title}>{data.title}</Text>

            {/* Description */}
            {data.description ? (
              <Text style={styles.detailDescription}>{data.description}</Text>
            ) : null}
            
            <View style={styles.metaRow}>
              <Animated.View style={{ transform: [{ scale: sourcePress.scale }] }}>
                <Pressable
                  style={styles.sourcesPill}
                  onPress={handleOpenSource}
                  onPressIn={sourcePress.onPressIn}
                  onPressOut={sourcePress.onPressOut}
                >
                  {/* Two overlapping circles simulation */}
                  <View style={styles.sourceIcons}>
                    <View style={[styles.sourceCircle, { backgroundColor: '#FF3B30', zIndex: 2 }]} />
                    <View style={[styles.sourceCircle, { backgroundColor: '#007AFF', marginLeft: -8, zIndex: 1 }]} />
                  </View>
                  <Text style={styles.sourcesText}>{data.authorUsername || '1 Source'}</Text>
                  <ExternalLink color="rgba(255,255,255,0.6)" size={12} style={{ marginLeft: 6 }} />
                </Pressable>
              </Animated.View>
              
              <View style={styles.timeContainer}>
                <Clock color="rgba(255,255,255,0.5)" size={14} style={{ marginRight: 4 }} />
                <Text style={styles.timeText}>{data.timeAgo}</Text>
              </View>
            </View>

            <View style={styles.bulletsContainer}>
              {Array.isArray(data.bullets) ? data.bullets.map((bullet: any, index: number) => (
                <View key={index} style={styles.bulletRow}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <View style={styles.bulletTextContainer}>
                    <Text style={styles.bulletText}>{bullet.text}</Text>
                    {bullet.sourcePill && (
                      <View style={styles.bulletSourcePill}>
                        <Text style={styles.bulletSourceText}>{bullet.sourcePill}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )) : null}
            </View>

            {/* Read Full Article Button */}
            {data.sourceUrl ? (
              <Animated.View style={{ transform: [{ scale: readFullPress.scale }] }}>
                <Pressable
                  style={styles.readFullButton}
                  onPress={handleOpenSource}
                  onPressIn={readFullPress.onPressIn}
                  onPressOut={readFullPress.onPressOut}
                >
                  <ExternalLink color="#FFF" size={16} />
                  <Text style={styles.readFullText}>Read Full Article</Text>
                </Pressable>
              </Animated.View>
            ) : null}

            {!isAdPlaying ? <NativeAdCard unitId={nativeAdUnitId} /> : null}

            {/* Banner Ad Section */}
            {!isAdPlaying && adUnitId && (
              <View style={styles.bannerAdContainer}>
                <BannerAd
                  unitId={adUnitId}
                  size={BannerAdSize.MEDIUM_RECTANGLE}
                  requestOptions={{
                    requestNonPersonalizedAdsOnly: true,
                  }}
                />
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 100,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heroShimmer: {
    backgroundColor: '#2A2A2A',
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24, // Extra padding to let the gradient drop smoothly below the icons
  },
  rightIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: windowHeight * 0.2, // Added bottom padding to allow content to scroll up into the center
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: 'serif',
    lineHeight: 32,
    marginBottom: 12,
  },
  detailDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: 'serif',
    lineHeight: 24,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sourcesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sourceIcons: {
    flexDirection: 'row',
    marginRight: 8,
  },
  sourceCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sourcesText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  bulletsContainer: {
    gap: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletPoint: {
    color: '#FFF',
    fontSize: 20,
    lineHeight: 24,
    marginRight: 12,
    marginTop: -2,
  },
  bulletTextContainer: {
    flex: 1,
  },
  bulletText: {
    color: '#E0E0E0',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'serif',
  },
  bulletSourcePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  bulletSourceText: {
    color: '#AAA',
    fontSize: 12,
  },
  readFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  readFullText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  bannerAdContainer: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24, // Keep distance from bottom nav
  }
});
