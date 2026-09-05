import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { VIBIcon } from './VIBIcon';
import { Play, ChevronRight } from 'lucide-react-native';
import { fetchTrendingShorts } from '../../api/shorts';
import { Shimmer } from './Shimmer';

type TrendingShortsCatalogProps = {
  onVideoPress: (videoId: string) => void;
  onViewMore: () => void;
};

export const TrendingShortsCatalog = ({ onVideoPress, onViewMore }: TrendingShortsCatalogProps) => {
  const [shorts, setShorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();

    const loadShorts = async () => {
      try {
        const { data } = await fetchTrendingShorts(10);
        if (isMounted.current) {
          setShorts(data.slice(0, 10));
        }
      } catch (err: any) {
        // Silently fail — trending shorts is a non-critical section
        if (err?.name !== 'AbortError' && isMounted.current) {
          setShorts([]);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    loadShorts();

    return () => {
      isMounted.current = false;
      controller.abort();
    };
  }, []);

  if (!loading && shorts.length === 0) return null;

  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.bolt}>⚡</Text>
          <Text style={styles.title}>Trending Shorts</Text>
        </View>
        <TouchableOpacity onPress={onViewMore} style={styles.seeAllBtn}>
          <Text style={styles.seeAll}>See all</Text>
          <ChevronRight color="#FF4D1A" size={14} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.list, { flexDirection: 'row', gap: 10 }]}>
          {[1, 2, 3].map(i => (
            <Shimmer key={i} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={14} />
          ))}
        </View>
      ) : (
        <FlatList
          data={shorts}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.videoId || item.id?.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const thumbUri = `https://i.ytimg.com/vi/${item.videoId || item.id}/mqdefault.jpg`;
            const vibReward = item.rewardCoins ?? item.coins ?? 10;
            const duration = item.duration ?? item.durationSeconds
              ? `${Math.floor((item.durationSeconds || 30) / 60)}:${String((item.durationSeconds || 30) % 60).padStart(2, '0')}`
              : null;
            const rankColor = index < 3 ? rankColors[index] : null;

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onVideoPress(item.videoId || item.id)}
                activeOpacity={0.82}
              >
                {/* Thumbnail */}
                <View style={styles.thumbnailContainer}>
                  <Image
                    source={{ uri: thumbUri }}
                    style={styles.thumbnail}
                    contentFit="cover"
                    transition={200}
                  />
                  {/* Dark gradient overlay at bottom */}
                  <View style={styles.gradientOverlay} />

                  {/* Play button center */}
                  <View style={styles.playOverlay}>
                    <View style={styles.playButton}>
                      <Play color="#FFF" fill="#FFF" size={14} />
                    </View>
                  </View>

                  {/* Duration badge — top left */}
                  {duration && (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{duration}</Text>
                    </View>
                  )}

                  {/* Rank badge — bottom left OR gold/silver/bronze dot */}
                  {rankColor && (
                    <View style={[styles.rankBadge, { borderColor: rankColor }]}>
                      <Text style={[styles.rankText, { color: rankColor }]}>#{index + 1}</Text>
                    </View>
                  )}

                  {/* VIB reward chip — bottom */}
                  <View style={styles.rewardChip}>
                    <VIBIcon size={14} animated />
                  </View>
                </View>

                {/* Title below card */}
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <TouchableOpacity style={styles.viewMoreCard} onPress={onViewMore}>
              <ChevronRight color="#FF4D1A" size={26} />
              <Text style={styles.viewMoreCardText}>More</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
};

const CARD_WIDTH = 130;
const CARD_HEIGHT = 175;

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bolt: {
    fontSize: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAll: {
    fontSize: 13,
    color: '#FF4D1A',
    fontWeight: '600',
  },
  loadingContainer: {
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingRight: 8,
    gap: 10,
  },
  card: {
    width: CARD_WIDTH,
  },
  thumbnailContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 7,
    backgroundColor: '#1A1A2E',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '60%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  durationBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  rankBadge: {
    position: 'absolute',
    bottom: 28,
    left: 7,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  rankText: {
    fontSize: 10,
    fontWeight: '900',
  },
  rewardChip: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255,215,0,0.5)',
  },
  rewardChipText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
  },
  vibChipIcon: {
    width: 13,
    height: 13,
  },
  videoTitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    lineHeight: 15,
  },
  viewMoreCard: {
    width: 60,
    height: CARD_HEIGHT,
    borderRadius: 14,
    backgroundColor: 'rgba(255,77,26,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,77,26,0.25)',
    gap: 5,
    marginLeft: 2,
  },
  viewMoreCardText: {
    color: '#FF4D1A',
    fontSize: 11,
    fontWeight: '600',
  },
});