import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, Linking, RefreshControl } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { AffiliateProduct, AffiliateBanner, getAffiliateProducts, getAffiliateBanners, trackAffiliateClick } from '../../api/affiliate';
import { ProductCard } from './ProductCard';
import { BannerCarousel } from './BannerCarousel';
import { Shimmer } from '../ui/Shimmer';
import { useToast } from '../ui/Toast';
import { COLORS } from '../../constants/theme';

const SHELF_SECTIONS: { key: AffiliateProduct['section']; title: string }[] = [
  { key: 'FEATURED', title: 'Featured' },
  { key: 'TRENDING', title: 'Trending Now' },
  { key: 'DEALS', title: 'Deals For You' },
];

export const StoreScreen: React.FC = () => {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [banners, setBanners] = useState<AffiliateBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const [productsRes, bannersRes] = await Promise.all([getAffiliateProducts(), getAffiliateBanners()]);
      setProducts(productsRes);
      setBanners(bannersRes);
    } catch {
      // Store is a nice-to-have surface — fail quietly into an empty state
      // rather than an error banner blocking the whole Rewards tab.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set);
  }, [products]);

  const isSearching = search.trim().length > 0;

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (query && !p.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [products, search, category]);

  const shelves = useMemo(() => {
    if (isSearching || category) return [];
    return SHELF_SECTIONS.map((shelf) => ({
      ...shelf,
      products: products.filter((p) => p.section === shelf.key),
    })).filter((shelf) => shelf.products.length > 0);
  }, [products, isSearching, category]);

  const gridProducts = useMemo(() => {
    if (isSearching || category) return filteredProducts;
    return filteredProducts.filter((p) => p.section === 'GENERAL');
  }, [filteredProducts, isSearching, category]);

  const handleBuy = useCallback(async (product: AffiliateProduct) => {
    try {
      const result = await trackAffiliateClick(product.id);
      await Linking.openURL(result.affiliateUrl || product.affiliateUrl);
      showToast(`Opening ${product.platform}… VIB is credited after your purchase is verified.`, 'info');
    } catch {
      // Even if click-tracking fails, still let the user complete the purchase.
      Linking.openURL(product.affiliateUrl).catch(() => showToast('Could not open the product link', 'error'));
    }
  }, [showToast]);

  const handleBannerPress = useCallback((banner: AffiliateBanner) => {
    if (banner.linkType === 'URL') {
      Linking.openURL(banner.linkValue).catch(() => showToast('Could not open link', 'error'));
    } else if (banner.linkType === 'CATEGORY') {
      setCategory(banner.linkValue);
    } else if (banner.linkType === 'PRODUCT') {
      const product = products.find((p) => p.id === Number(banner.linkValue));
      if (product) handleBuy(product);
    }
  }, [products, handleBuy, showToast]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Shimmer width="100%" height={44} borderRadius={12} style={{ marginBottom: 14 }} />
        <Shimmer width="100%" height={150} borderRadius={18} style={{ marginBottom: 20 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {[0, 1, 2, 3].map((i) => <Shimmer key={i} width="48%" height={190} borderRadius={16} style={{ marginBottom: 14 }} />)}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={gridProducts}
      key="store-grid"
      numColumns={2}
      keyExtractor={(item) => String(item.id)}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={COLORS.yellow} />}
      renderItem={({ item }) => <ProductCard product={item} variant="grid" onPress={handleBuy} />}
      initialNumToRender={6}
      windowSize={7}
      maxToRenderPerBatch={4}
      removeClippedSubviews
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{isSearching ? 'No products match your search.' : 'No products available right now.'}</Text>
        </View>
      }
      ListHeaderComponent={
        <View>
          <View style={styles.searchBar}>
            <Search size={18} color={COLORS.white_55} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products…"
              placeholderTextColor={COLORS.white_55}
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <X size={16} color={COLORS.white_55} />
              </TouchableOpacity>
            )}
          </View>

          {!isSearching && banners.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <BannerCarousel banners={banners} onPress={handleBannerPress} />
            </View>
          )}

          {categories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <TouchableOpacity style={[styles.chip, !category && styles.chipActive]} onPress={() => setCategory(null)}>
                <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.chip, category === cat && styles.chipActive]} onPress={() => setCategory(category === cat ? null : cat)}>
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {shelves.map((shelf) => (
            <View key={shelf.key} style={{ marginBottom: 20 }}>
              <Text style={styles.shelfTitle}>{shelf.title}</Text>
              <FlatList
                data={shelf.products}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <ProductCard product={item} variant="row" onPress={handleBuy} />}
              />
            </View>
          ))}

          {gridProducts.length > 0 && !isSearching && !category && (
            <Text style={styles.shelfTitle}>All Products</Text>
          )}
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  gridRow: { justifyContent: 'space-between' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg_input,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border_subtle,
    gap: 8,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: 14 },
  chip: {
    backgroundColor: COLORS.bg_card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border_card,
  },
  chipActive: { backgroundColor: COLORS.yellow, borderColor: COLORS.yellow },
  chipText: { color: COLORS.white_80, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  shelfTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginBottom: 12 },
  emptyState: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: COLORS.white_55, fontSize: 14 },
});
