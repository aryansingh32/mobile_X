import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  level: number;
  xp: number;
  streak: number;
  avatar?: string;
  coins?: number;
  referralCode?: string;
}

export interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  // Live runtime signal, not persisted — set true by api/client.ts when a
  // request fails with no response at all (genuine network unreachability,
  // not a 4xx/5xx), cleared the next time any request succeeds.
  isOffline: boolean;

  // Wallet
  coinBalance: number;
  xp: number;
  level: number;
  streak: number;
  lastStreakDate: string | null;

  // Daily limits (anti-fraud)
  rewardedAdsWatchedToday: number;
  dailyAdsWatched: number; // alias for ease of use
  lastAdLimitResetDate: string | null;
  dailyRewardsRemaining: number;
  dailyRewardsCap: number;
  todayCoinsEarned: number;
  streakClaimedToday: boolean;
  dailyBonusAvailable: boolean;
  sponsoredCardClaimedDate: string | null;
  coinToInrRate: number;
  minWithdrawalCoins: number;
  adRewardedCoins: number;
  adRewardedInterstitialCoins: number;
  adRewardedDiscoverCoins: number;

  // UI
  hapticsEnabled: boolean;
  hasSeenTabTooltip: Record<string, boolean>;
  isAdPlaying: boolean;
  lastAnyAdTimestamp: number;
  // Backend-computed ad-farming penalty (see reportAdEvent in
  // src/api/config.ts) — while Date.now() < adPenaltyUntil, no rewarded ad
  // should be requested or loaded anywhere in the app, regardless of what
  // local interval/cooldown logic would otherwise allow.
  adPenaltyUntil: number;
  hasCompletedOnboarding: boolean;
  selectedInterests: string[];
  
  // Telemetry
  telemetryQueue: Array<{ eventType: string; count: number }>;
  
  // Games
  games: any[];
  setGames: (games: any[]) => void;

  // Actions
  setUser: (user: User, token: string) => void;
  updateBalance: (delta: number) => void;
  setBalance: (balance: number) => void;
  incrementAdCount: () => void;
  canWatchAd: () => boolean;
  setAdPenaltyUntil: (until: number) => void;
  markTabSeen: (tab: string) => void;
  setAdPlaying: (playing: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  logout: () => void;
  setXp: (xp: number) => void;
  setLevel: (level: number) => void;
  setStreak: (streak: number) => void;
  setHydrated: (h: boolean) => void;
  setOffline: (offline: boolean) => void;
  setDailyStats: (stats: { remaining: number; cap: number; todayEarned: number }) => void;
  setStreakClaimedToday: (claimed: boolean) => void;
  setDailyBonusAvailable: (available: boolean) => void;
  setSponsoredCardClaimedDate: (date: string | null) => void;
  setConfigValues: (config: { coinToInrRate: number; minWithdrawalCoins: number; adRewardedCoins?: number; adRewardedInterstitialCoins?: number; adRewardedDiscoverCoins?: number }) => void;
  setHasCompletedOnboarding: (done: boolean) => void;
  setSelectedInterests: (interests: string[]) => void;
  
  // Telemetry Actions
  trackEvent: (eventType: string, count?: number) => void;
  trackScreentime: () => void;
  flushTelemetryQueue: () => Promise<void>;
}

