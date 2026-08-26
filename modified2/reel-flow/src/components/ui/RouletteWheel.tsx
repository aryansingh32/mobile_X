import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Sparkles, Play, Zap } from 'lucide-react-native';
import Svg, { Path, G, Text as SvgText, Image as SvgImage } from 'react-native-svg';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { claimRouletteSpin } from '../../api/rewards';
import { useToast } from './Toast';
import { VIBIcon } from './VIBIcon';

const windowWidth = Dimensions.get('window').width;
const WHEEL_SIZE = Math.min(windowWidth - 80, 240);
const CENTER = WHEEL_SIZE / 2;

export type RouletteSlice = {
  id: number;
  label: string;
  color: string;
  rewardCoins: number;
  probability: number;
  sizePortion: number;
  popupType: string;
  imageUrl?: string;
};

type Props = {
  chances: number;
  config: RouletteSlice[];
  onSpinSuccess: (coinsEarned: number, slice: RouletteSlice) => void;
  onWatchAd: () => void;
  isAdPlaying: boolean;
  isAdPenalized: boolean;
  adPenaltyMessage?: string;
  isAdLoading?: boolean;
  autoSpinPending?: boolean;
  onAutoSpinConsumed?: () => void;
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const createArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, r, endAngle);
  const end = polarToCartesian(x, y, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', x, y,
    'L', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
    'Z'
  ].join(' ');
};

