import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { fetchMarqueeItems, MarqueeItem } from '../../api/marquee';

const CHIP_MESSAGES_ROW1 = [
  "withdrawn 1000 VIB", "redeemed a hoodie", "unlocked a mystery box",
  "referred 5 friends", "100% trusted", "won a jackpot",
  "redeemed premium pass", "got instant payout", "loved the rewards"
];

const CHIP_MESSAGES_ROW2 = [
  "joined now", "cashed out 5000 VIB", "done feedback",
  "shared with friends", "referral rewarded", "redeemed success",
  "i liked this app", "just unlocked premium", "earned 10000 VIB"
];

export const MarqueeRow = ({ items, direction, isBottom }: { items: MarqueeItem[], direction: 'left' | 'right', isBottom?: boolean }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    if (contentWidth === 0) return;

    // Restarts itself forever via the .start() completion callback — needs
    // an explicit stop flag since there's no single Animated.loop object to
    // .stop() on unmount, and this runs unconditionally on the Home screen.
    let stopped = false;
    let current: Animated.CompositeAnimation | null = null;

    const startAnimation = () => {
      if (stopped) return;
      const startVal = direction === 'left' ? 0 : -contentWidth;
      const endVal = direction === 'left' ? -contentWidth : 0;

      scrollX.setValue(startVal);
      current = Animated.timing(scrollX, {
        toValue: endVal,
        duration: contentWidth * 25,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      current.start(({ finished }) => {
        if (finished && !stopped) startAnimation();
      });
    };

    startAnimation();
    return () => {
      stopped = true;
      current?.stop();
    };
  }, [contentWidth, scrollX, direction]);

  const renderChips = (onLayout?: any) => (
    <View style={{ flexDirection: 'row' }} onLayout={onLayout}>
      {items.map((item, index) => (
        <View key={item.id || index} style={styles.chip}>
          <Image
            source={{ uri: item.imageUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${item.text.replace(/\\s/g, '')}${isBottom ? '2' : ''}` }}
            style={styles.chipAvatar}
            cachePolicy="memory-disk"
            priority="low"
          />
          <Text style={styles.chipText}>{item.text}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Animated.View style={[styles.marqueeContent, { transform: [{ translateX: scrollX }], marginBottom: isBottom ? 0 : 12 }]}>
      {renderChips((e: any) => setContentWidth(e.nativeEvent.layout.width))}
      {renderChips()}
      {renderChips()}
    </Animated.View>
  );
};

export const AutoMarquee = () => {
  const [row1Items, setRow1Items] = useState<MarqueeItem[]>([]);
  const [row2Items, setRow2Items] = useState<MarqueeItem[]>([]);

  useEffect(() => {
    const loadItems = async () => {
      const apiItems = await fetchMarqueeItems();
      if (apiItems && apiItems.length > 0) {
        const half = Math.ceil(apiItems.length / 2);
        setRow1Items(apiItems.slice(0, half));
        setRow2Items(apiItems.slice(half));
      } else {
        // Fallback to hardcoded values
        setRow1Items(CHIP_MESSAGES_ROW1.map((text, i) => ({ id: `r1-${i}`, text })));
        setRow2Items(CHIP_MESSAGES_ROW2.map((text, i) => ({ id: `r2-${i}`, text })));
      }
    };
    loadItems();
  }, []);

  if (row1Items.length === 0) return null;

  return (
    <View style={styles.marqueeContainer}>
      <MarqueeRow items={row1Items} direction="left" />
      <MarqueeRow items={row2Items} direction="right" isBottom />
    </View>
  );
};

const styles = StyleSheet.create({
  marqueeContainer: {
    height: 100,
    overflow: 'hidden',
    width: '100%',
    opacity: 0.5,
  },
  marqueeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 24,
    paddingVertical: 8, 
    paddingHorizontal: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  chipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default AutoMarquee;