const today = () => new Date().toISOString().split('T')[0];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      token: null,
      isAuthenticated: false,
      hydrated: false,
      isOffline: false,

      // Wallet
      coinBalance: 0,
      xp: 0,
      level: 1,
      streak: 0,
      lastStreakDate: null,

      // Daily limits
      rewardedAdsWatchedToday: 0,
      dailyAdsWatched: 0,
      lastAdLimitResetDate: null,
      dailyRewardsRemaining: 20,
      dailyRewardsCap: 20,
      todayCoinsEarned: 0,
      streakClaimedToday: false,
      dailyBonusAvailable: false,
      sponsoredCardClaimedDate: null,
      coinToInrRate: 0.10,
      minWithdrawalCoins: 500,
      adRewardedCoins: 100,
      adRewardedInterstitialCoins: 50,
      adRewardedDiscoverCoins: 50,

      // UI
      hapticsEnabled: true,
      hasSeenTabTooltip: {},
      isAdPlaying: false,
      lastAnyAdTimestamp: 0,
      adPenaltyUntil: 0,
      hasCompletedOnboarding: false,
      selectedInterests: [],
      
      telemetryQueue: [],
      
      games: [],
      setGames: (games) => set({ games }),

      // Actions
      setUser: (user, token) => {
        import('expo-secure-store').then(SecureStore => {
          SecureStore.setItemAsync('auth_token', token).catch(() => {});
        });
        set({
          user,
          token,
          isAuthenticated: true,
          coinBalance: user.coins ?? 0,
          xp: user.xp,
          level: user.level,
          streak: user.streak,
        });
      },

      updateBalance: (delta) =>
        set((state) => ({ coinBalance: state.coinBalance + delta })),

      setBalance: (balance) => set({ coinBalance: balance }),

      incrementAdCount: () => {
        const state = get();
        const todayStr = today();
        if (state.lastAdLimitResetDate !== todayStr) {
          set({ rewardedAdsWatchedToday: 1, dailyAdsWatched: 1, lastAdLimitResetDate: todayStr });
        } else {
          set({ rewardedAdsWatchedToday: state.rewardedAdsWatchedToday + 1, dailyAdsWatched: state.rewardedAdsWatchedToday + 1 });
        }
      },

      canWatchAd: () => {
        const state = get();
        const todayStr = today();
        if (state.lastAdLimitResetDate !== todayStr) return true;
        // Use server-synced dailyRewardsCap — fallback to 20 if not yet received
        const cap = state.dailyRewardsCap > 0 ? state.dailyRewardsCap : 20;
        return state.rewardedAdsWatchedToday < cap;
      },

      markTabSeen: (tab) =>
        set((state) => ({
          hasSeenTabTooltip: { ...state.hasSeenTabTooltip, [tab]: true },
        })),

      setAdPlaying: (playing) => set({ isAdPlaying: playing }),

      setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),

      logout: () => {
        import('expo-secure-store').then(SecureStore => {
          SecureStore.deleteItemAsync('auth_token').catch(() => {});
        });
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          coinBalance: 0,
          xp: 0,
          level: 1,
          streak: 0,
        });
      },

      setXp: (xp) => set({ xp }),
      setLevel: (level) => set({ level }),
      setStreak: (streak) => set({ streak }),
      setHydrated: (h) => set({ hydrated: h }),

      setOffline: (offline) =>
        set((state) => (state.isOffline === offline ? state : { isOffline: offline })),
      setDailyStats: (stats) =>
        set({
          dailyRewardsRemaining: stats.remaining,
          dailyRewardsCap: stats.cap,
          todayCoinsEarned: stats.todayEarned,
          rewardedAdsWatchedToday: Math.max(0, stats.cap - stats.remaining),
          dailyAdsWatched: Math.max(0, stats.cap - stats.remaining),
          lastAdLimitResetDate: today(),
        }),
      setStreakClaimedToday: (claimed) => set({ streakClaimedToday: claimed }),
      setAdPenaltyUntil: (until) => set({ adPenaltyUntil: until }),
      setDailyBonusAvailable: (available) => set({ dailyBonusAvailable: available }),
      setSponsoredCardClaimedDate: (date) => set({ sponsoredCardClaimedDate: date }),
      setConfigValues: (config) =>
        set({
          coinToInrRate: config.coinToInrRate,
          minWithdrawalCoins: config.minWithdrawalCoins,
          ...(config.adRewardedCoins !== undefined && { adRewardedCoins: config.adRewardedCoins }),
          ...(config.adRewardedInterstitialCoins !== undefined && { adRewardedInterstitialCoins: config.adRewardedInterstitialCoins }),
          ...(config.adRewardedDiscoverCoins !== undefined && { adRewardedDiscoverCoins: config.adRewardedDiscoverCoins }),
        }),
      setHasCompletedOnboarding: (done) => set({ hasCompletedOnboarding: done }),
      setSelectedInterests: (interests) => set({ selectedInterests: interests }),
      
      trackEvent: (eventType: string, count: number = 1) => {
        const state = get();
        const existingIndex = state.telemetryQueue.findIndex(e => e.eventType === eventType);
        if (existingIndex >= 0) {
          const newQueue = [...state.telemetryQueue];
          newQueue[existingIndex].count += count;
          // Cap at 100 items to prevent JS thread freeze on large serialization
          set({ telemetryQueue: newQueue.slice(-100) });
        } else {
          const newQueue = [...state.telemetryQueue, { eventType, count }];
          set({ telemetryQueue: newQueue.slice(-100) });
        }
      },

      trackScreentime: () => {
        get().trackEvent('SCREENTIME_MIN', 1);
      },

      flushTelemetryQueue: async () => {
        const state = get();
        const queue = [...state.telemetryQueue];
        if (queue.length === 0 || !state.token) return;

        set({ telemetryQueue: [] });

        try {
          // Send all events in a SINGLE batch request to avoid sequential 500-error storms
          const { default: api } = await import('../api/client');
          await api.post('/api/telemetry/batch', { events: queue }, { timeout: 8000 });
        } catch {
          // Silently restore queue on failure — never show telemetry errors to users
          const currentState = get();
          const restoredQueue = [...currentState.telemetryQueue];
          for (const failedEvent of queue) {
            const idx = restoredQueue.findIndex(e => e.eventType === failedEvent.eventType);
            if (idx >= 0) restoredQueue[idx].count += failedEvent.count;
            else restoredQueue.push(failedEvent);
          }
          set({ telemetryQueue: restoredQueue });
        }
      },
    }),
    {
      name: 'reelflow-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        coinBalance: state.coinBalance,
        xp: state.xp,
        level: state.level,
        streak: state.streak,
        hapticsEnabled: state.hapticsEnabled,
        hasSeenTabTooltip: state.hasSeenTabTooltip,
        rewardedAdsWatchedToday: state.rewardedAdsWatchedToday,
        lastAdLimitResetDate: state.lastAdLimitResetDate,
        dailyRewardsRemaining: state.dailyRewardsRemaining,
        dailyRewardsCap: state.dailyRewardsCap,
        todayCoinsEarned: state.todayCoinsEarned,
        streakClaimedToday: state.streakClaimedToday,
        dailyBonusAvailable: state.dailyBonusAvailable,
        sponsoredCardClaimedDate: state.sponsoredCardClaimedDate,
        coinToInrRate: state.coinToInrRate,
        minWithdrawalCoins: state.minWithdrawalCoins,
        adRewardedCoins: state.adRewardedCoins,
        adRewardedInterstitialCoins: state.adRewardedInterstitialCoins,
        adRewardedDiscoverCoins: state.adRewardedDiscoverCoins,
        lastAnyAdTimestamp: state.lastAnyAdTimestamp,
        adPenaltyUntil: state.adPenaltyUntil,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        selectedInterests: state.selectedInterests,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          import('expo-secure-store').then(SecureStore => {
            SecureStore.getItemAsync('auth_token').then(token => {
              if (token) useAppStore.setState({ token });
              state.setHydrated?.(true);
            }).catch(() => state.setHydrated?.(true));
          });
        }
      },
    }
  )
);

// We need to add setHydrated to the store. Actually, it's easier to just call useAppStore.setState({ hydrated: true }) in App.tsx or use the hook directly.
// Let's add setHydrated to AppState.
