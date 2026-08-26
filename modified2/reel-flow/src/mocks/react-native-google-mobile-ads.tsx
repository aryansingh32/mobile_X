import React from 'react';
import { View, Text } from 'react-native';

export const TestIds = {
  SIGN_IN: 'ca-app-pub-3940256099942544/6300978111',
  APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
};

export const AdEventType = {
  LOADED: 'adLoaded',
  ERROR: 'adError',
  OPENED: 'adOpened',
  CLICKED: 'adClicked',
  LEFT_APPLICATION: 'adLeftApplication',
  CLOSED: 'adClosed',
};

export const RewardedAdEventType = {
  LOADED: 'rewardedAdLoaded',
  EARNED_REWARD: 'rewardedAdEarnedReward',
};

export const MaxAdContentRating = {
  G: 'G',
  PG: 'PG',
  T: 'T',
  MA: 'MA',
};

export const BannerAdSize = {
  BANNER: 'BANNER',
  FULL_BANNER: 'FULL_BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  LEADERBOARD: 'LEADERBOARD',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  PORTRAIT: 'PORTRAIT',
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
};

class MockAd {
  private listeners: Record<string, Function[]> = {};

  addAdEventListener(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return () => {
      this.listeners[event] = this.listeners[event]?.filter(l => l !== listener) || [];
    };
  }

  load() {
    // Simulate async ad load latency
    setTimeout(() => {
      this.emit(AdEventType.LOADED);
      this.emit(RewardedAdEventType.LOADED);
    }, 400);
  }

  show() {
    // Simulate watching the ad then triggering rewards and close
    setTimeout(() => {
      this.emit(RewardedAdEventType.EARNED_REWARD, { amount: 100, type: 'coins' });
      setTimeout(() => {
        this.emit(AdEventType.CLOSED);
      }, 200);
    }, 1000);
  }

  private emit(event: string, data?: any) {
    this.listeners[event]?.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('Error in mock ad listener:', e);
      }
    });
  }
}

export const AppOpenAd = {
  createForAdRequest: () => new MockAd(),
};

export const InterstitialAd = {
  createForAdRequest: () => new MockAd(),
};

export const RewardedAd = {
  createForAdRequest: () => new MockAd(),
};

export const RewardedInterstitialAd = {
  createForAdRequest: () => new MockAd(),
};

export const BannerAd = ({ size }: any) => {
  return (
    <View style={{ padding: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderColor: '#333', borderWidth: 1, marginVertical: 8, borderRadius: 8 }}>
      <Text style={{ color: '#FFD700', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
        [SPONSORED BANNER AD PLACEHOLDER]
      </Text>
    </View>
  );
};

const mobileAdsInstance = {
  initialize: () => Promise.resolve({}),
  setRequestConfiguration: () => Promise.resolve({}),
};

const mobileAdsExport = () => mobileAdsInstance;
Object.assign(mobileAdsExport, mobileAdsInstance);

export default mobileAdsExport;
