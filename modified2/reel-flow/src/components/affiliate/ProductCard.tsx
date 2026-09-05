import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { AffiliateProduct } from '../../api/affiliate';
import { VIBIcon } from '../ui/VIBIcon';
import { Shimmer } from '../ui/Shimmer';
import { COLORS } from '../../constants/theme';

interface Props {
  product: AffiliateProduct;
  variant?: 'grid' | 'row';
  onPress: (product: AffiliateProduct) => void;
}

export const ProductCard: React.FC<Props> = ({ product, variant = 'grid', onPress }) => {
  const [loaded, setLoaded] = useState(false);
  const isRow = variant === 'row';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, isRow ? styles.cardRow : styles.cardGrid]}
      onPress={() => onPress(product)}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          priority="low"
          onLoad={() => setLoaded(true)}
        />
        {!loaded && <Shimmer style={StyleSheet.absoluteFill} borderRadius={12} />}
        <View style={styles.platformBadge}>
          <Text style={styles.platformBadgeText}>{product.platform}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
      <Text style={styles.price}>₹{product.price}</Text>
      <View style={styles.rewardRow}>
        <VIBIcon size={13} />
        <Text style={styles.rewardText}>Earn up to {product.vibReward}</Text>
      </View>
      <View style={styles.buyBtn}>
        <Text style={styles.buyBtnText}>Buy</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg_card,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border_card,
  },
  cardGrid: { width: '48%', marginBottom: 14 },
  cardRow: { width: 150, marginRight: 12 },
  imageWrap: {
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.bg_elevated,
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
  platformBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  platformBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '700' },
  title: { color: COLORS.white, fontSize: 13, fontWeight: '700', marginBottom: 4, minHeight: 34 },
  price: { color: COLORS.green, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rewardText: { color: COLORS.yellow, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  buyBtn: {
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
});