export const RouletteWheel = ({
  chances,
  config,
  onSpinSuccess,
  onWatchAd,
  isAdPlaying,
  isAdPenalized,
  adPenaltyMessage,
  isAdLoading = false,
  autoSpinPending = false,
  onAutoSpinConsumed,
}: Props) => {
  const mountedRef = React.useRef(true);
  React.useEffect(() => { return () => { mountedRef.current = false; } }, []);

  const [spinning, setSpinning] = useState(false);
  const [loading, setLoading] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const { showToast } = useToast();

  const totalPortion = config.reduce((sum, item) => sum + item.sizePortion, 0);

  let currentAngle = 0;
  const slicesWithAngles = config.map((slice) => {
    const angle = (slice.sizePortion / totalPortion) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    const centerAngle = startAngle + angle / 2;
    return { ...slice, startAngle, endAngle, centerAngle };
  });

  const handleSpin = async () => {
    if (spinning || loading) return;
    if (chances <= 0) {
      Alert.alert('No spins remaining', 'Watch a sponsored video to get another spin!');
      return;
    }
    if (mountedRef.current) setLoading(true);
    const sessionId = `roulette-spin-${Date.now()}`;
    try {
      const result = await claimRouletteSpin(sessionId);
      if (mountedRef.current) setLoading(false);
      if (mountedRef.current) setSpinning(true);

      const sliceIndex = result.sliceIndex;
      const wonSlice = slicesWithAngles[sliceIndex];

      if (!wonSlice) {
        throw new Error('Invalid slice received from server');
      }

      const centerAngle = wonSlice.centerAngle || 0;

      const rounds = 5;
      const targetRotation = (360 * rounds) + (360 - centerAngle);

      Animated.timing(spinAnim, {
        toValue: targetRotation,
        duration: 4000,
        easing: Easing.out(Easing.bezier(0.2, 0.8, 0.3, 1)),
        useNativeDriver: true,
      }).start(() => {
        if (mountedRef.current) setSpinning(false);
        spinAnim.setValue(targetRotation % 360);
        onSpinSuccess(wonSlice.rewardCoins, wonSlice);
      });
    } catch (err: any) {
      if (mountedRef.current) setLoading(false);
      const errMsg = err?.response?.data?.error || 'Failed to start spin. Please try again.';
      Alert.alert('Spin failed', errMsg);
    }
  };

  useEffect(() => {
    if (autoSpinPending && chances > 0 && !spinning && !loading) {
      if (onAutoSpinConsumed) onAutoSpinConsumed();
      handleSpin();
    }
  }, [autoSpinPending, chances, spinning, loading]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles color="#FFD700" size={18} />
          <Text style={styles.title}>Lucky Spin Wheel</Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Text style={styles.subtitle}>Spin to win up to 1000 </Text>
          <VIBIcon size={12} style={{ marginHorizontal: 2 }} />
          <Text style={styles.subtitle}> daily!</Text>
        </View>
      </View>

      <View style={styles.wheelWrapper}>
        <Animated.View style={[styles.wheelContainer, { transform: [{ rotate: rotation }] }]}>
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
            {slicesWithAngles.map((slice) => {
              const path = createArc(CENTER, CENTER, CENTER - 4, slice.startAngle, slice.endAngle);
              const textRadius = CENTER - 45;
              const imgRadius = CENTER - 65;
              
              const textPos = polarToCartesian(CENTER, CENTER, textRadius, slice.centerAngle);
              const imgPos = polarToCartesian(CENTER, CENTER, imgRadius, slice.centerAngle);
              
              const hex = slice.color.replace('#', '');
              const isDark = hex.length === 6 ? parseInt(hex, 16) > 0xffffff / 2 : false;

              return (
                <G key={slice.id}>
                  <Path d={path} fill={slice.color} />
                  
                  {slice.imageUrl && (
                    <SvgImage
                      x={imgPos.x - 12}
                      y={imgPos.y - 12}
                      width="24"
                      height="24"
                      preserveAspectRatio="xMidYMid slice"
                      href={slice.imageUrl}
                      transform={`rotate(${slice.centerAngle + 90}, ${imgPos.x}, ${imgPos.y})`}
                    />
                  )}

                  <SvgText
                    x={textPos.x}
                    y={textPos.y}
                    fill={isDark ? '#000' : '#fff'}
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${slice.centerAngle + 90}, ${textPos.x}, ${textPos.y})`}
                  >
                    {slice.label}
                  </SvgText>
                </G>
              );
            })}
            <Path d={`M ${CENTER} ${CENTER - 15} A 15 15 0 1 0 ${CENTER} ${CENTER + 15} A 15 15 0 1 0 ${CENTER} ${CENTER - 15}`} fill="#111" />
            <Path d={`M ${CENTER} ${CENTER - 8} A 8 8 0 1 0 ${CENTER} ${CENTER + 8} A 8 8 0 1 0 ${CENTER} ${CENTER - 8}`} fill="#FFD700" />
          </Svg>
        </Animated.View>

        <View style={styles.pinContainer}>
          <Image
            source={require('../../../assets/pin.png')}
            style={styles.pinImage}
            resizeMode="contain"
          />
        </View>

        {loading && (
          <View style={styles.loaderBackdrop}>
            <ActivityIndicator size="large" color="#FFD700" />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.chancesRow}>
          <Text style={styles.chancesText}>
            Spins Remaining:{' '}
            <Text style={[styles.chancesValue, chances > 0 ? styles.positiveText : styles.negativeText]}>
              {chances}
            </Text>
          </Text>
        </View>

        {chances > 0 ? (
          <TouchableOpacity
            style={[styles.spinButton, (spinning || loading) && styles.disabledButton]}
            onPress={handleSpin}
            disabled={spinning || loading}
            activeOpacity={0.8}
          >
            <Zap color="#111" size={16} style={{ marginRight: 6 }} />
            <Text style={styles.spinButtonText}>SPIN NOW</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.adButton, (isAdPlaying || isAdLoading) && styles.disabledButton]}
            onPress={() => {
              if (isAdPenalized) {
                Alert.alert('Slow down a bit', adPenaltyMessage || 'Please wait before watching another ad.');
              } else {
                onWatchAd();
              }
            }}
            disabled={isAdPlaying || isAdLoading}
            activeOpacity={0.8}
          >
            {isAdLoading ? (
              <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 8 }} />
            ) : (
              <Play color="#FFD700" size={14} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.adButtonText}>
              {isAdLoading ? 'LOADING AD...' : 'WATCH AD FOR +1 SPIN'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#161616',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.white_55,
    fontSize: 11,
    fontWeight: '500',
  },
  wheelWrapper: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: SPACING.md,
  },
  wheelContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: WHEEL_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#222',
    borderWidth: 4,
    borderColor: '#333',
  },
  pinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -29.5,
    width: 60,
    height: 60,
    // transform: [{ rotate: '180deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pinImage: {
    width: '100%',
    height: '100%',
  },
  loaderBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: WHEEL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  chancesRow: {
    marginBottom: SPACING.sm,
  },
  chancesText: {
    color: COLORS.white_80,
    fontSize: 12,
    fontWeight: '600',
  },
  chancesValue: {
    fontWeight: '900',
  },
  positiveText: {
    color: '#FFD700',
  },
  negativeText: {
    color: '#FF4D1A',
  },
  spinButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.full,
    width: '85%',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  spinButtonText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  adButton: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.full,
    width: '85%',
  },
  adButtonText: {
    color: '#FFD700',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
