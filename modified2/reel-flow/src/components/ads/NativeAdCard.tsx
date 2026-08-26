import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from 'react-native-google-mobile-ads';

type Props = {
  unitId: string | null;
};

export const NativeAdCard: React.FC<Props> = ({ unitId }) => {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!unitId) {
      setNativeAd(null);
      return () => {
        mounted = false;
      };
    }

    NativeAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    })
      .then((ad) => {
        if (mounted) setNativeAd(ad);
      })
      .catch(() => {
        if (mounted) setNativeAd(null);
      });

    return () => {
      mounted = false;
      nativeAd?.destroy();
    };
  }, [unitId]);

  if (!nativeAd) return null;

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Ad</Text>
        {nativeAd.advertiser ? (
          <NativeAsset assetType={NativeAssetType.ADVERTISER}>
            <Text style={styles.advertiser} numberOfLines={1}>{nativeAd.advertiser}</Text>
          </NativeAsset>
        ) : null}
      </View>

      <NativeMediaView style={styles.media} resizeMode="cover" />

      <View style={styles.body}>
        {nativeAd.icon?.url ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : null}
        <View style={styles.copy}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={2}>{nativeAd.headline}</Text>
          </NativeAsset>
          {nativeAd.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.description} numberOfLines={2}>{nativeAd.body}</Text>
            </NativeAsset>
          ) : null}
        </View>
      </View>

      {nativeAd.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={styles.cta}>{nativeAd.callToAction}</Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    marginTop: 22,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  label: {
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: '#111',
    fontSize: 11,
    fontWeight: '800',
  },
  advertiser: {
    flex: 1,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '600',
  },
  media: {
    width: '100%',
    minHeight: 150,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  body: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  copy: {
    flex: 1,
  },
  headline: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  description: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 9,
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    textAlign: 'center',
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
});

