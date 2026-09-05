import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { AffiliateBanner } from '../../api/affiliate';
import { COLORS } from '../../constants/theme';

const { width: windowWidth } = Dimensions.get('window');
const BANNER_WIDTH = windowWidth - 32;
const BANNER_HEIGHT = 150;
const AUTO_SCROLL_MS = 4000;

interface Props {
  banners: AffiliateBanner[];
  onPress: (banner: AffiliateBanner) => void;
}

export const BannerCarousel: React.FC<Props> = ({ banners, onPress }) => {
  const listRef = useRef<FlatList>(null);
  const indexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % banners.length;
      listRef.current?.scrollToIndex({ index: indexRef.current, animated: true });
      setActiveIndex(indexRef.current);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        snapToInterval={BANNER_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + 12));
          indexRef.current = idx;
          setActiveIndex(idx);
        }}
        getItemLayout={(_, index) => ({ length: BANNER_WIDTH + 12, offset: (BANNER_WIDTH + 12) * index, index })}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(item)}>
            <Image source={{ uri: item.imageUrl }} style={styles.banner} contentFit="cover" cachePolicy="memory-disk" transition={150} />
          </TouchableOpacity>
        )}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  banner: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 18,
    backgroundColor: COLORS.bg_card,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.white_30 },
  dotActive: { backgroundColor: COLORS.yellow, width: 16 },
});
