import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface AdPlacementConfig {
  screen: string;
  adFormat: string;
  enabled: boolean;
  intervalMin: number;
  intervalMax: number;
  cooldownSeconds: number;
  maxPerSession: number;
  skipFirstNActions: number;
  adUnitKey: string;
  titleKey?: string;
  descriptionKey?: string;
  ctaLabelKey?: string;
}

export interface AdRewardRuleConfig {
  coinsAwarded: number;
  dailyCapForType: number;
  cooldownSeconds: number;
  enabled: boolean;
  requiresFullWatch: boolean;
}

export interface DailyCapPolicyConfig {
  maxAdsPerDay: number;
  maxCoinsPerDay: number;
  minCooldownSeconds: number;
}

export interface ScreenSectionConfig {
  sectionKey: string;
  enabled: boolean;
  sortOrder: number;
  layoutVariant: string;
}

export interface AdUnitConfig {
  android?: string;
  ios?: string;
}

export interface RemoteConfigPayload {
  version: number;
  adPlacements: Record<string, AdPlacementConfig>;
  adUnits: Record<string, AdUnitConfig>;
  adMobAppIds?: AdUnitConfig;
  adRewardRules: Record<string, AdRewardRuleConfig>;
  dailyCapPolicies: Record<string, DailyCapPolicyConfig>;
  contentStrings: Record<string, string>;
  featureFlags: Record<string, boolean>;
  screenSections: Record<string, ScreenSectionConfig[]>;
}

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

interface ConfigState {
  version: number;
  adPlacements: Record<string, AdPlacementConfig>;
  adUnits: Record<string, AdUnitConfig>;
  adMobAppIds?: AdUnitConfig;
  adRewardRules: Record<string, AdRewardRuleConfig>;
  dailyCapPolicies: Record<string, DailyCapPolicyConfig>;
  contentStrings: Record<string, string>;
  featureFlags: Record<string, boolean>;
  screenSections: Record<string, ScreenSectionConfig[]>;
  hydrated: boolean;
  lastFetchedAt: number;

  setConfig: (config: RemoteConfigPayload) => void;
  setHydrated: (h: boolean) => void;
  getContent: (key: string, fallback: string) => string;
  getFlag: (key: string, fallback?: boolean) => boolean;
  getPlacement: (key: string) => AdPlacementConfig | undefined;
  getRewardRule: (adType: string) => AdRewardRuleConfig | undefined;
  getCapPolicy: (tier: string) => DailyCapPolicyConfig | undefined;
  getSections: (screen: string) => ScreenSectionConfig[];
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      version: 0,
      adPlacements: {},
      adUnits: {},
      adMobAppIds: undefined,
      adRewardRules: {},
      dailyCapPolicies: {},
      contentStrings: {},
      featureFlags: {},
      screenSections: {},
      hydrated: false,
      lastFetchedAt: 0,

      setConfig: (config) =>
        set({
          version: config.version,
          adPlacements: config.adPlacements,
          adUnits: config.adUnits ?? {},
          adMobAppIds: config.adMobAppIds,
          adRewardRules: config.adRewardRules,
          dailyCapPolicies: config.dailyCapPolicies,
          contentStrings: config.contentStrings,
          featureFlags: config.featureFlags,
          screenSections: config.screenSections,
          lastFetchedAt: Date.now(),
        }),

      setHydrated: (h) => set({ hydrated: h }),

      getContent: (key, fallback) => {
        return get().contentStrings[key] ?? fallback;
      },

      getFlag: (key, fallback = true) => {
        const val = get().featureFlags[key];
        return val !== undefined ? val : fallback;
      },

      getPlacement: (key) => get().adPlacements[key],

      getRewardRule: (adType) => get().adRewardRules[adType],

      getCapPolicy: (tier) =>
        get().dailyCapPolicies[tier] ?? get().dailyCapPolicies['DEFAULT'],

      getSections: (screen) =>
        (get().screenSections[screen] || []).filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    }),
    {
      name: 'reelflow-config-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        version: state.version,
        adPlacements: state.adPlacements,
        adUnits: state.adUnits,
        adMobAppIds: state.adMobAppIds,
        adRewardRules: state.adRewardRules,
        dailyCapPolicies: state.dailyCapPolicies,
        contentStrings: state.contentStrings,
        featureFlags: state.featureFlags,
        screenSections: state.screenSections,
        lastFetchedAt: state.lastFetchedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.(true);
      },
    }
  )
);
