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
  setFeatureFlag: (key: string, value: boolean) => void;
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

      // Every field is coerced to a safe shape rather than trusted. The
      // payload is cast straight from the network in api/config.ts with no
      // validation, and whatever lands here is persisted to AsyncStorage — so
      // a single malformed response (partial deploy, proxy error page, schema
      // change) would otherwise write `undefined` into these maps, make
      // getPlacement/getContent throw on property access, and keep the app
      // broken across restarts until the user cleared storage.
      setConfig: (config) => {
        const asRecord = <T,>(value: unknown, previous: Record<string, T>): Record<string, T> =>
          value !== null && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, T>)
            : previous;

        const state = get();
        set({
          version: typeof config?.version === 'number' ? config.version : state.version,
          adPlacements: asRecord(config?.adPlacements, state.adPlacements),
          adUnits: asRecord(config?.adUnits, state.adUnits),
          adMobAppIds: config?.adMobAppIds ?? state.adMobAppIds,
          adRewardRules: asRecord(config?.adRewardRules, state.adRewardRules),
          dailyCapPolicies: asRecord(config?.dailyCapPolicies, state.dailyCapPolicies),
          contentStrings: asRecord(config?.contentStrings, state.contentStrings),
          featureFlags: asRecord(config?.featureFlags, state.featureFlags),
          screenSections: asRecord(config?.screenSections, state.screenSections),
          lastFetchedAt: Date.now(),
        });
      },

      setFeatureFlag: (key, value) =>
        set((state) => ({ featureFlags: { ...state.featureFlags, [key]: value } })),

      setHydrated: (h) => set({ hydrated: h }),

      // These read from persisted storage, which may predate the current
      // shape (an older app version, or a payload written before setConfig
      // validated anything), so each one tolerates a missing map instead of
      // throwing on property access of undefined.
      getContent: (key, fallback) => {
        return get().contentStrings?.[key] ?? fallback;
      },

      getFlag: (key, fallback = true) => {
        const val = get().featureFlags?.[key];
        return typeof val === 'boolean' ? val : fallback;
      },

      getPlacement: (key) => get().adPlacements?.[key],

      getRewardRule: (adType) => get().adRewardRules?.[adType],

      getCapPolicy: (tier) =>
        get().dailyCapPolicies?.[tier] ?? get().dailyCapPolicies?.['DEFAULT'],

      getSections: (screen) =>
        (Array.isArray(get().screenSections?.[screen]) ? get().screenSections[screen]! : [])
          .filter((s) => s?.enabled)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
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
